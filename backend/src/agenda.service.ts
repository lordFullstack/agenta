// src/agenda.service.ts
import { Pool } from "pg";
import { withTenantContext } from "./db/tenant-context";

const PG_RAISE_EXCEPTION = "P0001"; // triggers de negocio (máquina de estados, bloqueos)
const PG_EXCLUSION_VIOLATION = "23P01";

export class TenantMismatchError extends Error {
  constructor(message = "Ese recurso no pertenece a tu barbería.") {
    super(message);
    this.name = "TenantMismatchError";
  }
}

export class OwnAppointmentsOnlyError extends Error {
  constructor() {
    super("Solo podés operar sobre tus propias citas.");
    this.name = "OwnAppointmentsOnlyError";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStatusTransitionError";
  }
}

export class SlotConflictError extends Error {
  constructor() {
    super("Ese horario ya está ocupado.");
    this.name = "SlotConflictError";
  }
}

export class InvalidPaymentError extends Error {
  constructor(message = "El monto o el método de pago no son válidos.") {
    super(message);
    this.name = "InvalidPaymentError";
  }
}

export type CallerRole = "owner" | "branch_admin" | "barber";

export interface AgendaQuery {
  tenantId: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  callerRole: CallerRole;
  callerStaffId?: string;
  requestedStaffId?: string; // filtro opcional, solo lo honran owner/branch_admin
}

export interface WalkInInput {
  tenantId: string;
  branchId: string;
  staffId: string;
  customerPhone: string;
  customerFullName?: string;
  serviceIds: string[];
  startsAt: Date;
  createdBy: string;
}

export interface RecordPaymentInput {
  tenantId: string;
  appointmentId: string;
  amount: number;
  method: string; // enum payment_method: 'cash' | 'card' | 'deposit_online' | 'wallet'
  paidAt?: Date;
}

export interface BlockedSlotInput {
  tenantId: string;
  branchId: string;
  staffId?: string; // ausente = bloquea toda la sucursal
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  note?: string;
  createdBy: string;
}

export class AgendaService {
  constructor(private pool: Pool) {}

  /**
   * Vista del día. Si el caller es `barber`, `staffId` se FUERZA a `callerStaffId` sin
   * importar qué se haya pedido — no es un error, es la misma lógica de "identidad
   * derivada del token" que ya usa el resto del proyecto (DEC-017, DEC-022). Si es
   * owner/branch_admin, se honra el filtro pedido (o se traen todos los barberos si no
   * se especifica ninguno).
   */
  async getAgenda(query: AgendaQuery) {
    const effectiveStaffId =
      query.callerRole === "barber" ? query.callerStaffId : query.requestedStaffId;

    return withTenantContext(this.pool, query.tenantId, async (client) => {
      const params: any[] = [query.tenantId, query.branchId, query.date];
      let staffFilter = "";
      if (effectiveStaffId) {
        params.push(effectiveStaffId);
        staffFilter = `AND a.staff_id = $${params.length}`;
      }

      const { rows } = await client.query(
        `SELECT a.id, a.staff_id, u.full_name AS staff_name, a.starts_at, a.ends_at, a.status,
                a.confirmation_code, a.customer_note, a.price_total,
                cu.id AS customer_id, cuu.full_name AS customer_name, cuu.phone AS customer_phone,
                pay.status AS payment_status, pay.method AS payment_method, pay.paid_at AS payment_paid_at
         FROM appointments a
         JOIN staff_members sm ON sm.id = a.staff_id
         JOIN users u ON u.id = sm.user_id
         JOIN customers cu ON cu.id = a.customer_id
         JOIN users cuu ON cuu.id = cu.user_id
         LEFT JOIN LATERAL (
           SELECT p.status, p.method, p.paid_at
           FROM payments p
           WHERE p.appointment_id = a.id
           ORDER BY (p.status = 'paid') DESC, p.created_at DESC
           LIMIT 1
         ) pay ON true
         WHERE a.tenant_id = $1 AND a.branch_id = $2 AND a.starts_at::date = $3::date
           ${staffFilter}
         ORDER BY a.staff_id, a.starts_at`,
        params
      );
      return rows;
    });
  }

