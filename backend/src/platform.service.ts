// src/platform.service.ts
//
// Fondos de la plataforma (inicio y búsqueda del cliente) y quién puede cambiarlos.
// "Administrador de la plataforma" no es un rol de la base de datos: es el/los usuarios
// cuyo teléfono figura en PLATFORM_ADMIN_PHONES — así un dueño de barbería cualquiera,
// aunque pueda entrar a Configuración, no puede tocar lo que ven todos los clientes.
import { Pool } from "pg";

export const BRANDING_SLOTS = ["hero", "search_bg"] as const;
export type BrandingSlot = (typeof BRANDING_SLOTS)[number];

export function isBrandingSlot(value: string): value is BrandingSlot {
  return (BRANDING_SLOTS as readonly string[]).includes(value);
}

export interface PlatformBranding {
  hero: string | null;
  searchBg: string | null;
}

/** Deja solo los dígitos: "+57 300 111-2233" y "573001112233" son el mismo teléfono. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function parseAdminPhones(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map(normalizePhone)
    .filter((p) => p.length >= 7);
}

export class PlatformService {
  private adminPhones: string[];

  constructor(private pool: Pool, adminPhones: string[] = parseAdminPhones(process.env.PLATFORM_ADMIN_PHONES)) {
    this.adminPhones = adminPhones;
  }

  async getBranding(): Promise<PlatformBranding> {
    const { rows } = await this.pool.query(`SELECT slot, image_url FROM platform_branding`);
    const bySlot = new Map<string, string>(rows.map((r: any) => [r.slot, r.image_url]));
    return { hero: bySlot.get("hero") ?? null, searchBg: bySlot.get("search_bg") ?? null };
  }

  async setBranding(slot: BrandingSlot, imageUrl: string, userId: string): Promise<PlatformBranding> {
    await this.pool.query(
      `INSERT INTO platform_branding (slot, image_url, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (slot) DO UPDATE SET image_url = EXCLUDED.image_url, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [slot, imageUrl, userId]
    );
    return this.getBranding();
  }

  /** Vuelve a la imagen por defecto del frontend. */
  async clearBranding(slot: BrandingSlot): Promise<PlatformBranding> {
    await this.pool.query(`DELETE FROM platform_branding WHERE slot = $1`, [slot]);
    return this.getBranding();
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    if (this.adminPhones.length === 0) return false;
    const { rows } = await this.pool.query(`SELECT phone FROM users WHERE id = $1`, [userId]);
    const phone = rows[0]?.phone as string | null | undefined;
    return !!phone && this.adminPhones.includes(normalizePhone(phone));
  }
}
