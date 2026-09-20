// frontend/src/components/BookingFlow.tsx
import React, { useEffect, useState } from "react";
import { useBookingFlow, BookingFlowState } from "../hooks/useBookingFlow";
import { BookingApiClient } from "../api/booking-api-client";
import {
  IconScissors,
  IconBeard,
  IconDroplet,
  IconSparkles,
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconClock,
  IconCopy,
} from "./icons";

// Ícono por tipo de servicio — coincidencia por palabra clave sobre el nombre que carga
// la barbería (no hay un campo de categoría en el modelo de datos).
function serviceIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("barba") || n.includes("perfilado")) return IconBeard;
  if (n.includes("tinte") || n.includes("color")) return IconDroplet;
  if (n.includes("ceja") || n.includes("diseño") || n.includes("diseno")) return IconSparkles;
  return IconScissors;
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatFriendlyDate(iso?: string) {
  if (!iso) return "";
  const raw = new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const api = new BookingApiClient(import.meta.env.VITE_API_URL ?? "http://localhost:3000");

export function BookingFlow({ barbershopSlug }: { barbershopSlug: string }) {
  const { state, loadBarbershop, selectServices, selectBarber, selectDate, selectSlot, confirm, retry, chooseAlternativeSlot, requestLoginOtp, verifyLoginOtp } =
    useBookingFlow(api);

  useEffect(() => {
    loadBarbershop(barbershopSlug);
  }, [barbershopSlug, loadBarbershop]);

  return (
    <div className="min-h-screen bg-ink text-bone font-body pb-24">
      {state.step === "barbershop" && <BarbershopSkeleton />}

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

      {state.step === "success" && state.confirmation && <SuccessScreen state={state} confirmation={state.confirmation} />}

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

// Skeleton de la carga inicial — replica el layout real (header + lista de servicios)
// en vez de un spinner genérico sobre pantalla en blanco.
function BarbershopSkeleton() {
  const shimmer = "bg-gradient-to-r from-steel/[0.08] via-steel/[0.18] to-steel/[0.08] bg-[length:200%_100%] animate-shimmer";
  return (
    <div className="pt-6">
      <div className="mb-4">
        <div className={`h-36 ${shimmer}`} />
        <div className="pt-11 px-5">
          <div className={`h-6 w-40 rounded ${shimmer}`} />
        </div>
      </div>
      <div className="px-4">
        <div className={`h-7 w-48 rounded mb-4 ${shimmer}`} />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-16 rounded-card ${shimmer}`} />
          ))}
        </div>
      </div>
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
          {services.map((s) => {
            const isSelected = selected.includes(s.id);
            const Icon = serviceIcon(s.name);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                aria-selected={isSelected}
                className="w-full flex items-center gap-3 bg-bone text-ink rounded-card shadow-card p-4 border-2 border-transparent
                  aria-selected:border-brass aria-selected:shadow-brass hover:shadow-float active:scale-[0.98] transition-all"
              >
                <div
                  className="w-9 h-9 rounded-pill flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: isSelected ? "rgba(245,185,63,0.18)" : "rgba(91,97,105,0.1)" }}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? "text-brass-dark" : "text-steel"}`} />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-steel text-xs font-mono">{s.baseDurationMinutes} min</p>
                </div>
                <p className="font-mono tabular-nums font-medium">${s.basePrice}</p>
              </button>
            );
          })}
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
          className="w-full bg-brass text-ink font-semibold rounded-full py-4 disabled:opacity-40
            hover:enabled:bg-brass-light active:scale-95 transition-all"
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
            className="group relative aspect-[4/5] rounded-card overflow-hidden shadow-card hover:shadow-float active:scale-[0.98] transition-all bg-steel/15"
          >
            {b.avatarUrl ? (
              <img
                src={b.avatarUrl}
                alt={b.fullName}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-steel/10">
                <span className="font-display text-4xl font-semibold text-steel/50">{b.fullName.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/75 to-transparent pt-12 pb-3 px-3 text-left">
              <p className="text-bone font-medium text-sm leading-tight truncate">{b.fullName}</p>
              <p className="text-brass-light text-xs font-mono mt-0.5">{b.durationMinutes} min · ${b.price}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Paso 4: Fecha (calendario mensual) ──

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function DateStep({ onSelect }: { onSelect: (date: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();
  const changeMonth = (delta: number) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const firstWeekday = (viewDate.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rawMonthLabel = viewDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);

  return (
    <div className="px-4 pt-6">
      <h1 className="font-display text-2xl font-semibold mb-4">Elegí el día</h1>
      <div className="bg-bone/5 border border-steel/20 rounded-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            disabled={isCurrentMonth}
            aria-label="Mes anterior"
            className="w-8 h-8 flex items-center justify-center rounded-pill text-steel disabled:opacity-25 hover:text-brass-light hover:bg-bone/10 transition-colors"
          >
            <IconChevronLeft className="w-4 h-4" />
          </button>
          <p className="font-display font-semibold text-sm">{monthLabel}</p>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
            className="w-8 h-8 flex items-center justify-center rounded-pill text-steel hover:text-brass-light hover:bg-bone/10 transition-colors"
          >
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((w, i) => (
            <span key={i} className="text-center text-[10px] font-mono uppercase text-steel/60 py-1">
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1.5">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const isPast = date < today;
            const isToday = date.getTime() === today.getTime();
            return (
              <div key={i} className="flex items-center justify-center">
                <button
                  disabled={isPast}
                  onClick={() => onSelect(toIsoDate(date))}
                  className={`w-9 h-9 rounded-pill flex items-center justify-center text-sm font-mono tabular-nums transition-all
                    ${isPast ? "text-steel/25" : "text-bone hover:bg-brass/15 active:scale-90 active:bg-brass active:text-ink"}
                    ${isToday && !isPast ? "border border-brass/50" : ""}`}
                >
                  {date.getDate()}
                </button>
              </div>
            );
          })}
        </div>
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
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-steel text-xs font-mono uppercase tracking-wide mb-3 hover:text-brass-light transition-colors"
      >
        <IconChevronLeft className="w-3.5 h-3.5" />
        Cambiar fecha
      </button>
      <h1 className="font-display text-2xl font-semibold mb-4">Elegí el horario</h1>
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((slot) => (
          <button
            key={slot.start}
            onClick={() => onSelect(slot)}
            className="py-3 rounded font-mono text-sm tabular-nums border border-steel/25 text-bone
              hover:border-brass/60 active:bg-brass active:text-ink active:border-brass transition-colors"
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

  const selectedBarber = state.barbers.find((b) => b.id === state.selectedBarberId);
  const selectedServices = state.services.filter((s) => state.selectedServiceIds.includes(s.id));
  const total = selectedServices.reduce((sum, s) => sum + s.basePrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />
      <div className="relative w-full bg-bone text-ink rounded-t-sheet shadow-float max-h-[85vh] overflow-y-auto pb-safe">
        <div className="w-9 h-1 bg-steel/30 rounded-pill mx-auto mt-3 mb-4" />
        <div className="px-5 pb-6">
          <h2 className="font-display text-xl font-semibold">Confirmá tu reserva</h2>
          {state.barbershop && <p className="text-steel text-xs mb-4">{state.barbershop.tradeName}</p>}

          {selectedBarber && (
            <div className="flex items-center gap-3 pb-4 mb-3 border-b border-steel/15">
              <div className="w-10 h-10 rounded-pill bg-steel/15 overflow-hidden flex-shrink-0">
                {selectedBarber.avatarUrl ? (
                  <img src={selectedBarber.avatarUrl} alt={selectedBarber.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display font-semibold text-steel">
                    {selectedBarber.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{selectedBarber.fullName}</p>
                {selectedServices.length > 0 && (
                  <p className="text-steel text-xs font-mono">{selectedServices.map((s) => s.name).join(" · ")}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2.5 text-sm mb-4">
            <IconRow icon={IconCalendar} label="Fecha" value={formatFriendlyDate(state.selectedDate)} />
            <IconRow
              icon={IconClock}
              label="Horario"
              value={
                state.selectedSlot ? new Date(state.selectedSlot.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""
              }
            />
            {total > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-steel/15">
                <span className="text-steel">Total</span>
                <span className="font-mono font-semibold tabular-nums">${total}</span>
              </div>
            )}
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
                className="w-full bg-brass text-ink font-semibold rounded-full py-4 hover:bg-brass-light active:scale-95 transition-all"
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
                className="w-full bg-brass text-ink font-semibold rounded-full py-4 disabled:opacity-40 hover:enabled:bg-brass-light active:scale-95 transition-all"
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
                className="w-full bg-brass text-ink font-semibold rounded-full py-4 disabled:opacity-40 hover:enabled:bg-brass-light active:scale-95 transition-all"
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

function IconRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-pill bg-steel/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-steel" />
      </div>
      <div className="flex-1 flex items-center justify-between">
        <span className="text-steel text-xs">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}

// ── Paso 14: Éxito ──

function SuccessScreen({
  state,
  confirmation,
}: {
  state: BookingFlowState;
  confirmation: NonNullable<BookingFlowState["confirmation"]>;
}) {
  const [copied, setCopied] = useState(false);
  const selectedBarber = state.barbers.find((b) => b.id === state.selectedBarberId);
  const selectedServices = state.services.filter((s) => state.selectedServiceIds.includes(s.id));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(confirmation.confirmationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API no disponible (contexto no seguro / navegador viejo) — el código
      // sigue visible en pantalla para copiarlo a mano.
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-pill bg-brass/15 flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-brass" aria-hidden="true">
          <path
            d="m5 12.5 4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            className="animate-draw-check"
          />
        </svg>
      </div>
      <h1 className="font-display text-2xl font-semibold mb-1">¡Cita confirmada!</h1>
      <p className="text-steel text-sm mb-6">
        {new Date(confirmation.startsAt).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })}
      </p>

      <button
        onClick={handleCopy}
        className="group flex items-center gap-3 font-mono text-brass text-xl tracking-[0.2em] bg-brass/10 border border-brass/25 rounded-card px-6 py-3.5 hover:border-brass/50 active:scale-[0.98] transition-all"
      >
        {confirmation.confirmationCode}
        <IconCopy className="w-4 h-4 text-brass/70 group-hover:text-brass transition-colors" />
      </button>
      <p className="text-steel text-xs mt-2 mb-8">{copied ? "¡Copiado!" : "Código de confirmación · tocá para copiar"}</p>

      {(selectedBarber || selectedServices.length > 0) && (
        <div className="w-full max-w-xs bg-bone/5 border border-steel/20 rounded-card p-4 text-left space-y-2.5">
          {selectedBarber && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-pill bg-steel/15 overflow-hidden flex-shrink-0">
                {selectedBarber.avatarUrl ? (
                  <img src={selectedBarber.avatarUrl} alt={selectedBarber.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display text-xs font-semibold text-steel">
                    {selectedBarber.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium">{selectedBarber.fullName}</p>
            </div>
          )}
          {selectedServices.length > 0 && (
            <p className="text-steel text-xs font-mono pt-2 border-t border-steel/15">
              {selectedServices.map((s) => s.name).join(" · ")}
            </p>
          )}
        </div>
      )}
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
        <IconAlert className="w-6 h-6 text-ember" />
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
              className="py-3 rounded font-mono text-sm border border-brass/40 text-brass hover:bg-brass/10 transition-colors"
            >
              {new Date(slot.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={onRetry}
          className="border border-steel/40 text-bone rounded-full px-6 py-3 hover:border-brass/60 hover:text-brass-light transition-colors"
        >
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
