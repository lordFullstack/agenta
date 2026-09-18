// src/business.service.ts
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { TokenService, TokenPair } from "./auth/token.service";
import { withTenantContext } from "./db/tenant-context";
import { slugify } from "./slugify";

export class SlugGenerationError extends Error {
  constructor() {
    super("No se pudo generar un identificador único para la barbería. Probá con otro nombre.");
    this.name = "SlugGenerationError";
  }
}

export class TenantMismatchError extends Error {
  constructor() {
    super("Este recurso no pertenece a tu barbería.");
    this.name = "TenantMismatchError";
  }
}

export class InvalidBusinessHoursError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBusinessHoursError";
  }
}

export interface RegisterBarbershopInput {
  ownerPhone: string;
  ownerPassword: string;
  ownerFullName: string;
  tradeName: string;
  legalName: string;
  timezone: string;
}

export interface BusinessHourInput {
  dayOfWeek: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  opensAt: string; // "HH:MM"
  closesAt: string;
}

export class BusinessService {
  constructor(private pool: Pool, private tokens: TokenService) {}

  /**
   * Onboarding: crea usuario (owner) + tenant + branch + membership en una sola
   * transacción. Es el único endpoint de este servicio que NO requiere auth previa —
   * es, literalmente, cómo se crea la primera identidad autenticable de una barbería nueva.
   */
  async registerBarbershop(input: RegisterBarbershopInput): Promise<TokenPair & { tenantId: string; branchId: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const passwordHash = await bcrypt.hash(input.ownerPassword, 12);
      const { rows: userRows } = await client.query(
        `INSERT INTO users (phone, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
        [input.ownerPhone, passwordHash, input.ownerFullName]
      );
      const ownerId = userRows[0].id;

      // Resolución de slug con retry ante colisión — mismo patrón que el número de
      // confirmación de citas (migración 013): generar, intentar, sufijar si choca.
      let tenantId: string | null = null;
      const baseSlug = slugify(input.tradeName);
      for (let attempt = 0; attempt < 5 && !tenantId; attempt++) {
        const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        try {
          const { rows: tenantRows } = await client.query(
            `INSERT INTO tenants (legal_name, trade_name, slug, timezone, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [input.legalName, input.tradeName, candidateSlug, input.timezone, ownerId]
          );
          tenantId = tenantRows[0].id;
        } catch (err: any) {
          if (err.code !== "23505") throw err; // unique_violation en el slug — reintentar con sufijo
        }
      }
      if (!tenantId) throw new SlugGenerationError();

      const { rows: branchRows } = await client.query(
        `INSERT INTO branches (tenant_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`,
        [tenantId, "Sucursal Principal", ownerId]
      );
      const branchId = branchRows[0].id;

      await client.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [tenantId, ownerId]
      );

      await client.query("COMMIT");

      const tokenPair = await this.tokens.issueTokenPair({ sub: ownerId, role: "owner", tenantId });
      return { ...tokenPair, tenantId, branchId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Edita el perfil del tenant. `tenants` no tiene RLS (es intencional — ver
   * DECISIONS_LOG.md), así que el aislamiento acá lo hace el guard explícito de
   * tenant, no la base de datos. Por eso es más importante todavía que el caller
   * (la ruta) ya haya verificado `req.user.tenantId === tenantId` antes de llegar acá
   * — este método es una segunda capa, no la única.
   */
  async getTenantProfile(tenantId: string, callerTenantId: string) {
    if (tenantId !== callerTenantId) throw new TenantMismatchError();
    const { rows } = await this.pool.query(
      `SELECT id, trade_name, description, timezone FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (rows.length === 0) throw new TenantMismatchError();
    return rows[0];
  }

  /**
   * Devuelve la sucursal "principal" (la más antigua) del tenant del caller — usado
   * para que el panel pueda loguear a un owner/admin sin que tenga que saber ni
   * escribir a mano el UUID de su propia sucursal.
   */
  async getPrimaryBranch(callerTenantId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, name FROM branches WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [callerTenantId]
    );
    if (rows.length === 0) throw new TenantMismatchError();
    return rows[0];
  }

  async updateTenantProfile(
    tenantId: string,
    callerTenantId: string,
    updates: { tradeName?: string; description?: string; timezone?: string }
  ) {
    if (tenantId !== callerTenantId) throw new TenantMismatchError();

    const { rows } = await this.pool.query(
      `UPDATE tenants
       SET trade_name = COALESCE($2, trade_name),
           description = COALESCE($3, description),
           timezone = COALESCE($4, timezone)
       WHERE id = $1
       RETURNING id, trade_name, description, timezone`,
      [tenantId, updates.tradeName ?? null, updates.description ?? null, updates.timezone ?? null]
    );
    return rows[0];
  }

  async getBusinessHours(branchId: string) {
    const { rows } = await this.pool.query(
      `SELECT day_of_week, opens_at, closes_at FROM business_hours WHERE branch_id = $1 ORDER BY day_of_week, opens_at`,
      [branchId]
    );
    return rows;
  }

  /**
   * Reemplaza el horario completo de la sucursal (borra y vuelve a insertar) dentro de
   * una transacción con contexto de tenant — el `EXCLUDE`/constraint de la migración 015
   * es la garantía real de que no se pueda escribir en una sucursal ajena, no solo el
   * chequeo de `callerTenantId` de acá.
   */
  async setBusinessHours(branchId: string, callerTenantId: string, hours: BusinessHourInput[]) {
    return withTenantContext(this.pool, callerTenantId, async (client) => {
      // Verifica pertenencia ANTES de mutar — si branchId es de otro tenant, esta
      // lectura ya vuelve vacía por RLS (branches tiene SELECT público, pero igual
      // chequeamos explícitamente para dar un error claro en vez de un 404 ambiguo).
      const { rows: branchRows } = await client.query(`SELECT tenant_id FROM branches WHERE id = $1`, [branchId]);
      if (branchRows.length === 0 || branchRows[0].tenant_id !== callerTenantId) {
        throw new TenantMismatchError();
      }

      for (const h of hours) {
        if (h.closesAt <= h.opensAt) {
          throw new InvalidBusinessHoursError(
            `El horario de ${h.dayOfWeek} es inválido: el cierre debe ser después de la apertura.`
          );
        }
      }

      await client.query(`DELETE FROM business_hours WHERE branch_id = $1`, [branchId]);
      for (const h of hours) {
        await client.query(
          `INSERT INTO business_hours (branch_id, day_of_week, opens_at, closes_at) VALUES ($1, $2, $3, $4)`,
          [branchId, h.dayOfWeek, h.opensAt, h.closesAt]
        );
      }

      const { rows } = await client.query(
        `SELECT day_of_week, opens_at, closes_at FROM business_hours WHERE branch_id = $1 ORDER BY day_of_week, opens_at`,
        [branchId]
      );
      return rows;
    });
  }

  /** Pausa/reactiva la sucursal — el motor de disponibilidad ya respeta esto (migración 010). */
  async setBranchActive(branchId: string, callerTenantId: string, isActive: boolean) {
    return withTenantContext(this.pool, callerTenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE branches SET is_active = $2 WHERE id = $1 AND tenant_id = $3 RETURNING id, is_active`,
        [branchId, isActive, callerTenantId]
      );
      if (rows.length === 0) throw new TenantMismatchError();
      return rows[0];
    });
  }
}
