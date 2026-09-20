// frontend/src/hooks/useBookingFlow.ts
import { useCallback, useRef, useState } from "react";
import { BookingApiClient, ApiError, NetworkError, TimeoutError, NotAuthenticatedError, Slot } from "../api/booking-api-client";

export type BookingStep =
  | "barbershop"
  | "profile"
  | "service"
  | "barber"
  | "date"
  | "slots"
  | "confirm"
  | "submitting"
  | "success"
  | "error";

export type AuthStatus = "unauthenticated" | "otp_sent" | "authenticated";

export interface BookingFlowState {
  step: BookingStep;
  barbershop?: {
    id: string;
    tradeName: string;
    slug?: string;
    branchId: string;
    timezone: string;
    logoUrl?: string | null;
    coverUrl?: string | null;
    address?: string | null;
    completedAppointments?: number;
  };
  services: Array<{ id: string; name: string; basePrice: number; baseDurationMinutes: number }>;
  /** Barberos de la sucursal para mostrar en el perfil (antes de elegir servicio). */
  profileBarbers: Array<{ id: string; fullName: string; avatarUrl?: string | null }>;
  selectedServiceIds: string[];
  barbers: Array<{ id: string; fullName: string; price: number; durationMinutes: number; avatarUrl?: string | null }>;
  selectedBarberId?: string;
  selectedDate?: string;
  slots: Slot[];
  slotsLoading: boolean;
  selectedSlot?: Slot;
  customerNote?: string;
  confirmation?: { id: string; confirmationCode: string; startsAt: string };
  error?: { code: string; message: string; alternatives?: Slot[] };

  // Auth inline (Loop 06/11) — ver DESIGN_SYSTEM.md 1.8: el login se pide DENTRO del
  // bottom sheet de confirmación, nunca antes. Explorar/elegir servicio/barbero/horario
  // no requiere sesión — recién acá.
  authStatus: AuthStatus;
  authPhone?: string;
  authEmail?: string;
  authError?: string;
}

