// src/db/tenant-context.ts
import { Pool, PoolClient } from "pg";

/**
 * Ejecuta `fn` dentro de una transacción con `app.tenant_id` seteado vía `SET LOCAL`
 * (a través de `set_config(..., true)`, donde `true` = local a la transacción).
 *
 * Por qué `SET LOCAL` y no `SET`: las conexiones del pool se reutilizan entre requests.
 * `SET` persistiría el valor en la conexión física más allá de esta request, filtrando
 * el tenant de un usuario hacia el siguiente que tome esa misma conexión del pool.
 * `SET LOCAL` (via `set_config(name, value, is_local=true)`) se resetea automáticamente
 * al hacer COMMIT/ROLLBACK — no hay forma de que se filtre entre requests.
 *
 * Esto es lo que hace que las políticas RLS de las migraciones 002-011 y 014 funcionen
 * de verdad en runtime, no solo en el papel (resuelve ISSUE-003 de KNOWN_ISSUES.md).
 */
export async function withTenantContext<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Variante de solo lectura — misma garantía de aislamiento por transacción,
 * pero documenta la intención de no mutar nada (evita `BEGIN`/`COMMIT` innecesarios
 * en queries de un solo `SELECT` si el caller prefiere no pagar el costo de una
 * transacción explícita). Internamente sigue usando una transacción corta porque
 * `SET LOCAL` solo tiene efecto dentro de una — no hay atajo sin transacción.
 */
export async function withTenantContextReadOnly<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withTenantContext(pool, tenantId, fn);
}
