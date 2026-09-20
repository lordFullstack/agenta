// src/profile-links.ts
// Validación y normalización de los datos de contacto del perfil público de una barbería
// (dirección, Instagram, Facebook, descripción). Todo lo que sale de acá es seguro para
// mostrarse como enlace: las redes siempre terminan en https://www.instagram.com/... o
// https://www.facebook.com/..., nunca en una URL arbitraria (evita `javascript:` y phishing).

export class InvalidProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProfileError";
  }
}

const MAX_ADDRESS = 200;
const MAX_DESCRIPTION = 500;

const INSTAGRAM_HOSTS = ["instagram.com", "www.instagram.com", "instagr.am"];
const FACEBOOK_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "www.fb.com"];
const INSTAGRAM_RESERVED = ["p", "reel", "reels", "explore", "accounts", "stories", "tv"];

function clean(raw: unknown, what: string): string {
  if (typeof raw !== "string") throw new InvalidProfileError(`${what} no es válido.`);
  return raw.replace(/\s+/g, " ").trim();
}

function parseUrl(value: string): URL | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** Dirección del local, tal como la buscaría alguien en Google Maps. null/"" = borrarla. */
export function normalizeAddress(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = clean(raw, "La dirección");
  if (!value) return null;
  if (value.length > MAX_ADDRESS) {
    throw new InvalidProfileError(`La dirección es muy larga (máximo ${MAX_ADDRESS} caracteres).`);
  }
  return value;
}

/** "Sobre tu barbería". Conserva los saltos de línea; "" es válido (la borra). */
export function normalizeDescription(raw: unknown): string {
  if (typeof raw !== "string") throw new InvalidProfileError("La descripción no es válida.");
  const value = raw.replace(/\r\n/g, "\n").trim();
  if (value.length > MAX_DESCRIPTION) {
    throw new InvalidProfileError(`La descripción es muy larga (máximo ${MAX_DESCRIPTION} caracteres).`);
  }
  return value;
}

/** "@barberia_elsocio", "barberia_elsocio" o el enlace del perfil → URL canónica. null/"" = borrarlo. */
export function normalizeInstagram(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = clean(raw, "El Instagram");
  if (!value) return null;
  const invalid = new InvalidProfileError("El Instagram no es válido. Escribe @tuusuario o pega el enlace de tu perfil.");

  const handlePattern = /^[A-Za-z0-9._]{1,30}$/;
  const bare = value.replace(/^@/, "");
  if (handlePattern.test(bare) && !INSTAGRAM_HOSTS.includes(bare.toLowerCase())) {
    return `https://www.instagram.com/${bare}`;
  }

  const url = parseUrl(value);
  if (!url || !INSTAGRAM_HOSTS.includes(url.hostname.toLowerCase())) throw invalid;
  const handle = url.pathname.split("/").filter(Boolean)[0];
  if (!handle || !handlePattern.test(handle) || INSTAGRAM_RESERVED.includes(handle.toLowerCase())) throw invalid;
  return `https://www.instagram.com/${handle}`;
}

/** Nombre de la página o enlace de Facebook → URL canónica. null/"" = borrarlo. */
export function normalizeFacebook(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = clean(raw, "El Facebook");
  if (!value) return null;
  const invalid = new InvalidProfileError("El Facebook no es válido. Pega el enlace de tu página o escribe su nombre de usuario.");

  const handlePattern = /^[A-Za-z0-9.]{5,50}$/;
  const bare = value.replace(/^@/, "");
  if (handlePattern.test(bare) && !FACEBOOK_HOSTS.includes(bare.toLowerCase())) {
    return `https://www.facebook.com/${bare}`;
  }

  const url = parseUrl(value);
  if (!url || !FACEBOOK_HOSTS.includes(url.hostname.toLowerCase())) throw invalid;
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "/profile.php") {
    const id = url.searchParams.get("id");
    if (!id || !/^\d{1,30}$/.test(id)) throw invalid;
    return `https://www.facebook.com/profile.php?id=${id}`;
  }
  if (!path || !/^\/[A-Za-z0-9._\-\/%]{1,150}$/.test(path)) throw invalid;
  return `https://www.facebook.com${path}`;
}
