// frontend/src/components/BookingFlow.tsx
import React, { useEffect, useState } from "react";
import { useBookingFlow, BookingFlowState } from "../hooks/useBookingFlow";
import { BookingApiClient } from "../api/booking-api-client";

const api = new BookingApiClient(import.meta.env.VITE_API_URL ?? "http://localhost:3000");

export function BookingFlow({ barbershopSlug }: { barbershopSlug: string }) {
  const { state, loadBarbershop, selectServices, selectBarber, selectDate, selectSlot, confirm, retry, chooseAlternativeSlot, requestLoginOtp, verifyLoginOtp } =
    useBookingFlow(api);

  useEffect(() => {
    loadBarbershop(barbershopSlug);
  }, [barbershopSlug, loadBarbershop]);

  return (
    <div className="min-h-screen bg-ink text-bone font-body pb-24">
      {state.step === "barbershop" && <ScreenLoading label="Cargando barbería…" />}

      {state.step === "service" && (
        <ServiceStep barbershop={state.barbershop} services={state.services} onContinue={selectServices} />
      )}

      {state.step === "barber" && (
        <BarberStep barbers={state.barbers} onSelect={selectBarber} />
      )}

      {state.step === "date" && <DateStep onSelect={selectDate} />}

      {state.step === "slots" && (
        <SlotsStep slots={state.slots} onSelect={selectSlot} onBack={() => selectDate(state.selectedDate!)} />
      )}

      {state.step === "confirm" && (
        <ConfirmSheet state={state} onConfirm={confirm} onRequestOtp={requestLoginOtp} onVerifyOtp={verifyLoginOtp} />
      )}

      {state.step === "submitting" && <ScreenLoading label="Confirmando tu reserva…" />}

      {state.step === "success" && state.confirmation && <SuccessScreen confirmation={state.confirmation} />}

      {state.step === "error" && state.error && (
        <ErrorScreen
          error={state.error}
          onRetry={retry}
          onChooseAlternative={state.error.alternatives ? chooseAlternativeSlot : undefined}
        />
      )}
    </div>
  );
}

// ── Estados compartidos ──

function ScreenLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
      <div className="w-10 h-10 rounded-pill border-2 border-brass border-t-transparent animate-spin" />
      <p className="text-steel text-sm font-mono">{label}</p>
    </div>
  );
}

// ── Encabezado de perfil: portada, logo, dirección, señal de confianza ──

function BarbershopHeader({ barbershop }: { barbershop: BookingFlowState["barbershop"] }) {
  if (!barbershop) return null;
  const mapsUrl = barbershop.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(barbershop.address)}`
    : null;

  return (
    <div className="mb-4">
      <div
        className="relative h-36 bg-steel/20 bg-cover bg-center"
        style={barbershop.coverUrl ? { backgroundImage: `url(${barbershop.coverUrl})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-ink/0 to-ink/90" />
        <div className="absolute left-5 -bottom-8 w-18 h-18 rounded-pill bg-bone border-4 border-ink overflow-hidden shadow-float z-10">
          {barbershop.logoUrl ? (
            <img src={barbershop.logoUrl} alt={barbershop.tradeName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink font-display font-semibold text-xl">
              {barbershop.tradeName.charAt(0)}
            </div>
          )}
        </div>
      </div>
      <div className="pt-11 px-5">
        <h1 className="font-display text-xl font-semibold mb-1">{barbershop.tradeName}</h1>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-steel text-xs underline">
            Ver ubicación en el mapa
          </a>
        )}
        {!!barbershop.completedAppointments && (
          <div className="inline-flex items-center gap-1.5 bg-brass/15 text-brass border border-brass/30 rounded-pill px-3 py-1 text-xs font-medium mt-3">
            +{barbershop.completedAppointments} turnos realizados
          </div>
        )}
      </div>
    </div>
  );
}

// ── Paso 2: Servicios ──

