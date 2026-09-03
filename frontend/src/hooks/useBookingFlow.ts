// frontend/src/hooks/useBookingFlow.ts
import { useCallback, useRef, useState } from "react";
import { BookingApiClient, ApiError, NetworkError, TimeoutError, NotAuthenticatedError, Slot } from "../api/booking-api-client";

export type BookingStep =
  | "barbershop"
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
  barbershop?: { id: string; tradeName: string; branchId: string; timezone: string };
  services: Array<{ id: string; name: string; basePrice: number; baseDurationMinutes: number }>;
  selectedServiceIds: string[];
  barbers: Array<{ id: string; fullName: string; price: number; durationMinutes: number }>;
  selectedBarberId?: string;
  selectedDate?: string;
  slots: Slot[];
  selectedSlot?: Slot;
  customerNote?: string;
  confirmation?: { id: string; confirmationCode: string; startsAt: string };
  error?: { code: string; message: string; alternatives?: Slot[] };

  // Auth inline (Loop 06/11) — ver DESIGN_SYSTEM.md 1.8: el login se pide DENTRO del
  // bottom sheet de confirmación, nunca antes. Explorar/elegir servicio/barbero/horario
  // no requiere sesión — recién acá.
  authStatus: AuthStatus;
  authPhone?: string;
  authError?: string;
}

export function useBookingFlow(api: BookingApiClient) {
  const [state, setState] = useState<BookingFlowState>({
    step: "barbershop",
    services: [],
    selectedServiceIds: [],
    barbers: [],
    slots: [],
    authStatus: api.isAuthenticated() ? "authenticated" : "unauthenticated",
  });

  const idempotencyKeyRef = useRef<string | null>(null);

  const loadBarbershop = useCallback(async (slug: string) => {
    try {
      const { barbershop } = await api.getBarbershop(slug);
      const { services } = await api.getServices(barbershop.id);
      setState((s) => ({ ...s, barbershop, services, step: "service" }));
    } catch (err) {
      setState((s) => ({ ...s, step: "error", error: toDisplayError(err) }));
    }
  }, [api]);

  const selectServices = useCallback(
    async (serviceIds: string[]) => {
      if (!state.barbershop) return;
      try {
        const { staff } = await api.getStaff(state.barbershop.branchId, serviceIds);
        setState((s) => ({ ...s, selectedServiceIds: serviceIds, barbers: staff, step: "barber" }));
      } catch (err) {
        setState((s) => ({ ...s, step: "error", error: toDisplayError(err) }));
      }
    },
    [api, state.barbershop]
  );

  const selectBarber = useCallback((barberId: string) => {
    setState((s) => ({ ...s, selectedBarberId: barberId, step: "date" }));
  }, []);

  const selectDate = useCallback(
    async (date: string) => {
      if (!state.barbershop || !state.selectedBarberId) return;
      setState((s) => ({ ...s, selectedDate: date, step: "slots", slots: [] }));
      try {
        const { slots } = await api.getAvailability({
          tenantId: state.barbershop.id,
          barberId: state.selectedBarberId,
          branchId: state.barbershop.branchId,
          serviceId: state.selectedServiceIds[0],
          date,
        });
        setState((s) => ({ ...s, slots }));
      } catch (err) {
        setState((s) => ({ ...s, step: "error", error: toDisplayError(err) }));
      }
    },
    [api, state.barbershop, state.selectedBarberId, state.selectedServiceIds]
  );

  const selectSlot = useCallback((slot: Slot) => {
    setState((s) => ({ ...s, selectedSlot: slot, step: "confirm" }));
  }, []);

  const requestLoginOtp = useCallback(async (phone: string) => {
    setState((s) => ({ ...s, authError: undefined }));
    try {
      await api.requestOtp(phone);
      setState((s) => ({ ...s, authStatus: "otp_sent", authPhone: phone }));
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
        setState((s) => ({ ...s, authError: "Verificá tu código primero." }));
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
          setState((s) => ({ ...s, step: "confirm", authStatus: "unauthenticated", authError: "Tu sesión expiró, iniciá sesión de nuevo." }));
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
  if (err instanceof TimeoutError) return { code: "timeout", message: "La operación tardó demasiado. Probá de nuevo." };
  if (err instanceof NetworkError) return { code: "network_error", message: "No pudimos conectarnos. Revisá tu conexión." };
  if (err instanceof NotAuthenticatedError) return { code: "not_authenticated", message: "Necesitás iniciar sesión." };
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  return { code: "unknown_error", message: "Algo salió mal. Intentá de nuevo." };
}
