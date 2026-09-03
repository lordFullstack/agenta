// src/booking.service.ts
import { Pool, PoolClient } from "pg";
import { AvailabilityService } from "./availability.service";
import { BookingWindowConfig } from "./validation";

// Códigos de error de Postgres relevantes para este servicio
const PG_EXCLUSION_VIOLATION = "23P01"; // solapamiento de citas (double booking / buffer)
const PG_RAISE_EXCEPTION = "P0001"; // usado por los triggers de negocio (bloqueos, transición de estado inválida)

export class SlotNoLongerAvailableError extends Error {
  constructor(public alternatives: Array<{ start: Date; end: Date }>) {
    super("El horario elegido ya no está disponible.");
    this.name = "SlotNoLongerAvailableError";
  }
}

export class ValidationConflict extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ValidationConflict";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStatusTransitionError";
  }
}

export class CancellationWindowError extends Error {
  constructor(public minutesRequired: number) {
    super(`La cita no puede cancelarse a menos de ${minutesRequired} minutos de su horario.`);
    this.name = "CancellationWindowError";
  }
}

export interface CreateAppointmentInput {
  tenantId: string;
  branchId: string;
  barberId: string;
  customerId: string;
  serviceIds: string[];
  startsAt: Date;
  createdBy: string;
  idempotencyKey: string;
  customerNote?: string;
}

export interface RescheduleInput {
  tenantId: string;
  appointmentId: string;
  newStartsAt: Date;
  rescheduledBy: string;
  reason?: string;
  idempotencyKey: string;
}

export interface CancelInput {
  tenantId: string;
  appointmentId: string;
  cancelledBy: string;
  reason?: string;
  minCancellationLeadMinutes?: number;
}

export class BookingService {
  constructor(
    private pool: Pool,
    private availability: AvailabilityService,
    private config: BookingWindowConfig
  ) {}