export function useBookingFlow(api: BookingApiClient) {
  const [state, setState] = useState<BookingFlowState>({
    step: "barbershop",
    services: [],
    profileBarbers: [],
    selectedServiceIds: [],
    barbers: [],
    slots: [],
    slotsLoading: false,
    authStatus: api.isAuthenticated() ? "authenticated" : "unauthenticated",
  });

  const idempotencyKeyRef = useRef<string | null>(null);
  // Fecha y horarios comparten pantalla: si el cliente toca varios días rápido, solo la
  // última respuesta de disponibilidad puede pintar los horarios.
  const slotsRequestRef = useRef(0);

  const loadBarbershop = useCallback(async (slug: string) => {
    try {
      const { barbershop } = await api.getBarbershop(slug);
      const { services } = await api.getServices(barbershop.id);

      // Barberos para la fila "Nuestros barberos" del perfil: se piden con todos los
      // servicios y, si falla, el perfil se muestra igual sin esa fila (no bloquea la reserva).
      let profileBarbers: BookingFlowState["profileBarbers"] = [];
      if (services.length > 0) {
        try {
          const res = await api.getStaff(barbershop.branchId, services.map((sv: { id: string }) => sv.id));
          profileBarbers = res.staff;
        } catch {
          profileBarbers = [];
        }
      }

      setState((s) => ({ ...s, barbershop, services, profileBarbers, step: "profile" }));
    } catch (err) {
      setState((s) => ({ ...s, step: "error", error: toDisplayError(err) }));
    }
  }, [api]);

  const startBooking = useCallback(() => {
    setState((s) => (s.step === "profile" ? { ...s, step: "service" } : s));
  }, []);

  /** Flecha "atrás" de cada paso. Conserva todo lo elegido para no hacer repetir nada. */
  const goBack = useCallback(() => {
    setState((s) => {
      const previous: Partial<Record<BookingStep, BookingStep>> = {
        service: "profile",
        barber: "service",
        date: "barber",
        slots: "barber",
        confirm: s.selectedDate ? "slots" : "date",
      };
      const step = previous[s.step];
      return step ? { ...s, step, error: undefined, authError: undefined } : s;
    });
  }, []);

  const selectServices = useCallback(
    async (serviceIds: string[]) => {
      if (!state.barbershop) return;
      try {
        const { staff } = await api.getStaff(state.barbershop.branchId, serviceIds);
        setState((s) => {
          const same = s.selectedServiceIds.length === serviceIds.length && serviceIds.every((id) => s.selectedServiceIds.includes(id));
          return {
            ...s,
            selectedServiceIds: serviceIds,
            barbers: staff,
            step: "barber",
            // Otros servicios → otro precio, duración y disponibilidad: se rehace desde el barbero.
            ...(same ? {} : { selectedBarberId: undefined, selectedDate: undefined, slots: [], slotsLoading: false, selectedSlot: undefined }),
          };
        });
      } catch (err) {
        setState((s) => ({ ...s, step: "error", error: toDisplayError(err) }));
      }
    },
    [api, state.barbershop]
  );

  const selectBarber = useCallback((barberId: string) => {
    setState((s) => {
      // Si cambió de barbero, la fecha y los horarios elegidos ya no valen (eran de otro).
      const changed = s.selectedBarberId !== barberId;
      return {
        ...s,
        selectedBarberId: barberId,
        step: changed ? "date" : s.selectedDate ? "slots" : "date",
        ...(changed ? { selectedDate: undefined, slots: [], slotsLoading: false, selectedSlot: undefined } : {}),
      };
    });
  }, []);

  const selectDate = useCallback(
    async (date: string) => {
      if (!state.barbershop || !state.selectedBarberId) return;
      const requestId = ++slotsRequestRef.current;
      setState((s) => ({ ...s, selectedDate: date, step: "slots", slots: [], slotsLoading: true, selectedSlot: undefined }));
      try {
        const { slots } = await api.getAvailability({
          tenantId: state.barbershop.id,
          barberId: state.selectedBarberId,
          branchId: state.barbershop.branchId,
          serviceId: state.selectedServiceIds[0],
          date,
        });
        if (requestId !== slotsRequestRef.current) return;
        setState((s) => ({ ...s, slots, slotsLoading: false }));
      } catch (err) {
        if (requestId !== slotsRequestRef.current) return;
        setState((s) => ({ ...s, slotsLoading: false, step: "error", error: toDisplayError(err) }));
      }
    },
    [api, state.barbershop, state.selectedBarberId, state.selectedServiceIds]
  );

  const selectSlot = useCallback((slot: Slot) => {
    setState((s) => ({ ...s, selectedSlot: slot, step: "confirm" }));
  }, []);

  const requestLoginOtp = useCallback(async (phone: string, email: string) => {
    setState((s) => ({ ...s, authError: undefined }));
    try {
      await api.requestOtp(phone, email);
      setState((s) => ({ ...s, authStatus: "otp_sent", authPhone: phone, authEmail: email }));
    } catch (err) {
      setState((s) => ({ ...s, authError: toDisplayError(err).message }));
    }
  }, [api]);

  const verifyLoginOtp = useCallback(
    async (code: string, fullName?: string) => {
      if (!state.authPhone) return;
      setState((s) => ({ ...s, authError: undefined }));
      try {
        await api.verifyOtp(state.authPhone, code, fullName);
        setState((s) => ({ ...s, authStatus: "authenticated" }));
      } catch (err) {
        setState((s) => ({ ...s, authError: toDisplayError(err).message }));
      }
    },
    [api, state.authPhone]
  );

  const confirm = useCallback(
    async (customerNote?: string) => {
      if (!state.barbershop || !state.selectedBarberId || !state.selectedSlot) return;
      if (state.authStatus !== "authenticated") {
        setState((s) => ({ ...s, authError: "Verifica tu código primero." }));
        return;
      }

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }

      setState((s) => ({ ...s, step: "submitting", customerNote }));

      try {
        const { appointment } = await api.createAppointment(
          {
            tenantId: state.barbershop.id,
            branchId: state.barbershop.branchId,
            barberId: state.selectedBarberId,
            serviceIds: state.selectedServiceIds,
            startsAt: state.selectedSlot.start,
            customerNote,
          },
          idempotencyKeyRef.current
        );

        idempotencyKeyRef.current = null;

        setState((s) => ({
          ...s,
          step: "success",
          confirmation: {
            id: appointment.id,
            confirmationCode: appointment.confirmation_code,
            startsAt: appointment.starts_at,
          },
        }));
      } catch (err) {
        if (err instanceof NotAuthenticatedError) {
          setState((s) => ({ ...s, step: "confirm", authStatus: "unauthenticated", authError: "Tu sesión expiró, inicia sesión de nuevo." }));
          return;
        }
        if (err instanceof ApiError && err.code === "slot_no_longer_available") {
          setState((s) => ({
            ...s,
            step: "error",
            error: { code: err.code, message: err.message, alternatives: err.alternatives as Slot[] },
          }));
        } else {
          setState((s) => ({ ...s, step: "error", error: toDisplayError(err) }));
        }
      }
    },
    [api, state.authStatus, state.barbershop, state.selectedBarberId, state.selectedServiceIds, state.selectedSlot]
  );

  const retry = useCallback(() => {
    if (state.step === "error" && state.error?.code !== "slot_no_longer_available") {
      confirm(state.customerNote);
    }
  }, [confirm, state.customerNote, state.error, state.step]);

  const chooseAlternativeSlot = useCallback((slot: Slot) => {
    idempotencyKeyRef.current = null;
    setState((s) => ({ ...s, selectedSlot: slot, step: "confirm", error: undefined }));
  }, []);

  return {
    state,
    loadBarbershop,
    startBooking,
    goBack,
    selectServices,
    selectBarber,
    selectDate,
    selectSlot,
    confirm,
    retry,
    chooseAlternativeSlot,
    requestLoginOtp,
    verifyLoginOtp,
  };
}

function toDisplayError(err: unknown): { code: string; message: string } {
  if (err instanceof TimeoutError) return { code: "timeout", message: "La operación tardó demasiado. Prueba de nuevo." };
  if (err instanceof NetworkError) return { code: "network_error", message: "No pudimos conectarnos. Revisa tu conexión." };
  if (err instanceof NotAuthenticatedError) return { code: "not_authenticated", message: "Necesitas iniciar sesión." };
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  return { code: "unknown_error", message: "Algo salió mal. Inténtalo de nuevo." };
}
