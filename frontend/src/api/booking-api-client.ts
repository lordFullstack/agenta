// frontend/src/api/booking-api-client.ts
//
// Regla de oro de este archivo: la disponibilidad que devuelve el GET es solo para
// pintar la UI. Nunca se usa para decidir si la reserva "va a funcionar" — eso lo
// decide el backend en el POST, siempre.
//
// Regla de oro #2 (desde Loop 06): la identidad de quien actúa (customer_id, etc.) la
// deriva el BACKEND del token verificado — este cliente ya no manda esos campos en el
// body, ni falta que hacerlo: mandarlos sería ignorado por el server de todas formas.

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const REFRESH_TOKEN_STORAGE_KEY = "barberia_refresh_token";

export class NetworkError extends Error {
  constructor(public cause: unknown) {
    super("No pudimos conectarnos. Revisa tu conexión.");
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor() {
    super("La operación tardó demasiado.");
    this.name = "TimeoutError";
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public alternatives?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/** Se lanza cuando una acción requiere sesión y no hay tokens (válidos o refrescables). */
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Necesitas iniciar sesión para continuar.");
    this.name = "NotAuthenticatedError";
  }
}

interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

async function fetchWithTimeout(url: string, options: FetchWithTimeoutOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError") throw new TimeoutError();
    throw new NetworkError(err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reintenta SOLO fallas de transporte (timeout, network failure) — nunca reintenta
 * automáticamente un 409/422/400/401, porque esas son respuestas de negocio válidas
 * (el server SÍ respondió, y reintentar no cambiaría el resultado sin acción del usuario
 * — para el 401 específicamente, la "acción del usuario" es el refresh, manejado aparte).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof NetworkError || err instanceof TimeoutError;
      if (!isRetryable || attempt === maxRetries) throw err;

      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 100; // jitter
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}

async function parseJsonResponse(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "unknown_error", body.message ?? "Error desconocido", body.alternatives);
  }
  return body;
}

export interface Slot {
  start: string;
  end: string;
}

