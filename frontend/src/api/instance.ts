// frontend/src/api/instance.ts
// Una sola instancia del cliente de reservas para toda la app cliente: comparte la sesión
// (tokens) entre el flujo de reserva, "Mis citas" y "Perfil".
import { BookingApiClient } from "./booking-api-client";

export const bookingApi = new BookingApiClient(import.meta.env.VITE_API_URL ?? "http://localhost:3000");
