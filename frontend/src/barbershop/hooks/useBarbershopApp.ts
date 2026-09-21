// frontend/src/barbershop/hooks/useBarbershopApp.ts
import { useCallback, useEffect, useState } from "react";
import { BarbershopApiClient, ApiError, NotAuthenticatedError, StaffSession } from "../api/barbershop-api-client";

export type Screen = "login" | "dashboard" | "agenda" | "services" | "staff" | "settings";

export interface AppointmentRow {
  id: string;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  confirmation_code: string;
  customer_name: string;
  customer_phone: string;
  price_total: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_paid_at: string | null;
}

export function useBarbershopApp(api: BarbershopApiClient, branchId: string) {
  const [session, setSession] = useState<StaffSession | null>(api.getSession());
  const [screen, setScreen] = useState<Screen>(session ? "dashboard" : "login");
  const [loginError, setLoginError] = useState<string | undefined>();
  const [agenda, setAgenda] = useState<AppointmentRow[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();

  // Servicios
  const [services, setServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Barberos
  const [staff, setStaff] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Configuración
  const [tenant, setTenant] = useState<any | null>(null);
  const [businessHours, setBusinessHoursState] = useState<any[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | undefined>();
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Fondos de la plataforma — la sección solo aparece para el administrador de la plataforma
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [platformBranding, setPlatformBranding] = useState<{ hero: string | null; searchBg: string | null }>({ hero: null, searchBg: null });

  const login = useCallback(
    async (identifier: string, password: string) => {
      setLoginError(undefined);
      try {
        await api.login(identifier, password);
        const s = api.getSession();
        setSession(s);
        setScreen("dashboard");
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "No pudimos conectarnos. Prueba de nuevo.");
      }
    },
    [api]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setSession(null);
    setScreen("login");
  }, [api]);

  const loadAgenda = useCallback(
    async (date: string, staffId?: string) => {
      setAgendaLoading(true);
      setAgendaError(undefined);
      try {
        const { appointments } = await api.getAgenda(branchId, date, staffId);
        setAgenda(appointments);
      } catch (err) {
        if (err instanceof NotAuthenticatedError) {
          setSession(null);
          setScreen("login");
          return;
        }
        setAgendaError(err instanceof ApiError ? err.message : "No pudimos cargar la agenda.");
      } finally {
        setAgendaLoading(false);
      }
    },
    [api, branchId]
  );

  const updateStatus = useCallback(
    async (appointmentId: string, status: string, date: string) => {
      setActionError(undefined);
      try {
        await api.updateAppointmentStatus(appointmentId, status);
        await loadAgenda(date);
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "No pudimos actualizar la cita.");
      }
    },
    [api, loadAgenda]
  );

  const recordPayment = useCallback(
    async (appointmentId: string, input: { amount: number; method: string; paidAt?: string }, date: string) => {
      setActionError(undefined);
      try {
        await api.recordPayment(appointmentId, { amount: input.amount, method: input.method, paid_at: input.paidAt });
        await loadAgenda(date);
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "No pudimos registrar el pago.");
        return false;
      }
    },
    [api, loadAgenda]
  );

  const createWalkIn = useCallback(
    async (input: { staffId: string; customerPhone: string; customerFullName?: string; serviceIds: string[]; startsAt: string }, date: string) => {
      setActionError(undefined);
      try {
        await api.createWalkIn({
          branch_id: branchId,
          staff_id: input.staffId,
          customer_phone: input.customerPhone,
          customer_full_name: input.customerFullName,
          service_ids: input.serviceIds,
          starts_at: input.startsAt,
        });
        await loadAgenda(date);
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "No pudimos cargar el walk-in.");
        return false;
      }
    },
    [api, branchId, loadAgenda]
  );

  // ── Servicios ──
  const loadServices = useCallback(async () => {
    if (!session?.tenantId) return;
    setServicesLoading(true);
    try {
      const { services } = await api.getServices(session.tenantId);
      setServices(services);
    } finally {
      setServicesLoading(false);
    }
  }, [api, session]);

  const createService = useCallback(
    async (input: { name: string; base_price: number; base_duration_minutes: number; description?: string; category?: string }) => {
      setActionError(undefined);
      try {
        await api.createService(input);
        await loadServices();
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "No pudimos crear el servicio.");
        return false;
      }
    },
    [api, loadServices]
  );

  const deactivateService = useCallback(
    async (serviceId: string) => {
      await api.deactivateService(serviceId);
      await loadServices();
    },
    [api, loadServices]
  );

  // ── Barberos ──
  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const { staff } = await api.listStaff();
      setStaff(staff);
    } finally {
      setStaffLoading(false);
    }
  }, [api]);

  const inviteStaff = useCallback(
    async (input: { phone: string; full_name: string; temp_password: string }) => {
      setActionError(undefined);
      try {
        await api.inviteStaff({ ...input, branch_id: branchId });
        await loadStaff();
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "No pudimos invitar al barbero.");
        return false;
      }
    },
    [api, branchId, loadStaff]
  );

  const toggleStaffStatus = useCallback(
    async (staffId: string, currentStatus: string) => {
      const next = currentStatus === "active" ? "paused" : "active";
      await api.updateStaff(staffId, { status: next });
      await loadStaff();
    },
    [api, loadStaff]
  );

  const assignService = useCallback(
    async (staffId: string, serviceId: string) => {
      await api.assignServiceToStaff(staffId, serviceId, {});
    },
    [api]
  );

  const uploadStaffPhoto = useCallback(
    async (staffId: string, file: File) => {
      setActionError(undefined);
      try {
        await api.uploadStaffPhoto(staffId, file);
        await loadStaff();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "No pudimos subir la foto.");
      }
    },
    [api, loadStaff]
  );

  // ── Configuración ──
  const loadSettings = useCallback(async () => {
    if (!session?.tenantId) return;
    setSettingsLoading(true);
    setSettingsError(undefined);
    try {
      const [{ tenant }, { businessHours }] = await Promise.all([
        api.getTenantProfile(session.tenantId),
        api.getBusinessHours(branchId),
      ]);
      setTenant(tenant);
      setBusinessHoursState(businessHours);
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "No pudimos cargar la configuración.");
    } finally {
      setSettingsLoading(false);
    }
  }, [api, session, branchId]);

  const saveTenantProfile = useCallback(
    async (updates: {
      tradeName?: string;
      description?: string;
      timezone?: string;
      address?: string;
      instagram?: string;
      facebook?: string;
    }) => {
      if (!session?.tenantId) return;
      setSettingsSaved(false);
      setSettingsError(undefined);
      try {
        await api.updateTenantProfile(session.tenantId, updates);
        setSettingsSaved(true);
        // El backend normaliza (p. ej. "@usuario" → enlace): se vuelve a leer para mostrar lo guardado.
        await loadSettings();
      } catch (err) {
        setSettingsError(err instanceof ApiError ? err.message : "No pudimos guardar los cambios.");
      }
    },
    [api, session, loadSettings]
  );

  const uploadLogo = useCallback(
    async (file: File) => {
      if (!session?.tenantId) return;
      setSettingsSaved(false);
      try {
        await api.uploadTenantLogo(session.tenantId, file);
        setSettingsSaved(true);
        await loadSettings();
      } catch (err) {
        setSettingsError(err instanceof ApiError ? err.message : "No pudimos subir el logo.");
      }
    },
    [api, session, loadSettings]
  );

  const uploadCover = useCallback(
    async (file: File) => {
      if (!session?.tenantId) return;
      setSettingsSaved(false);
      try {
        await api.uploadTenantCover(session.tenantId, file);
        setSettingsSaved(true);
        await loadSettings();
      } catch (err) {
        setSettingsError(err instanceof ApiError ? err.message : "No pudimos subir la portada.");
      }
    },
    [api, session, loadSettings]
  );

  const loadPlatformAdmin = useCallback(async () => {
    try {
      const { isPlatformAdmin: admin } = await api.getPlatformAdminStatus();
      setIsPlatformAdmin(admin);
      if (admin) setPlatformBranding((await api.getPlatformBranding()).branding);
    } catch {
      // Backend sin este endpoint o sin conexión: la sección simplemente no se muestra.
      setIsPlatformAdmin(false);
    }
  }, [api]);

  const uploadPlatformImage = useCallback(
    async (slot: "hero" | "search_bg", file: File) => {
      setSettingsSaved(false);
      setSettingsError(undefined);
      try {
        const { branding } = await api.uploadPlatformImage(slot, file);
        setPlatformBranding(branding);
        setSettingsSaved(true);
      } catch (err) {
        setSettingsError(err instanceof ApiError ? err.message : "No pudimos subir el fondo.");
      }
    },
    [api]
  );

  const removePlatformImage = useCallback(
    async (slot: "hero" | "search_bg") => {
      setSettingsSaved(false);
      setSettingsError(undefined);
      try {
        const res = await api.removePlatformImage(slot);
        setPlatformBranding(res.branding);
        setSettingsSaved(true);
      } catch (err) {
        setSettingsError(err instanceof ApiError ? err.message : "No pudimos restaurar el fondo.");
      }
    },
    [api]
  );

  const saveBusinessHours = useCallback(
    async (hours: Array<{ dayOfWeek: string; opensAt: string; closesAt: string }>) => {
      setSettingsSaved(false);
      try {
        await api.setBusinessHours(branchId, hours);
        setSettingsSaved(true);
        await loadSettings();
      } catch (err) {
        setSettingsError(err instanceof ApiError ? err.message : "No pudimos guardar el horario.");
      }
    },
    [api, branchId, loadSettings]
  );

  useEffect(() => {
    if (!session) return;
    const today = new Date().toISOString().slice(0, 10);
    if (screen === "dashboard") loadAgenda(today);
    if (screen === "services") loadServices();
    if (screen === "staff") loadStaff();
    if (screen === "settings") loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, screen]);

  // El nombre/logo de la barbería se usan en la barra lateral, visible en toda
  // pantalla — se cargan una vez al iniciar sesión, no solo al entrar a Configuración.
  useEffect(() => {
    if (!session) return;
    loadSettings();
    loadPlatformAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return {
    session,
    screen,
    setScreen,
    loginError,
    login,
    logout,
    agenda,
    agendaLoading,
    agendaError,
    actionError,
    loadAgenda,
    updateStatus,
    recordPayment,
    createWalkIn,
    // Servicios
    services,
    servicesLoading,
    createService,
    deactivateService,
    // Barberos
    staff,
    staffLoading,
    inviteStaff,
    toggleStaffStatus,
    assignService,
    uploadStaffPhoto,
    getStaffServices: api.getStaffServices.bind(api),
    // Configuración
    tenant,
    businessHours,
    settingsLoading,
    settingsError,
    settingsSaved,
    saveTenantProfile,
    saveBusinessHours,
    uploadLogo,
    uploadCover,
    isPlatformAdmin,
    platformBranding,
    uploadPlatformImage,
    removePlatformImage,
    setBranchActive: api.setBranchActive.bind(api),
  };
}
