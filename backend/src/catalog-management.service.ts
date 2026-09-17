// src/catalog-management.service.ts
import { Pool } from "pg";
import { withTenantContext } from "./db/tenant-context";

export class TenantMismatchError extends Error {
  constructor(resource: string) {
    super(`Ese/a ${resource} no pertenece a tu barbería.`);
    this.name = "TenantMismatchError";
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`No se encontró ${resource}.`);
    this.name = "NotFoundError";
  }
}

export class InvalidHoursError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHoursError";
  }
}

export interface ServiceInput {
  name: string;
  description?: string;
  category?: string;
  basePrice: number;
  baseDurationMinutes: number;
}

export interface StaffHourInput {
  dayOfWeek: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  startsAt: string;
  endsAt: string;
}

/**
 * Gestión de catálogo (servicios, barberos, sus asignaciones y horarios) — distinto de
 * `CatalogService`, que es exclusivamente lectura pública. Todo acá requiere tenant
 * autenticado, y cada método re-verifica pertenencia server-side aunque la ruta ya lo
 * haya chequeado (mismo patrón de dos capas que `BusinessService`, ver Loop 07).
 */
export class CatalogManagementService {
  constructor(private pool: Pool) {}

  // ── Lectura (para la UI de gestión) ──

  async listStaff(tenantId: string) {
    const { rows } = await this.pool.query(
      `SELECT sm.id, sm.branch_id, sm.status, sm.buffer_before_minutes, sm.buffer_after_minutes,
              sm.accepts_walk_ins, u.full_name, u.phone
       FROM staff_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.tenant_id = $1 AND sm.deleted_at IS NULL
       ORDER BY u.full_name`,
      [tenantId]
    );
    return rows;
  }

  async getStaffServices(tenantId: string, staffId: string) {
    const { rows: staffRows } = await this.pool.query(`SELECT tenant_id FROM staff_members WHERE id = $1`, [staffId]);
    if (staffRows.length === 0 || staffRows[0].tenant_id !== tenantId) throw new TenantMismatchError("barbero");

    const { rows } = await this.pool.query(
      `SELECT s.id AS service_id, s.name, ss.price_override, ss.duration_override_minutes, ss.is_active
       FROM staff_services ss JOIN services s ON s.id = ss.service_id
       WHERE ss.staff_id = $1
       ORDER BY s.name`,
      [staffId]
    );
    return rows;
  }

  // ── Servicios ──