  // ─────────────────────────────────────────────────────────
  // PASOS 9-13: crear cita, con re-validación real, confirmación y notificación
  // ─────────────────────────────────────────────────────────
  async createAppointment(input: CreateAppointmentInput) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Activa RLS para esta transacción — resuelve ISSUE-003. SET LOCAL se resetea
      // solo al COMMIT/ROLLBACK, no persiste en la conexión física del pool.
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [input.tenantId]);

      // Idempotencia: se chequea DENTRO de la transacción con contexto de tenant ya
      // seteado — si se chequeara antes de abrir la transacción, la lectura de
      // `appointments` (que tiene RLS completo, no solo de escritura) devolvería 0 filas
      // sin importar si la cita existe, rompiendo la deduplicación silenciosamente.
      const existing = await this.findByIdempotencyKey(client, input.idempotencyKey);
      if (existing) {
        await client.query("COMMIT");
        return existing;
      }

      // Paso 9: re-validación real — nunca se confía en lo que el frontend calculó en el paso 5-6
      const durationResult = await client.query(
        `SELECT resolve_appointment_duration($1, $2::uuid[]) AS duration`,
        [input.barberId, input.serviceIds]
      );
      const duration = durationResult.rows[0]?.duration;
      if (duration == null) {
        throw new ValidationConflict(
          "service_not_offered",
          "El barbero no ofrece uno o más de los servicios seleccionados."
        );
      }

      const endsAt = new Date(input.startsAt.getTime() + duration * 60 * 1000);

      const priceResult = await client.query(
        `SELECT COALESCE(SUM(COALESCE(ss.price_override, s.base_price)), 0) AS total
         FROM services s
         LEFT JOIN staff_services ss ON ss.service_id = s.id AND ss.staff_id = $1
         WHERE s.id = ANY($2::uuid[])`,
        [input.barberId, input.serviceIds]
      );
      const priceTotal = priceResult.rows[0].total;

      // Paso 10: crear la reserva. El constraint EXCLUDE (double booking + buffer) y el trigger
      // de bloqueos/vacaciones se evalúan acá — es el único lugar que realmente decide.
      // Paso 11: el número de confirmación se genera solo, en el trigger BEFORE INSERT.
      const insertResult = await client.query(
        `INSERT INTO appointments
           (tenant_id, branch_id, staff_id, customer_id, starts_at, ends_at, status, price_total, customer_note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
         RETURNING id, starts_at, ends_at, status, confirmation_code`,
        [input.tenantId, input.branchId, input.barberId, input.customerId, input.startsAt, endsAt, priceTotal, input.customerNote ?? null, input.createdBy]
      );
      const appointment = insertResult.rows[0];

      await client.query(
        `INSERT INTO appointment_items (appointment_id, service_id, service_name_snapshot, unit_price, duration_minutes)
         SELECT $1, s.id, s.name, COALESCE(ss.price_override, s.base_price), COALESCE(ss.duration_override_minutes, s.base_duration_minutes)
         FROM services s
         LEFT JOIN staff_services ss ON ss.service_id = s.id AND ss.staff_id = $2
         WHERE s.id = ANY($3::uuid[])`,
        [appointment.id, input.barberId, input.serviceIds]
      );

      // Paso 13: la notificación se ENCOLA en la misma transacción (garantiza que si la cita
      // existe, la intención de notificar también quedó registrada) — el ENVÍO real es async
      // y su falla no revierte la reserva (por eso va en tabla aparte, no en un side-effect acá).
      await client.query(
        `INSERT INTO notifications (tenant_id, appointment_id, type, payload)
         VALUES ($1, $2, 'confirmation', $3::jsonb)`,
        [
          input.tenantId,
          appointment.id,
          JSON.stringify({ confirmationCode: appointment.confirmation_code, startsAt: appointment.starts_at }),
        ]
      );

      await this.saveIdempotencyKey(client, input.idempotencyKey, appointment.id);
      await client.query("COMMIT");

      return appointment;
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw await this.translateBookingError(err, {
        tenantId: input.tenantId,
        barberId: input.barberId,
        branchId: input.branchId,
        serviceId: input.serviceIds[0],
        date: input.startsAt.toISOString().slice(0, 10),
      });
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────
  // CANCELACIÓN
  // ─────────────────────────────────────────────────────────
  async cancelAppointment(input: CancelInput) {
    const minLead = input.minCancellationLeadMinutes ?? 120; // default: 2h, configurable por tenant

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [input.tenantId]);

      const { rows } = await client.query(
        `SELECT id, starts_at, status, tenant_id FROM appointments WHERE id = $1 FOR UPDATE`,
        [input.appointmentId]
      );
      if (rows.length === 0) {
        throw new ValidationConflict("not_found", "La cita no existe.");
      }
      const current = rows[0];

      const minutesUntilStart = (new Date(current.starts_at).getTime() - Date.now()) / 60000;
      if (minutesUntilStart < minLead && minutesUntilStart >= 0) {
        throw new CancellationWindowError(minLead);
      }

      // El trigger de máquina de estados valida que la transición sea legal
      // (ej. no se puede cancelar una cita 'completed').
      const updateResult = await client.query(
        `UPDATE appointments
         SET status = 'cancelled', cancellation_reason = $2, updated_by = $3
         WHERE id = $1
         RETURNING id, status`,
        [input.appointmentId, input.reason ?? null, input.cancelledBy]
      );

      await client.query(
        `INSERT INTO notifications (tenant_id, appointment_id, type, payload)
         VALUES ($1, $2, 'cancellation', $3::jsonb)`,
        [current.tenant_id, input.appointmentId, JSON.stringify({ reason: input.reason ?? null })]
      );

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err instanceof CancellationWindowError || err instanceof ValidationConflict) throw err;
      if (err.code === PG_RAISE_EXCEPTION) {
        throw new InvalidStatusTransitionError(err.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────
  // REPROGRAMACIÓN — conserva el mismo id de cita, no crea una nueva
  // ─────────────────────────────────────────────────────────
  async rescheduleAppointment(input: RescheduleInput) {
    const client = await this.pool.connect();
    let currentStaffId: string | undefined;
    let currentBranchId: string | undefined;
    let currentServiceId: string | undefined;

    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [input.tenantId]);

      const existing = await this.findByIdempotencyKey(client, input.idempotencyKey);
      if (existing) {
        await client.query("COMMIT");
        return existing;
      }

      const { rows } = await client.query(
        `SELECT a.id, a.staff_id, a.starts_at, a.ends_at, a.status, a.tenant_id, a.branch_id,
                EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 60 AS duration_minutes
         FROM appointments a WHERE a.id = $1 FOR UPDATE`,
        [input.appointmentId]
      );
      if (rows.length === 0) throw new ValidationConflict("not_found", "La cita no existe.");
      const current = rows[0];
      // Se guardan afuera del alcance del try para que el catch pueda armar alternativas
      // reales si el UPDATE choca contra el constraint EXCLUDE (bug previo: usaba
      // `err.staffId`, que nunca existió — las alternativas quedaban siempre vacías).
      currentStaffId = current.staff_id;
      currentBranchId = current.branch_id;

      if (!["pending", "confirmed"].includes(current.status)) {
        throw new InvalidStatusTransitionError(
          `No se puede reprogramar una cita en estado '${current.status}'.`
        );
      }

      const itemsResult = await client.query(
        `SELECT service_id FROM appointment_items WHERE appointment_id = $1 LIMIT 1`,
        [input.appointmentId]
      );
      currentServiceId = itemsResult.rows[0]?.service_id;

      const newEndsAt = new Date(input.newStartsAt.getTime() + current.duration_minutes * 60 * 1000);

      // El UPDATE pasa otra vez por el constraint EXCLUDE — mismo mecanismo anti double-booking
      // que en la creación, no una versión "más liviana" para el caso de reprogramar.
      const updateResult = await client.query(
        `UPDATE appointments
         SET starts_at = $2, ends_at = $3, updated_by = $4
         WHERE id = $1
         RETURNING id, starts_at, ends_at, status, confirmation_code`,
        [input.appointmentId, input.newStartsAt, newEndsAt, input.rescheduledBy]
      );
      const updated = updateResult.rows[0];

      await client.query(
        `INSERT INTO appointment_reschedules
           (appointment_id, previous_starts_at, previous_ends_at, new_starts_at, new_ends_at, reason, rescheduled_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [input.appointmentId, current.starts_at, current.ends_at, input.newStartsAt, newEndsAt, input.reason ?? null, input.rescheduledBy]
      );

      await client.query(
        `INSERT INTO notifications (tenant_id, appointment_id, type, payload)
         VALUES ($1, $2, 'reschedule', $3::jsonb)`,
        [current.tenant_id, input.appointmentId, JSON.stringify({ newStartsAt: input.newStartsAt })]
      );

      await this.saveIdempotencyKey(client, input.idempotencyKey, updated.id);
      await client.query("COMMIT");
      return updated;
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw await this.translateBookingError(err, {
        tenantId: input.tenantId,
        barberId: currentStaffId ?? "",
        branchId: currentBranchId ?? "",
        serviceId: currentServiceId ?? "",
        date: input.newStartsAt.toISOString().slice(0, 10),
      });
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────
  // Traduce errores de Postgres a errores de dominio — un solo lugar,
  // usado tanto por create como por reschedule (ambos pueden chocar con EXCLUDE).
  // ─────────────────────────────────────────────────────────
  private async translateBookingError(
    err: any,
    context: { tenantId: string; barberId: string; branchId: string; serviceId: string; date: string }
  ): Promise<Error> {
    if (err instanceof ValidationConflict || err instanceof InvalidStatusTransitionError) {
      return err;
    }
    if (err.code === PG_EXCLUSION_VIOLATION) {
      const alternatives = context.barberId
        ? await this.availability.getAvailableSlots(context, this.config)
        : [];
      return new SlotNoLongerAvailableError(alternatives);
    }
    if (err.code === PG_RAISE_EXCEPTION) {
      // mensajes de los triggers de bloqueos/vacaciones/transición de estado
      return new ValidationConflict("business_rule_violation", err.message);
    }
    return err;
  }

  private async findByIdempotencyKey(client: PoolClient, key: string) {
    const { rows } = await client.query(`SELECT appointment_id FROM idempotency_keys WHERE key = $1`, [key]);
    if (rows.length === 0) return null;

    const { rows: appt } = await client.query(
      `SELECT id, starts_at, ends_at, status, confirmation_code FROM appointments WHERE id = $1`,
      [rows[0].appointment_id]
    );
    return appt[0] ?? null;
  }

  private async saveIdempotencyKey(client: PoolClient, key: string, appointmentId: string) {
    await client.query(
      `INSERT INTO idempotency_keys (key, appointment_id, created_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO NOTHING`,
      [key, appointmentId]
    );
  }
}
