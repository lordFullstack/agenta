// src/catalog.service.ts
import { Pool } from "pg";

export interface BarbershopProfile {
  id: string;
  tradeName: string;
  slug: string;
  timezone: string;
  branchId: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  baseDurationMinutes: number;
}

export interface StaffOption {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  price: number;
  durationMinutes: number;
}

export class CatalogService {
  constructor(private pool: Pool) {}

  /** Paso 1: perfil público de la barbería por slug. */
  async getBarbershopBySlug(slug: string): Promise<BarbershopProfile | null> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.trade_name, t.slug, t.timezone, b.id AS branch_id
       FROM tenants t
       JOIN branches b ON b.tenant_id = t.id AND b.is_active
       WHERE t.slug = $1 AND t.is_active AND t.deleted_at IS NULL
       LIMIT 1`,
      [slug]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return { id: r.id, tradeName: r.trade_name, slug: r.slug, timezone: r.timezone, branchId: r.branch_id };
  }

  /** Paso 2: servicios activos de la barbería. */
  async getServices(tenantId: string): Promise<ServiceOption[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, base_price, base_duration_minutes
       FROM services
       WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL
       ORDER BY sort_order, name`,
      [tenantId]
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      basePrice: Number(r.base_price),
      baseDurationMinutes: r.base_duration_minutes,
    }));
  }

  /** Paso 3: barberos que ofrecen el/los servicio(s) elegidos, con precio resuelto (override o base). */
  async getStaffForServices(branchId: string, serviceIds: string[]): Promise<StaffOption[]> {
    const { rows } = await this.pool.query(
      `SELECT sm.id, u.full_name, u.avatar_url,
              SUM(COALESCE(ss.price_override, s.base_price)) AS price,
              SUM(COALESCE(ss.duration_override_minutes, s.base_duration_minutes)) AS duration_minutes
       FROM staff_members sm
       JOIN users u ON u.id = sm.user_id
       JOIN staff_services ss ON ss.staff_id = sm.id AND ss.is_active
       JOIN services s ON s.id = ss.service_id AND s.deleted_at IS NULL
       WHERE sm.branch_id = $1
         AND sm.status = 'active'
         AND sm.deleted_at IS NULL
         AND ss.service_id = ANY($2::uuid[])
       GROUP BY sm.id, u.full_name, u.avatar_url
       HAVING COUNT(DISTINCT ss.service_id) = $3
       ORDER BY u.full_name`,
      [branchId, serviceIds, serviceIds.length]
    );
    return rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      price: Number(r.price),
      durationMinutes: r.duration_minutes,
    }));
  }
}