  async createService(tenantId: string, input: ServiceInput) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO services (tenant_id, name, description, category, base_price, base_duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, category, base_price, base_duration_minutes`,
        [tenantId, input.name, input.description ?? null, input.category ?? null, input.basePrice, input.baseDurationMinutes]
      );
      return rows[0];
    });
  }

  async updateService(tenantId: string, serviceId: string, updates: Partial<ServiceInput>) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE services
         SET name = COALESCE($3, name),
             description = COALESCE($4, description),
             category = COALESCE($5, category),
             base_price = COALESCE($6, base_price),
             base_duration_minutes = COALESCE($7, base_duration_minutes)
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, name, description, category, base_price, base_duration_minutes`,
        [serviceId, tenantId, updates.name ?? null, updates.description ?? null, updates.category ?? null, updates.basePrice ?? null, updates.baseDurationMinutes ?? null]
      );
      // El WHERE tenant_id = $2 es lo que realmente protege esto (RLS ya lo respalda además) —
      // si la fila es de otro tenant, el UPDATE no afecta ninguna fila, no lanza un error de Postgres.
      if (rows.length === 0) throw new TenantMismatchError("servicio");
      return rows[0];
    });
  }

  async deactivateService(tenantId: string, serviceId: string) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE services SET is_active = false, deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [serviceId, tenantId]
      );
      if (rows.length === 0) throw new TenantMismatchError("servicio");
      return rows[0];
    });
  }

  // ── Barberos ──

  /**
   * Invita a un barbero — crea su `users`/`staff_members`. Simplificación deliberada de
   * este loop: el owner define una contraseña temporal y se la comunica fuera de banda
   * (no hay todavía un flujo de invitación por link/SMS ni "cambiar contraseña" — ver
   * KNOWN_ISSUES.md, queda anotado como simplificación consciente, no un olvido).
   */
  async inviteStaffMember(
    tenantId: string,
    branchId: string,
    input: { phone: string; fullName: string; tempPasswordHash: string }
  ) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows: branchRows } = await client.query(`SELECT tenant_id FROM branches WHERE id = $1`, [branchId]);
      if (branchRows.length === 0 || branchRows[0].tenant_id !== tenantId) throw new TenantMismatchError("sucursal");

      const { rows: userRows } = await client.query(
        `INSERT INTO users (phone, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
        [input.phone, input.tempPasswordHash, input.fullName]
      );
      const { rows: staffRows } = await client.query(
        `INSERT INTO staff_members (tenant_id, branch_id, user_id) VALUES ($1, $2, $3)
         RETURNING id, branch_id, status, buffer_before_minutes, buffer_after_minutes`,
        [tenantId, branchId, userRows[0].id]
      );
      return staffRows[0];
    });
  }

  async updateStaffMember(
    tenantId: string,
    staffId: string,
    updates: { bio?: string; status?: "active" | "paused" | "terminated"; bufferBeforeMinutes?: number; bufferAfterMinutes?: number; acceptsWalkIns?: boolean }
  ) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE staff_members
         SET bio = COALESCE($3, bio),
             status = COALESCE($4, status),
             buffer_before_minutes = COALESCE($5, buffer_before_minutes),
             buffer_after_minutes = COALESCE($6, buffer_after_minutes),
             accepts_walk_ins = COALESCE($7, accepts_walk_ins)
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, status, buffer_before_minutes, buffer_after_minutes, accepts_walk_ins`,
        [staffId, tenantId, updates.bio ?? null, updates.status ?? null, updates.bufferBeforeMinutes ?? null, updates.bufferAfterMinutes ?? null, updates.acceptsWalkIns ?? null]
      );
      if (rows.length === 0) throw new TenantMismatchError("barbero");
      return rows[0];
    });
  }

  // ── Asignación de servicios a barberos ──

  async assignService(
    tenantId: string,
    staffId: string,
    serviceId: string,
    overrides: { priceOverride?: number; durationOverrideMinutes?: number }
  ) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      // Verifica que TANTO el barbero COMO el servicio sean de este tenant — asignar
      // un servicio ajeno a un barbero propio (o viceversa) es un caso de IDOR tan real
      // como cualquier otro, aunque cruce dos tablas en vez de una.
      const { rows: checkRows } = await client.query(
        `SELECT
           (SELECT tenant_id FROM staff_members WHERE id = $1) AS staff_tenant,
           (SELECT tenant_id FROM services WHERE id = $2) AS service_tenant`,
        [staffId, serviceId]
      );
      const check = checkRows[0];
      if (!check || check.staff_tenant !== tenantId) throw new TenantMismatchError("barbero");
      if (check.service_tenant !== tenantId) throw new TenantMismatchError("servicio");

      const { rows } = await client.query(
        `INSERT INTO staff_services (staff_id, service_id, price_override, duration_override_minutes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (staff_id, service_id)
         DO UPDATE SET price_override = $3, duration_override_minutes = $4, is_active = true
         RETURNING id, staff_id, service_id, price_override, duration_override_minutes, is_active`,
        [staffId, serviceId, overrides.priceOverride ?? null, overrides.durationOverrideMinutes ?? null]
      );
      return rows[0];
    });
  }

  async removeServiceFromStaff(tenantId: string, staffId: string, serviceId: string) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE staff_services SET is_active = false
         WHERE staff_id = $1 AND service_id = $2
           AND staff_id IN (SELECT id FROM staff_members WHERE tenant_id = $3)
         RETURNING id`,
        [staffId, serviceId, tenantId]
      );
      if (rows.length === 0) throw new TenantMismatchError("asignación de servicio");
      return rows[0];
    });
  }

  // ── Horario individual del barbero ──

  async setStaffHours(tenantId: string, staffId: string, hours: StaffHourInput[]) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows: staffRows } = await client.query(`SELECT tenant_id FROM staff_members WHERE id = $1`, [staffId]);
      if (staffRows.length === 0 || staffRows[0].tenant_id !== tenantId) throw new TenantMismatchError("barbero");

      for (const h of hours) {
        if (h.endsAt <= h.startsAt) {
          throw new InvalidHoursError(`El horario de ${h.dayOfWeek} es inválido: el fin debe ser después del inicio.`);
        }
      }

      await client.query(`DELETE FROM staff_hours WHERE staff_id = $1`, [staffId]);
      for (const h of hours) {
        await client.query(
          `INSERT INTO staff_hours (staff_id, day_of_week, starts_at, ends_at) VALUES ($1, $2, $3, $4)`,
          [staffId, h.dayOfWeek, h.startsAt, h.endsAt]
        );
      }

      const { rows } = await client.query(
        `SELECT day_of_week, starts_at, ends_at FROM staff_hours WHERE staff_id = $1 ORDER BY day_of_week, starts_at`,
        [staffId]
      );
      return rows;
    });
  }

  // ── Vacaciones / licencias ──

  async addTimeOff(tenantId: string, staffId: string, input: { startsOn: string; endsOn: string; reason?: string; note?: string }) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows: staffRows } = await client.query(`SELECT tenant_id FROM staff_members WHERE id = $1`, [staffId]);
      if (staffRows.length === 0 || staffRows[0].tenant_id !== tenantId) throw new TenantMismatchError("barbero");

      const { rows } = await client.query(
        `INSERT INTO time_off (staff_id, starts_on, ends_on, reason, note)
         VALUES ($1, $2, $3, COALESCE($4, 'vacation'), $5)
         RETURNING id, starts_on, ends_on, reason, note`,
        [staffId, input.startsOn, input.endsOn, input.reason ?? null, input.note ?? null]
      );
      return rows[0];
    });
  }

  async cancelTimeOff(tenantId: string, timeOffId: string) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows } = await client.query(
        `DELETE FROM time_off
         WHERE id = $1 AND staff_id IN (SELECT id FROM staff_members WHERE tenant_id = $2)
         RETURNING id`,
        [timeOffId, tenantId]
      );
      if (rows.length === 0) throw new NotFoundError("esa licencia/vacación");
      return rows[0];
    });
  }
}
