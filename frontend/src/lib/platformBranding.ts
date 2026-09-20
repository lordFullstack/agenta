// frontend/src/lib/platformBranding.ts
// Fondos de la plataforma (inicio y búsqueda). Los sube el administrador desde Configuración
// y se sirven por GET /v1/platform/branding. Si no hay ninguno cargado —o el servidor no
// responde— se usan las imágenes por defecto de /public/img (o el degradado si tampoco están).
import { useEffect, useState } from "react";

export interface PlatformBranding {
  hero: string | null;
  searchBg: string | null;
}

export const DEFAULT_BRANDING = { hero: "/img/hero.jpg", searchBg: "/img/search-bg.jpg" } as const;

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000";
const CACHE_KEY = "agenta_platform_branding_v1";

// Se recuerda la última respuesta para no mostrar el fondo por defecto un instante
// mientras llega la del servidor.
function readCache(): PlatformBranding | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as PlatformBranding) : null;
  } catch {
    return null;
  }
}

function writeCache(b: PlatformBranding) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    // sin localStorage: no pasa nada, solo se pierde el caché.
  }
}

export async function fetchPlatformBranding(): Promise<PlatformBranding> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_URL}/v1/platform/branding`, { signal: controller.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const { branding } = await res.json();
    return { hero: branding?.hero ?? null, searchBg: branding?.searchBg ?? null };
  } finally {
    clearTimeout(timer);
  }
}

/** URLs listas para usar: la subida por el admin o, si no hay, la imagen por defecto. */
export function usePlatformBranding(): { hero: string; searchBg: string } {
  const [branding, setBranding] = useState<PlatformBranding>(() => readCache() ?? { hero: null, searchBg: null });

  useEffect(() => {
    let cancelled = false;
    fetchPlatformBranding()
      .then((b) => {
        if (cancelled) return;
        writeCache(b);
        setBranding(b);
      })
      .catch(() => {
        // Sin conexión o backend viejo sin este endpoint: se queda con lo que había.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { hero: branding.hero ?? DEFAULT_BRANDING.hero, searchBg: branding.searchBg ?? DEFAULT_BRANDING.searchBg };
}