export class BookingApiClient {
  // El access token vive solo en memoria — nunca en localStorage (mitiga robo por XSS
  // leyendo storage). El refresh token SÍ se persiste, porque sin eso el usuario tendría
  // que volver a pedir OTP cada vez que recarga la PWA — ver DEC-018 en DECISIONS_LOG.md
  // para el trade-off completo y por qué se acepta ese riesgo por ahora.
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(private baseUrl: string) {
    this.refreshToken = typeof localStorage !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) : null;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null || this.refreshToken !== null;
  }

  private setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof localStorage !== "undefined") localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof localStorage !== "undefined") localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }

  // ── Auth (Loop 06) ──

  async requestOtp(phone: string, email: string) {
    const res = await withRetry(() =>
      fetchWithTimeout(`${this.baseUrl}/v1/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email }),
      })
    );
    return parseJsonResponse(res);
  }

  async verifyOtp(phone: string, code: string, fullName?: string) {
    const res = await withRetry(() =>
      fetchWithTimeout(`${this.baseUrl}/v1/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, full_name: fullName }),
      })
    );
    const body = await parseJsonResponse(res);
    this.setTokens(body.accessToken, body.refreshToken);
    return body;
  }

  async logout() {
    if (this.accessToken) {
      await this.authenticatedFetch(`${this.baseUrl}/v1/auth/logout`, { method: "POST" }).catch(() => {
        // logout es best-effort del lado servidor (revoca refresh tokens) — si falla por
        // red, igual limpiamos localmente, porque el objetivo del usuario es "salir ya".
      });
    }
    this.clearTokens();
  }

  /**
   * Envuelve `fetchWithTimeout` agregando el header `Authorization`, y si la respuesta
   * es 401 por token expirado, intenta UN refresh y reintenta la request original una
   * sola vez (no en loop — si el refresh también falla, se propaga `NotAuthenticatedError`
   * en vez de reintentar indefinidamente).
   */
  private async authenticatedFetch(url: string, options: FetchWithTimeoutOptions = {}): Promise<Response> {
    if (!this.accessToken && !this.refreshToken) throw new NotAuthenticatedError();

    const withAuthHeader = (token: string | null) => ({
      ...options,
      headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    let res = await fetchWithTimeout(url, withAuthHeader(this.accessToken));

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) {
        this.clearTokens();
        throw new NotAuthenticatedError();
      }
      res = await fetchWithTimeout(url, withAuthHeader(this.accessToken));
    }

    return res;
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken || !this.accessToken) return false;
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken, expired_access_token: this.accessToken }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      this.setTokens(body.accessToken, body.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // ── Catálogo (público, sin auth) ──

  async getBarbershop(slug: string) {
    const res = await withRetry(() => fetchWithTimeout(`${this.baseUrl}/v1/barbershops/${slug}`));
    return parseJsonResponse(res);
  }

  async getServices(tenantId: string) {
    const res = await withRetry(() => fetchWithTimeout(`${this.baseUrl}/v1/barbershops/${tenantId}/services`));
    return parseJsonResponse(res);
  }

  /** Horario general de la sucursal (público) — se muestra en el perfil y alimenta "Abierto ahora". */
  async getBusinessHours(branchId: string) {
    const res = await withRetry(() => fetchWithTimeout(`${this.baseUrl}/v1/branches/${branchId}/business-hours`));
    return parseJsonResponse(res);
  }

  async getStaff(branchId: string, serviceIds: string[]) {
    const qs = new URLSearchParams({ service_ids: serviceIds.join(",") });
    const res = await withRetry(() => fetchWithTimeout(`${this.baseUrl}/v1/branches/${branchId}/staff?${qs}`));
    return parseJsonResponse(res);
  }

  async getAvailability(params: { tenantId: string; barberId: string; branchId: string; serviceId: string; date: string }) {
    const qs = new URLSearchParams({
      tenant_id: params.tenantId,
      barber_id: params.barberId,
      branch_id: params.branchId,
      service_id: params.serviceId,
      date: params.date,
    });
    // Lectura pública: reintentable sin ningún riesgo, no muta nada, no requiere auth.
    const res = await withRetry(() => fetchWithTimeout(`${this.baseUrl}/v1/availability?${qs}`));
    return parseJsonResponse(res) as Promise<{ slots: Slot[]; timezone: string }>;
  }

  // ── Reservas (requieren sesión — Loop 06) ──

  /**
   * Crea la reserva. `idempotencyKey` debe generarse UNA VEZ por intento de reserva
   * del lado del caller (ver `useBookingFlow`) — no acá adentro — para que un retry
   * por timeout/network failure reutilice la misma key y el backend pueda deduplicar.
   * Ya NO se manda `customer_id`/`created_by` — el backend los deriva del token (DEC-017).
   */
  async createAppointment(
    payload: {
      tenantId: string;
      branchId: string;
      barberId: string;
      serviceIds: string[];
      startsAt: string;
      customerNote?: string;
    },
    idempotencyKey: string
  ) {
    const res = await withRetry(() =>
      this.authenticatedFetch(`${this.baseUrl}/v1/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          tenant_id: payload.tenantId,
          branch_id: payload.branchId,
          barber_id: payload.barberId,
          service_ids: payload.serviceIds,
          starts_at: payload.startsAt,
          customer_note: payload.customerNote,
        }),
      })
    );
    return parseJsonResponse(res);
  }

  async cancelAppointment(appointmentId: string, tenantId: string, reason?: string) {
    const res = await withRetry(() =>
      this.authenticatedFetch(`${this.baseUrl}/v1/appointments/${appointmentId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, reason }),
      })
    );
    return parseJsonResponse(res);
  }

  async rescheduleAppointment(
    appointmentId: string,
    tenantId: string,
    newStartsAt: string,
    idempotencyKey: string,
    reason?: string
  ) {
    const res = await withRetry(() =>
      this.authenticatedFetch(`${this.baseUrl}/v1/appointments/${appointmentId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ tenant_id: tenantId, new_starts_at: newStartsAt, reason }),
      })
    );
    return parseJsonResponse(res);
  }
}
