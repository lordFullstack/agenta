// tests/helpers/seed.ts
import { Pool } from "pg";
import { randomUUID } from "crypto";

export interface TestFixture {
  tenantId: string;
  branchId: string;
  staffId: string;
  serviceId: string;
  customerUserId: string;
  customerAId: string;
  customerBId: string;
}

/**
 * Crea el árbol mínimo de datos para probar el motor de disponibilidad de punta a punta:
 * 1 tenant activo, 1 branch activa, 1 barbero activo con horario 24/7 (para no depender
 * de la hora local al correr el test en CI), 1 servicio de 30 min con buffer_after de 10 min,
 * y 2 clientes distintos para simular la carrera de concurrencia.
 */
export async function seedTestBarbershop(pool: Pool): Promise<TestFixture> {
  const ownerUserId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, phone, full_name) VALUES ($1, $2, 'Test Owner')`,
    [ownerUserId, `+549${Date.now()}0`]
  );

  const tenantId = randomUUID();
  await pool.query(
    `INSERT INTO tenants (id, legal_name, trade_name, slug, timezone, is_active, created_by)
     VALUES ($1, 'Test SRL', 'Test Barbershop', $2, 'America/Argentina/Buenos_Aires', true, $3)`,
    [tenantId, `test-${tenantId.slice(0, 8)}`, ownerUserId]
  );

  const branchId = randomUUID();
  await pool.query(
    `INSERT INTO branches (id, tenant_id, name, is_active, created_by)
     VALUES ($1, $2, 'Sucursal Test', true, $3)`,
    [branchId, tenantId, ownerUserId]
  );

  const staffUserId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, phone, full_name) VALUES ($1, $2, 'Barbero Test')`,
    [staffUserId, `+549${Date.now()}1`]
  );

  const staffId = randomUUID();
  await pool.query(
    `INSERT INTO staff_members (id, tenant_id, branch_id, user_id, status, buffer_before_minutes, buffer_after_minutes)
     VALUES ($1, $2, $3, $4, 'active', 0, 10)`,
    [staffId, tenantId, branchId, staffUserId]
  );

  // Horario 24hs para todos los días — evita que el test dependa de la hora en que corre el CI
  for (const day of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) {
    await pool.query(
      `INSERT INTO staff_hours (staff_id, day_of_week, starts_at, ends_at) VALUES ($1, $2, '00:00', '23:59')`,
      [staffId, day]
    );
  }

  const serviceId = randomUUID();
  await pool.query(
    `INSERT INTO services (id, tenant_id, name, base_price, base_duration_minutes, created_by)
     VALUES ($1, $2, 'Corte Test', 2500, 30, $3)`,
    [serviceId, tenantId, ownerUserId]
  );

  await pool.query(
    `INSERT INTO staff_services (staff_id, service_id, is_active) VALUES ($1, $2, true)`,
    [staffId, serviceId]
  );

  const customerUserAId = randomUUID();
  const customerUserBId = randomUUID();
  await pool.query(`INSERT INTO users (id, phone, full_name) VALUES ($1, $2, 'Cliente A')`, [
    customerUserAId,
    `+549${Date.now()}2`,
  ]);
  await pool.query(`INSERT INTO users (id, phone, full_name) VALUES ($1, $2, 'Cliente B')`, [
    customerUserBId,
    `+549${Date.now()}3`,
  ]);

  const customerAId = randomUUID();
  const customerBId = randomUUID();
  await pool.query(`INSERT INTO customers (id, user_id) VALUES ($1, $2)`, [customerAId, customerUserAId]);
  await pool.query(`INSERT INTO customers (id, user_id) VALUES ($1, $2)`, [customerBId, customerUserBId]);

  return {
    tenantId,
    branchId,
    staffId,
    serviceId,
    customerUserId: ownerUserId,
    customerAId,
    customerBId,
  };
}

export async function cleanupTestData(pool: Pool, fixture: TestFixture): Promise<void> {
  // El ON DELETE CASCADE/RESTRICT del schema exige borrar en orden inverso de dependencia
  await pool.query(`DELETE FROM appointments WHERE tenant_id = $1`, [fixture.tenantId]);
  await pool.query(`DELETE FROM staff_services WHERE staff_id = $1`, [fixture.staffId]);
  await pool.query(`DELETE FROM staff_hours WHERE staff_id = $1`, [fixture.staffId]);
  await pool.query(`DELETE FROM services WHERE tenant_id = $1`, [fixture.tenantId]);
  await pool.query(`DELETE FROM customers WHERE id = ANY($1::uuid[])`, [[fixture.customerAId, fixture.customerBId]]);
  await pool.query(`DELETE FROM staff_members WHERE id = $1`, [fixture.staffId]);
  await pool.query(`DELETE FROM branches WHERE id = $1`, [fixture.branchId]);
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [fixture.tenantId]);
}