  /**
   * Transición de estado (confirmar, iniciar, completar, no-show, cancelar desde el
   * lado barbería). La máquina de estados real la fuerza el trigger de la migración 006
   * — acá solo se agrega la restricción de "solo mis citas" para el rol `barber`.
   */
  async updateAppointmentStatus(
    tenantId: string,
    appointmentId: string,
    newStatus: string,
    callerRole: CallerRole,
    callerStaffId: string | undefined,
    actorUserId: string
  ) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows: currentRows } = await client.query(
        `SELECT staff_id FROM appointments WHERE id = $1`,
        [appointmentId]
      );
      if (currentRows.length === 0) throw new TenantMismatchError("Esa cita no existe o no es de tu barbería.");

      if (callerRole === "barber" && currentRows[0].staff_id !== callerStaffId) {
        throw new OwnAppointmentsOnlyError();
      }

      try {
        const { rows } = await client.query(
          `UPDATE appointments SET status = $2, updated_by = $3 WHERE id = $1 RETURNING id, status`,
          [appointmentId, newStatus, actorUserId]
        );
        return rows[0];
      } catch (err: any) {
        if (err.code === PG_RAISE_EXCEPTION) throw new InvalidStatusTransitionError(err.message);
        throw err;
      }
    });
  }

  /**
   * Registro manual de pago (MVP: QR de billetera propio de la barbería, efectivo, etc. —
   * sin integración con ninguna pasarela de cobro). Mismo criterio "solo mis citas" que el
   * resto de acciones de agenda para el rol `barber`. Inserta una fila nueva en vez de
   * actualizar una existente: una cita puede tener más de un pago (seña + saldo), y
   * `getAgenda` ya prioriza el pago 'paid' más reciente al armar la vista de la agenda.
   */
  async recordPayment(input: RecordPaymentInput, callerRole: CallerRole, callerStaffId?: string) {
    return withTenantContext(this.pool, input.tenantId, async (client) => {
      const { rows: apptRows } = await client.query(`SELECT staff_id FROM appointments WHERE id = $1`, [input.appointmentId]);
      if (apptRows.length === 0) throw new TenantMismatchError("Esa cita no existe o no es de tu barbería.");

      if (callerRole === "barber" && apptRows[0].staff_id !== callerStaffId) {
        throw new OwnAppointmentsOnlyError();
      }

      try {
        const { rows } = await client.query(
          `INSERT INTO payments (tenant_id, appointment_id, amount, method, status, provider, paid_at)
           VALUES ($1, $2, $3, $4, 'paid', 'manual', COALESCE($5, now()))
           RETURNING id, amount, method, status, paid_at`,
          [input.tenantId, input.appointmentId, input.amount, input.method, input.paidAt ?? null]
        );
        return rows[0];
      } catch (err: any) {
        if (err.code === "22P02" || err.code === "23514") throw new InvalidPaymentError();
        throw err;
      }
    });
  }

  /** Encuentra o crea el cliente por teléfono — mismo patrón que el login OTP (Loop 06). */
  private async findOrCreateCustomerByPhone(client: any, phone: string, fullName?: string): Promise<string> {
    const { rows: existingUsers } = await client.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
    let userId: string;
    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      const { rows } = await client.query(
        `INSERT INTO users (phone, full_name) VALUES ($1, $2) RETURNING id`,
        [phone, fullName ?? "Cliente"]
      );
      userId = rows[0].id;
    }

    const { rows: existingCustomers } = await client.query(`SELECT id FROM customers WHERE user_id = $1`, [userId]);
    if (existingCustomers.length > 0) return existingCustomers[0].id;

    const { rows } = await client.query(`INSERT INTO customers (user_id) VALUES ($1) RETURNING id`, [userId]);
    return rows[0].id;
  }

  /**
   * Walk-in: el barbero/admin crea la cita directamente, sin que el cliente pase por el
   * flujo de reserva propio. Pasa por el MISMO constraint anti double-booking que
   * cualquier otra creación — no hay una vía "rápida" que lo esquive.
   */
  async createWalkIn(input: WalkInInput) {
    return withTenantContext(this.pool, input.tenantId, async (client) => {
      const durationResult = await client.query(
        `SELECT resolve_appointment_duration($1, $2::uuid[]) AS duration`,
        [input.staffId, input.serviceIds]
      );
      const duration = durationResult.rows[0]?.duration;
      if (duration == null) {
        throw new TenantMismatchError("Ese barbero no ofrece uno o más de los servicios seleccionados.");
      }

      const customerId = await this.findOrCreateCustomerByPhone(client, input.customerPhone, input.customerFullName);
      const endsAt = new Date(input.startsAt.getTime() + duration * 60 * 1000);

      const priceResult = await client.query(
        `SELECT COALESCE(SUM(COALESCE(ss.price_override, s.base_price)), 0) AS total
         FROM services s LEFT JOIN staff_services ss ON ss.service_id = s.id AND ss.staff_id = $1
         WHERE s.id = ANY($2::uuid[])`,
        [input.staffId, input.serviceIds]
      );

      try {
        const { rows } = await client.query(
          `INSERT INTO appointments (tenant_id, branch_id, staff_id, customer_id, starts_at, ends_at, status, price_total, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8)
           RETURNING id, starts_at, ends_at, status, confirmation_code`,
          [input.tenantId, input.branchId, input.staffId, customerId, input.startsAt, endsAt, priceResult.rows[0].total, input.createdBy]
        );

        await client.query(
          `INSERT INTO appointment_items (appointment_id, service_id, service_name_snapshot, unit_price, duration_minutes)
           SELECT $1, s.id, s.name, COALESCE(ss.price_override, s.base_price), COALESCE(ss.duration_override_minutes, s.base_duration_minutes)
           FROM services s LEFT JOIN staff_services ss ON ss.service_id = s.id AND ss.staff_id = $2
           WHERE s.id = ANY($3::uuid[])`,
          [rows[0].id, input.staffId, input.serviceIds]
        );

        return rows[0];
      } catch (err: any) {
        if (err.code === PG_EXCLUSION_VIOLATION) throw new SlotConflictError();
        if (err.code === PG_RAISE_EXCEPTION) throw new TenantMismatchError(err.message);
        throw err;
      }
    });
  }

  /** Bloqueo de urgencia — un barbero solo puede bloquear su propio horario, no el de otro. */
  async addBlockedSlot(input: BlockedSlotInput, callerRole: CallerRole, callerStaffId?: string) {
    if (callerRole === "barber" && input.staffId && input.staffId !== callerStaffId) {
      throw new OwnAppointmentsOnlyError();
    }

    return withTenantContext(this.pool, input.tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO blocked_slots (tenant_id, branch_id, staff_id, starts_at, ends_at, reason, note, created_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'other'), $7, $8)
         RETURNING id, starts_at, ends_at, reason`,
        [input.tenantId, input.branchId, input.staffId ?? null, input.startsAt, input.endsAt, input.reason ?? null, input.note ?? null, input.createdBy]
      );
      return rows[0];
    });
  }

  async removeBlockedSlot(tenantId: string, blockedSlotId: string, callerRole: CallerRole, callerStaffId?: string) {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const { rows: existing } = await client.query(`SELECT staff_id FROM blocked_slots WHERE id = $1`, [blockedSlotId]);
      if (existing.length === 0) throw new TenantMismatchError("Ese bloqueo no existe o no es de tu barbería.");
      if (callerRole === "barber" && existing[0].staff_id !== callerStaffId) throw new OwnAppointmentsOnlyError();

      await client.query(`DELETE FROM blocked_slots WHERE id = $1`, [blockedSlotId]);
      return { id: blockedSlotId };
    });
  }
}
