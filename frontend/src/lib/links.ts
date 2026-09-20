// frontend/src/lib/links.ts
// Enlaces externos del perfil de la barbería.

/**
 * "Cómo llegar": abre Google Maps (app o web) con la ruta hacia la dirección, calculada desde
 * donde esté el cliente. No necesita API key: es el enlace universal de Google Maps.
 */
export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Solo http(s): nunca ponemos como href algo tipo `javascript:` aunque llegue de la base. */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
