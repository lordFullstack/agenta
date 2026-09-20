// frontend/src/lib/myAppointments.ts
//
// "Mis citas" del lado cliente. El backend todavía no expone un endpoint para listar
// las citas de un cliente, así que las reservas confirmadas desde este dispositivo se
// guardan acá (localStorage). Es un historial local: no se sincroniza entre dispositivos
// ni refleja cambios hechos por la barbería. Cuando exista GET /v1/me/appointments,
// solo hay que reemplazar `listMyAppointments` por la llamada a la API.

export interface StoredAppointment {
  id: string;
  code: string;
  startsAt: string;
  tradeName: string;
  slug: string;
  logoUrl?: string | null;
  barberName: string;
  serviceNames: string[];
  total: number;
  savedAt: string;
}

const KEY = "agenta_my_appointments_v1";

export function listMyAppointments(): StoredAppointment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMyAppointment(appointment: StoredAppointment): void {
  try {
    const current = listMyAppointments().filter((a) => a.id !== appointment.id);
    localStorage.setItem(KEY, JSON.stringify([appointment, ...current].slice(0, 100)));
  } catch {
    // localStorage no disponible (modo privado, cuota): la cita igual quedó reservada en el servidor.
  }
}

export function hasMyAppointments(): boolean {
  return listMyAppointments().length > 0;
}
