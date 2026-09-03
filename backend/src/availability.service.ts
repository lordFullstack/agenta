// src/availability.service.ts
import { Pool } from "pg";
import { assertValidAvailabilityRequest, assertWithinBookingWindow, BookingWindowConfig } from "./validation";
import { withTenantContext } from "./db/tenant-context";

export interface Slot {
  start: Date;
  end: Date;
}

export interface AvailabilityRequest {
  tenantId: string;
  barberId: string;
  branchId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
}

export class AvailabilityService {
  constructor(private pool: Pool) {}

  async getAvailableSlots(
    req: AvailabilityRequest,
    config: BookingWindowConfig
  ): Promise<Slot[]> {
    // 1. Validación de forma (sin tocar la DB)
    assertValidAvailabilityRequest(req);

    // 2. Validación de ventana de reserva (redundante con el chequeo dentro de la función SQL,
    //    a propósito — "defense in depth": si la SQL cambia, la API igual protege).
    assertWithinBookingWindow(req.date, new Date(), config);

    // 3. Delegar el cálculo real al motor SQL, dentro del contexto de tenant — la función
    //    consulta `appointments`, que tiene RLS completo (no solo de escritura, ver DEC-015).
    const rows = await withTenantContext(this.pool, req.tenantId, async (client) => {
      const result = await client.query(
        `SELECT slot_start, slot_end
         FROM get_available_slots($1, ARRAY[$2]::uuid[], $3::date, $4, $5, $6)`,
        [req.barberId, req.serviceId, req.date, 15, config.minLeadMinutes, config.maxWindowDays]
      );
      return result.rows;
    });

    return rows.map((r) => ({ start: r.slot_start, end: r.slot_end }));
  }

  /** Variante "cualquiera disponible" — agrega slots de todos los barberos de la sucursal. */
  async getAvailableSlotsAnyStaff(
    tenantId: string,
    branchId: string,
    serviceIds: string[],
    date: string,
    config: BookingWindowConfig
  ): Promise<Array<Slot & { barberId: string }>> {
    const rows = await withTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT staff_id, slot_start, slot_end
         FROM get_available_slots_any_staff($1, $2::uuid[], $3::date, $4, $5)`,
        [branchId, serviceIds, date, 15, config.minLeadMinutes]
      );
      return result.rows;
    });

    return rows.map((r) => ({ barberId: r.staff_id, start: r.slot_start, end: r.slot_end }));
  }
}