function ServiceStep({
  barbershop,
  services,
  onContinue,
}: {
  barbershop: BookingFlowState["barbershop"];
  services: BookingFlowState["services"];
  onContinue: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const total = services.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + s.basePrice, 0);

  return (
    <div className="pt-6">
      <BarbershopHeader barbershop={barbershop} />
      <div className="px-4">
      <h1 className="font-display text-2xl font-semibold mb-4">Elegí tu servicio</h1>

      {services.length === 0 ? (
        <EmptyState title="Sin servicios disponibles" subtitle="Esta barbería aún no cargó su catálogo." />
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              aria-selected={selected.includes(s.id)}
              className="w-full flex items-center justify-between bg-bone text-ink rounded-card shadow-card p-4
                aria-selected:ring-2 aria-selected:ring-brass active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <p className="font-medium">{s.name}</p>
                <p className="text-steel text-xs font-mono">{s.baseDurationMinutes} min</p>
              </div>
              <p className="font-mono tabular-nums">${s.basePrice}</p>
            </button>
          ))}
        </div>
      )}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-ink/90 backdrop-blur-xl border-t border-brass/20 p-4 pb-safe">
        {selected.length > 0 && (
          <p className="text-xs text-steel mb-2 font-mono">{selected.length} servicio(s) — ${total}</p>
        )}
        <button
          disabled={selected.length === 0}
          onClick={() => onContinue(selected)}
          className="w-full bg-brass text-ink font-semibold rounded-full py-4 disabled:opacity-40 active:scale-95 transition-all"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ── Paso 3: Barbero ──

