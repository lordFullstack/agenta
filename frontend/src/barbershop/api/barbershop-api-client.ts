// frontend/src/barbershop/api/barbershop-api-client.ts
//
// Cliente separado del de la app de cliente (booking-api-client.ts) a propósito: son dos
// superficies distintas de la misma plataforma, con sesiones independientes — un owner no
// necesariamente es cliente de su propia barbería, y viceversa.

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const REFRESH_TOKEN_STORAGE_KEY = "barberia_staff_refresh_token";

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
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Necesitas iniciar sesión para continuar.");
    this.name = "NotAuthenticatedError";
  }
}

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof NetworkError || err instanceof TimeoutError;
      if (!retryable || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 100));
    }
  }
  throw lastError;
}

async function parseJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "unknown_error", body.message ?? "Error desconocido");
  return body;
}

export interface StaffSession {
  role: "owner" | "branch_admin" | "barber";
  tenantId?: string;
  staffId?: string;
}

export class BarbershopApiClient {
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

  /** Decodifica el payload del JWT (sin verificar firma — solo para leer campos en el cliente). */
  getSession(): StaffSession | null {
    if (!this.accessToken) return null;
    try {
      const payload = JSON.parse(atob(this.accessToken.split(".")[1]));
      return { role: payload.role, tenantId: payload.tenantId, staffId: payload.staffId };
    } catch {
      return null;
    }
  }

  // ── Auth ──