function BarberStep({ barbers, onSelect }: { barbers: BookingFlowState["barbers"]; onSelect: (id: string) => void }) {
  if (barbers.length === 0) {
    return <EmptyState title="No hay barberos disponibles" subtitle="Ningún barbero ofrece esta combinación de servicios." />;
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="font-display text-2xl font-semibold mb-4">Elegí tu barbero</h1>
      <div className="grid grid-cols-2 gap-3">
        {barbers.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="bg-bone text-ink rounded-card shadow-card p-3 text-left active:scale-[0.98] transition-transform flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-pill bg-steel/15 overflow-hidden flex-shrink-0">
              {b.avatarUrl ? (
                <img src={b.avatarUrl} alt={b.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display font-semibold text-steel">
                  {b.fullName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="font-medium">{b.fullName}</p>
              <p className="text-steel text-xs font-mono">{b.durationMinutes} min · ${b.price}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Paso 4: Fecha (simplificado — selector de próximos 14 días) ──

function DateStep({ onSelect }: { onSelect: (date: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="px-4 pt-6">
      <h1 className="font-display text-2xl font-semibold mb-4">Elegí el día</h1>
      <div className="flex gap-2 overflow-x-auto snap-x pb-2">
        {days.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className="snap-start flex-shrink-0 w-14 h-18 rounded-card flex flex-col items-center justify-center
                bg-bone/5 border border-steel/20 active:scale-[0.96] transition-transform"
            >
              <span className="text-xs font-mono uppercase text-steel">
                {d.toLocaleDateString("es-AR", { weekday: "short" })}
              </span>
              <span className="text-lg font-display font-semibold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Pasos 5-6: Slots ──

function SlotsStep({ slots, onSelect, onBack }: { slots: BookingFlowState["slots"]; onSelect: (slot: any) => void; onBack: () => void }) {
  if (slots.length === 0) {
    return (
      <EmptyState title="No hay horarios disponibles este día" subtitle="Probá con otra fecha." action={{ label: "Ver otro día", onClick: onBack }} />
    );
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="font-display text-2xl font-semibold mb-4">Elegí el horario</h1>
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((slot) => (
          <button
            key={slot.start}
            onClick={() => onSelect(slot)}
            className="py-3 rounded font-mono text-sm tabular-nums border border-steel/25 text-bone
              active:bg-brass active:text-ink active:border-brass transition-colors"
          >
            {new Date(slot.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pasos 7-8: Confirmación (Bottom Sheet) — incluye login OTP inline si hace falta ──

function ConfirmSheet({
  state,
  onConfirm,
  onRequestOtp,
  onVerifyOtp,
}: {
  state: BookingFlowState;
  onConfirm: (note?: string) => void;
  onRequestOtp: (phone: string, email: string) => void;
  onVerifyOtp: (code: string, fullName?: string) => void;
}) {
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />
      <div className="relative w-full bg-bone text-ink rounded-t-sheet shadow-float max-h-[85vh] overflow-y-auto pb-safe">
        <div className="w-9 h-1 bg-steel/30 rounded-pill mx-auto mt-3 mb-4" />
        <div className="px-5 pb-6">
          <h2 className="font-display text-xl font-semibold mb-4">Confirmá tu reserva</h2>

          <div className="space-y-2 text-sm mb-4">
            <Row label="Barbería" value={state.barbershop?.tradeName ?? ""} />
            <Row label="Fecha" value={state.selectedDate ?? ""} />
            <Row
              label="Horario"
              value={
                state.selectedSlot ? new Date(state.selectedSlot.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""
              }
            />
          </div>

          {state.authStatus === "authenticated" ? (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota para el barbero (opcional)"
                className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-ink text-sm py-2 outline-none mb-6"
              />
              <button
                onClick={() => onConfirm(note || undefined)}
                className="w-full bg-brass text-ink font-semibold rounded-full py-4 active:scale-95 transition-all"
              >
                Confirmar reserva
              </button>
            </>
          ) : state.authStatus === "otp_sent" ? (
            <>
              <p className="text-steel text-sm mb-3">Te mandamos un código a {state.authEmail}.</p>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código de 6 dígitos"
                className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-ink text-lg font-mono tracking-widest py-2 outline-none mb-3"
              />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre (solo la primera vez)"
                className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-ink text-sm py-2 outline-none mb-4"
              />
              {state.authError && <p className="text-ember text-xs mb-3">{state.authError}</p>}
              <button
                onClick={() => onVerifyOtp(code, fullName || undefined)}
                disabled={code.length < 6}
                className="w-full bg-brass text-ink font-semibold rounded-full py-4 disabled:opacity-40 active:scale-95 transition-all"
              >
                Verificar y confirmar
              </button>
            </>
          ) : (
            <>
              <p className="text-steel text-sm mb-3">Ingresá tu teléfono y email para confirmar la reserva.</p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 9 11 5555-0000"
                className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-ink text-sm py-2 outline-none mb-3"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-ink text-sm py-2 outline-none mb-4"
              />
              {state.authError && <p className="text-ember text-xs mb-3">{state.authError}</p>}
              <button
                onClick={() => onRequestOtp(phone, email)}
                disabled={phone.length < 8 || !email.includes("@")}
                className="w-full bg-brass text-ink font-semibold rounded-full py-4 disabled:opacity-40 active:scale-95 transition-all"
              >
                Enviar código
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-steel">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ── Paso 14: Éxito ──

function SuccessScreen({ confirmation }: { confirmation: NonNullable<BookingFlowState["confirmation"]> }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-16 h-16 rounded-pill bg-brass/15 flex items-center justify-center mb-6">
        <span className="text-brass text-3xl">✓</span>
      </div>
      <h1 className="font-display text-2xl font-semibold mb-2">¡Cita confirmada!</h1>
      <p className="text-steel text-sm mb-1">
        {new Date(confirmation.startsAt).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })}
      </p>
      <p className="font-mono text-brass text-lg tracking-widest mt-4">{confirmation.confirmationCode}</p>
      <p className="text-steel text-xs mt-1">Código de confirmación</p>
    </div>
  );
}

// ── Error (timeout / network / slot ocupado / conflicto de negocio) ──

function ErrorScreen({
  error,
  onRetry,
  onChooseAlternative,
}: {
  error: NonNullable<BookingFlowState["error"]>;
  onRetry: () => void;
  onChooseAlternative?: (slot: any) => void;
}) {
  const isSlotConflict = error.code === "slot_no_longer_available";

  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-pill bg-ember/10 flex items-center justify-center mb-4">
        <span className="text-ember text-2xl">!</span>
      </div>
      <p className="font-display text-lg mb-1">
        {isSlotConflict ? "Ese horario ya no está disponible" : "No pudimos completar la acción"}
      </p>
      <p className="text-steel text-sm mb-6">{error.message}</p>

      {isSlotConflict && error.alternatives && error.alternatives.length > 0 && onChooseAlternative ? (
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {error.alternatives.slice(0, 6).map((slot) => (
            <button
              key={slot.start}
              onClick={() => onChooseAlternative(slot)}
              className="py-3 rounded font-mono text-sm border border-brass/40 text-brass"
            >
              {new Date(slot.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </button>
          ))}
        </div>
      ) : (
        <button onClick={onRetry} className="border border-steel/40 text-bone rounded-full px-6 py-3">
          Reintentar
        </button>
      )}
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-pill bg-steel/10 flex items-center justify-center mb-4" />
      <p className="font-display text-lg mb-1">{title}</p>
      <p className="text-steel text-sm mb-6">{subtitle}</p>
      {action && (
        <button onClick={action.onClick} className="bg-brass text-ink rounded-full px-6 py-3 font-semibold">
          {action.label}
        </button>
      )}
    </div>
  );
}