  async login(identifier: string, password: string) {
    const res = await withRetry(() =>
      fetchWithTimeout(`${this.baseUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })
    );
    const body = await parseJson(res);
    this.setTokens(body.accessToken, body.refreshToken);
    return body;
  }

  async registerBarbershop(input: {
    ownerPhone: string;
    ownerPassword: string;
    ownerFullName?: string;
    tradeName: string;
    legalName: string;
    timezone?: string;
  }) {
    const res = await withRetry(() =>
      fetchWithTimeout(`${this.baseUrl}/v1/business/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_phone: input.ownerPhone,
          owner_password: input.ownerPassword,
          owner_full_name: input.ownerFullName,
          trade_name: input.tradeName,
          legal_name: input.legalName,
          timezone: input.timezone,
        }),
      })
    );
    const body = await parseJson(res);
    this.setTokens(body.accessToken, body.refreshToken);
    return body;
  }

  async logout() {
    if (this.accessToken) {
      await this.authFetch(`${this.baseUrl}/v1/auth/logout`, { method: "POST" }).catch(() => {});
    }
    this.clearTokens();
  }

  private async authFetch(url: string, options: FetchOptions = {}): Promise<Response> {
    if (!this.accessToken && !this.refreshToken) throw new NotAuthenticatedError();
    const withAuth = (token: string | null) => ({
      ...options,
      headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    let res = await fetchWithTimeout(url, withAuth(this.accessToken));
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) {
        this.clearTokens();
        throw new NotAuthenticatedError();
      }
      res = await fetchWithTimeout(url, withAuth(this.accessToken));
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

  private async authJson(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>) {
    const res = await withRetry(() =>
      this.authFetch(`${this.baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    );
    if (res.status === 204) return null;
    return parseJson(res);
  }

  /** Como authJson, pero para multipart/form-data — nunca fijar Content-Type acá,
   * el browser arma el boundary solo. */
  private async authUpload(method: string, path: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await withRetry(() => this.authFetch(`${this.baseUrl}${path}`, { method, body: form }));
    return parseJson(res);
  }

  // ── Negocio (Loop 07) ──
  /** Sucursal principal del caller — evita que el owner tenga que saber/escribir su branchId. */
  getMyBranch(): Promise<{ branch: { id: string; name: string } }> {
    return this.authJson("GET", "/v1/admin/my-branch");
  }
  // ── Fondos de la plataforma (solo el administrador de la plataforma) ──
  getPlatformAdminStatus(): Promise<{ isPlatformAdmin: boolean }> {
    return this.authJson("GET", "/v1/platform/admin-status");
  }
  getPlatformBranding(): Promise<{ branding: { hero: string | null; searchBg: string | null } }> {
    return fetchWithTimeout(`${this.baseUrl}/v1/platform/branding`).then(parseJson);
  }
  uploadPlatformImage(slot: "hero" | "search_bg", file: File) {
    return this.authUpload("PUT", `/v1/platform/branding/${slot}`, file);
  }
  removePlatformImage(slot: "hero" | "search_bg") {
    return this.authJson("DELETE", `/v1/platform/branding/${slot}`);
  }

  uploadTenantLogo(tenantId: string, file: File) {
    return this.authUpload("PUT", `/v1/tenants/${tenantId}/logo`, file);
  }
  uploadTenantCover(tenantId: string, file: File) {
    return this.authUpload("PUT", `/v1/tenants/${tenantId}/cover`, file);
  }
  uploadStaffPhoto(staffId: string, file: File) {
    return this.authUpload("PUT", `/v1/admin/staff/${staffId}/photo`, file);
  }
  getTenantProfile(tenantId: string) {
    return this.authJson("GET", `/v1/tenants/${tenantId}`);
  }
  /** Lo que no se manda no se toca. En dirección y redes, "" las borra. */
  updateTenantProfile(
    tenantId: string,
    updates: { tradeName?: string; description?: string; timezone?: string; address?: string; instagram?: string; facebook?: string }
  ) {
    return this.authJson("PUT", `/v1/tenants/${tenantId}`, {
      trade_name: updates.tradeName,
      description: updates.description,
      timezone: updates.timezone,
      address: updates.address,
      instagram: updates.instagram,
      facebook: updates.facebook,
    });
  }
  getBusinessHours(branchId: string) {
    return fetchWithTimeout(`${this.baseUrl}/v1/branches/${branchId}/business-hours`).then(parseJson);
  }
  setBusinessHours(branchId: string, hours: Array<{ dayOfWeek: string; opensAt: string; closesAt: string }>) {
    // OJO: el backend (BusinessService.setBusinessHours) espera camelCase acá — la ruta
    // pasa req.body.hours directo sin transformar, a diferencia del resto de la API que
    // usa snake_case. Inconsistencia real del contrato existente, no un capricho — ver
    // API_CONTRACTS.md. No "corregir" esto sin actualizar también el backend.
    return this.authJson("PUT", `/v1/branches/${branchId}/business-hours`, { hours });
  }
  setBranchActive(branchId: string, isActive: boolean) {
    return this.authJson("PUT", `/v1/branches/${branchId}/active`, { is_active: isActive });
  }

  // ── Catálogo — servicios (Loop 08) ──
  createService(input: { name: string; description?: string; category?: string; base_price: number; base_duration_minutes: number }) {
    return this.authJson("POST", "/v1/admin/services", input);
  }
  updateService(serviceId: string, updates: Partial<{ name: string; description: string; category: string; base_price: number; base_duration_minutes: number }>) {
    return this.authJson("PUT", `/v1/admin/services/${serviceId}`, updates);
  }
  deactivateService(serviceId: string) {
    return this.authJson("DELETE", `/v1/admin/services/${serviceId}`);
  }

  // ── Catálogo — barberos (Loop 08) ──
  listStaff() {
    return this.authJson("GET", "/v1/admin/staff");
  }
  getStaffServices(staffId: string) {
    return this.authJson("GET", `/v1/admin/staff/${staffId}/services`);
  }
  inviteStaff(input: { phone: string; full_name: string; temp_password: string; branch_id: string }) {
    return this.authJson("POST", "/v1/admin/staff", input);
  }
  updateStaff(staffId: string, updates: Partial<{ bio: string; status: string; buffer_before_minutes: number; buffer_after_minutes: number; accepts_walk_ins: boolean }>) {
    return this.authJson("PUT", `/v1/admin/staff/${staffId}`, updates);
  }
  assignServiceToStaff(staffId: string, serviceId: string, overrides: { price_override?: number; duration_override_minutes?: number }) {
    return this.authJson("PUT", `/v1/admin/staff/${staffId}/services/${serviceId}`, overrides);
  }
  removeServiceFromStaff(staffId: string, serviceId: string) {
    return this.authJson("DELETE", `/v1/admin/staff/${staffId}/services/${serviceId}`);
  }
  setStaffHours(staffId: string, hours: Array<{ dayOfWeek: string; startsAt: string; endsAt: string }>) {
    return this.authJson("PUT", `/v1/admin/staff/${staffId}/hours`, { hours });
  }
  addTimeOff(staffId: string, input: { starts_on: string; ends_on: string; reason?: string; note?: string }) {
    return this.authJson("POST", `/v1/admin/staff/${staffId}/time-off`, input);
  }
  cancelTimeOff(timeOffId: string) {
    return this.authJson("DELETE", `/v1/admin/time-off/${timeOffId}`);
  }

  // ── Agenda (Loop 12) ──
  getAgenda(branchId: string, date: string, staffId?: string) {
    const qs = new URLSearchParams({ branch_id: branchId, date, ...(staffId ? { staff_id: staffId } : {}) });
    return this.authJson("GET", `/v1/admin/agenda?${qs}`);
  }
  updateAppointmentStatus(appointmentId: string, status: string) {
    return this.authJson("PUT", `/v1/admin/appointments/${appointmentId}/status`, { status });
  }
  recordPayment(appointmentId: string, input: { amount: number; method: string; paid_at?: string }) {
    return this.authJson("POST", `/v1/admin/appointments/${appointmentId}/payment`, input);
  }
  createWalkIn(input: { branch_id: string; staff_id: string; customer_phone: string; customer_full_name?: string; service_ids: string[]; starts_at: string }) {
    return this.authJson("POST", "/v1/admin/walk-ins", input);
  }
  addBlockedSlot(input: { branch_id: string; staff_id?: string; starts_at: string; ends_at: string; reason?: string; note?: string }) {
    return this.authJson("POST", "/v1/admin/blocked-slots", input);
  }
  removeBlockedSlot(blockedSlotId: string) {
    return this.authJson("DELETE", `/v1/admin/blocked-slots/${blockedSlotId}`);
  }

  // ── Catálogo de solo lectura (reutilizable — mismo endpoint público que usa el cliente) ──
  getServices(tenantId: string) {
    return fetchWithTimeout(`${this.baseUrl}/v1/barbershops/${tenantId}/services`).then(parseJson);
  }
}
