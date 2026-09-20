// frontend/src/components/BookingFlow.tsx
//
// Flujo de reserva del cliente, rediseñado según el mockup "Agenta Barber Booking":
//   03 Perfil → 04 Servicios → 05 Barbero → 06 Fecha y hora → 07 Resumen
//   → 08 OTP (solo si no hay sesión) → 09 Cita confirmada.
// La lógica (estado, API, idempotencia, OTP) vive en useBookingFlow y no cambió; acá
// solo se presenta.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBookingFlow, BookingFlowState } from "../hooks/useBookingFlow";
import { Slot } from "../api/booking-api-client";
import { bookingApi } from "../api/instance";
import { saveMyAppointment } from "../lib/myAppointments";
import { formatCOP, formatMonthYear, formatShortDate, formatTime, toIsoDate } from "../lib/format";
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
  IconMapPin,
  IconUser,
  IconShare,
  IconLock,
} from "./icons";
import { Screen, BackHeader, GoldButton, GhostButton, BottomBar, Avatar, SelectMark, photoBackground } from "./ui";

// Ícono por tipo de servicio — coincidencia por palabra clave sobre el nombre que carga
// la barbería (no hay un campo de categoría en el modelo de datos).
function serviceIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("barba") || n.includes("perfilado")) return IconBeard;
  if (n.includes("tinte") || n.includes("color")) return IconDroplet;
  if (n.includes("ceja") || n.includes("diseño") || n.includes("diseno")) return IconSparkles;
  return IconScissors;
}

/** Barbero elegido + servicios + total/duración. El precio del barbero manda (puede tener override). */
function summarize(state: BookingFlowState) {
  const selectedBarber = state.barbers.find((b) => b.id === state.selectedBarberId);
  const selectedServices = state.services.filter((s) => state.selectedServiceIds.includes(s.id));
  const baseTotal = selectedServices.reduce((sum, s) => sum + s.basePrice, 0);
  const baseDuration = selectedServices.reduce((sum, s) => sum + s.baseDurationMinutes, 0);
  return {
    selectedBarber,
    selectedServices,
    total: selectedBarber ? selectedBarber.price : baseTotal,
    duration: selectedBarber ? selectedBarber.durationMinutes : baseDuration,
  };
}

export function BookingFlow({ barbershopSlug }: { barbershopSlug: string }) {
  const navigate = useNavigate();
  const {
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
  } = useBookingFlow(bookingApi);

  useEffect(() => {
    loadBarbershop(barbershopSlug);
  }, [barbershopSlug, loadBarbershop]);

  // Al confirmar, la cita queda guardada en este dispositivo para la pantalla "Mis citas".
  useEffect(() => {
    if (state.step !== "success" || !state.confirmation || !state.barbershop) return;
    const { selectedBarber, selectedServices, total } = summarize(state);
    saveMyAppointment({
      id: state.confirmation.id,
      code: state.confirmation.confirmationCode,
      startsAt: state.confirmation.startsAt,
      tradeName: state.barbershop.tradeName,
      slug: state.barbershop.slug ?? barbershopSlug,
      logoUrl: state.barbershop.logoUrl,
      barberName: selectedBarber?.fullName ?? "",
      serviceNames: selectedServices.map((s) => s.name),
      total,
      savedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.confirmation]);

  const leaveFlow = () => (window.history.length > 1 ? navigate(-1) : navigate("/buscar"));

  return (
    <Screen>
      {state.step === "barbershop" && <BarbershopSkeleton />}

      {state.step === "profile" && state.barbershop && (
        <ProfileStep barbershop={state.barbershop} barbers={state.profileBarbers} onBack={leaveFlow} onStart={startBooking} />
      )}

      {state.step === "service" && (
        <ServiceStep
          barbershop={state.barbershop}
          services={state.services}
          initialSelected={state.selectedServiceIds}
          onBack={goBack}
          onContinue={selectServices}
        />
      )}

      {state.step === "barber" && (
        <BarberStep barbers={state.barbers} initialSelected={state.selectedBarberId} onBack={goBack} onContinue={selectBarber} />
      )}

      {(state.step === "date" || state.step === "slots") && (
        <DateTimeStep
          selectedDate={state.selectedDate}
          slots={state.slots}
          slotsLoading={state.slotsLoading}
          initialSlot={state.selectedSlot}
          onBack={goBack}
          onSelectDate={selectDate}
          onContinue={selectSlot}
        />
      )}

      {state.step === "confirm" && (
        <ConfirmStep
          state={state}
          onBack={goBack}
          onConfirm={confirm}
          onRequestOtp={requestLoginOtp}
          onVerifyOtp={verifyLoginOtp}
        />
      )}

      {state.step === "submitting" && <ScreenLoading label="Confirmando tu cita…" />}

      {state.step === "success" && state.confirmation && <SuccessScreen state={state} confirmation={state.confirmation} />}

      {state.step === "error" && state.error && (
        <ErrorScreen
          error={state.error}
          onRetry={state.barbershop ? retry : () => loadBarbershop(barbershopSlug)}
          onChooseAlternative={state.error.alternatives ? chooseAlternativeSlot : undefined}
          onSearchAnother={() => navigate("/buscar")}
        />
      )}
    </Screen>
  );
}

// ── Estados compartidos ──

function ScreenLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
      <div className="w-10 h-10 rounded-pill border-2 border-gold border-t-transparent animate-spin" />
      <p className="text-fog text-sm">{label}</p>
    </div>
  );
}

const shimmer = "bg-gradient-to-r from-panel via-panel-raised to-panel bg-[length:200%_100%] animate-shimmer";

// Skeleton de la carga inicial — replica el layout del perfil en vez de un spinner genérico.
function BarbershopSkeleton() {
  return (
    <div>
      <div className={`h-56 ${shimmer}`} />
      <div className="-mt-12 flex justify-center">
        <div className={`w-24 h-24 rounded-pill border-4 border-night ${shimmer}`} />
      </div>
      <div className="px-5 pt-4 space-y-3">
        <div className={`h-7 w-48 rounded ${shimmer}`} />
        <div className={`h-4 w-64 rounded ${shimmer}`} />
        <div className="flex gap-4 pt-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-14 h-14 rounded-pill ${shimmer}`} />
          ))}
        </div>
      </div>
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
      <div className="w-16 h-16 rounded-pill bg-panel border border-edge flex items-center justify-center mb-4">
        <IconScissors className="w-6 h-6 text-fog" />
      </div>
      <p className="font-display text-lg mb-1">{title}</p>
      <p className="text-fog text-sm mb-6">{subtitle}</p>
      {action && <GoldButton onClick={action.onClick} className="!w-auto px-8">{action.label}</GoldButton>}
    </div>
  );
}

// ── 03 · Perfil de la barbería ──

function ProfileStep({
  barbershop,
  barbers,
  onBack,
  onStart,
}: {
  barbershop: NonNullable<BookingFlowState["barbershop"]>;
  barbers: BookingFlowState["profileBarbers"];
  onBack: () => void;
  onStart: () => void;
}) {
  const [shared, setShared] = useState(false);
  const mapsUrl = barbershop.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(barbershop.address)}`
    : null;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: barbershop.tradeName, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // El usuario canceló el menú de compartir, o el navegador no lo permite: no es un error.
    }
  };

  const circleButton =
    "w-10 h-10 flex items-center justify-center rounded-pill bg-night/60 backdrop-blur-md text-snow active:scale-95 transition";

  return (
    <div className="pb-32">
      <div
        className="relative h-56"
        style={photoBackground(
          barbershop.coverUrl ?? "/img/cover-default.jpg",
          "linear-gradient(to bottom, rgba(9,18,27,0.6) 0%, rgba(9,18,27,0.05) 40%, rgba(9,18,27,0.95) 100%)",
          "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(232,179,87,0.22), transparent 70%), linear-gradient(#0F1D29, #09121B)"
        )}
      >
        <div className="absolute top-3 inset-x-3 flex justify-between">
          <button onClick={onBack} aria-label="Volver" className={circleButton}>
            <IconChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={handleShare} aria-label="Compartir barbería" className={circleButton}>
            <IconShare className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div className="-mt-12 flex justify-center relative z-10">
        <div className="w-24 h-24 rounded-pill bg-night border-4 border-night ring-1 ring-gold/50 overflow-hidden flex items-center justify-center shadow-float">
          {barbershop.logoUrl ? (
            <img src={barbershop.logoUrl} alt={barbershop.tradeName} className="w-full h-full object-cover" />
          ) : (
            <IconScissors className="w-9 h-9 text-gold" />
          )}
        </div>
      </div>

      <div className="px-5 pt-4">
        <h1 className="font-display text-2xl font-semibold">{barbershop.tradeName}</h1>

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-fog text-sm hover:text-gold-light transition-colors"
          >
            <IconMapPin className="w-4 h-4 text-gold" />
            <span className="underline underline-offset-2 decoration-fog/40">{barbershop.address}</span>
          </a>
        )}

        {!!barbershop.completedAppointments && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 bg-gold/10 text-gold border border-gold/30 rounded-pill px-3 py-1 text-xs font-medium">
              +{barbershop.completedAppointments} citas realizadas
            </span>
          </div>
        )}

        {barbers.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-base font-medium mb-3">Nuestros barberos</h2>
            <div className="flex gap-5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
              {barbers.map((b) => (
                <div key={b.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                  <Avatar src={b.avatarUrl} name={b.fullName} size={56} />
                  <span className="text-xs text-fog truncate max-w-full">{b.fullName.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {shared && (
        <p className="fixed top-16 inset-x-0 text-center text-xs text-gold" role="status">
          Enlace copiado
        </p>
      )}

      <BottomBar>
        <GoldButton onClick={onStart}>Reservar cita</GoldButton>
      </BottomBar>
    </div>
  );
}

// ── 04 · Servicios ──

function ServiceStep({
  barbershop,
  services,
  initialSelected,
  onBack,
  onContinue,
}: {
  barbershop: BookingFlowState["barbershop"];
  services: BookingFlowState["services"];
  initialSelected: string[];
  onBack: () => void;
  onContinue: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const total = services.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + s.basePrice, 0);

  return (
    <div className="pb-40">
      <BackHeader title={barbershop?.tradeName ?? ""} onBack={onBack} centered />
      <div className="px-4 pt-2">
        <h2 className="font-display text-xl font-semibold">Selecciona un servicio</h2>
        <p className="text-fog text-xs mt-1 mb-4">Puedes elegir más de uno.</p>

        {services.length === 0 ? (
          <EmptyState title="Sin servicios disponibles" subtitle="Esta barbería aún no cargó su catálogo." />
        ) : (
          <div className="space-y-3">
            {services.map((s) => {
              const isSelected = selected.includes(s.id);
              const Icon = serviceIcon(s.name);
              return (
                <button
                  key={s.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggle(s.id)}
                  className={`w-full flex items-center gap-3.5 p-4 rounded-card border text-left transition-all active:scale-[0.99] ${
                    isSelected ? "border-gold bg-panel-raised shadow-gold-ring" : "border-edge bg-panel hover:border-edge-strong"
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl border border-edge-strong flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[15px] truncate">{s.name}</p>
                    <p className="text-xs mt-0.5">
                      <span className="text-snow">{formatCOP(s.basePrice)}</span>
                      <span className="text-fog ml-3">{s.baseDurationMinutes} min</span>
                    </p>
                  </div>
                  <SelectMark selected={isSelected} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomBar>
        {selected.length > 0 && (
          <p className="text-xs text-fog text-center">
            {selected.length} {selected.length === 1 ? "servicio" : "servicios"} · <span className="text-snow">{formatCOP(total)}</span>
          </p>
        )}
        <GoldButton disabled={selected.length === 0} onClick={() => onContinue(selected)}>
          Continuar
        </GoldButton>
      </BottomBar>
    </div>
  );
}

// ── 05 · Barbero ──

function BarberStep({
  barbers,
  initialSelected,
  onBack,
  onContinue,
}: {
  barbers: BookingFlowState["barbers"];
  initialSelected?: string;
  onBack: () => void;
  onContinue: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | undefined>(initialSelected);

  return (
    <div className="pb-32">
      <BackHeader title="Selecciona un barbero" onBack={onBack} />
      <div className="px-4 pt-2">
        {barbers.length === 0 ? (
          <EmptyState
            title="No hay barberos disponibles"
            subtitle="Ningún barbero ofrece esta combinación de servicios."
            action={{ label: "Cambiar servicios", onClick: onBack }}
          />
        ) : (
          <div className="space-y-3">
            {barbers.map((b) => {
              const isSelected = selected === b.id;
              return (
                <button
                  key={b.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelected(b.id)}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-card border text-left transition-all active:scale-[0.99] ${
                    isSelected ? "border-gold bg-panel-raised shadow-gold-ring" : "border-edge bg-panel hover:border-edge-strong"
                  }`}
                >
                  <Avatar src={b.avatarUrl} name={b.fullName} size={56} ring={isSelected} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[15px] truncate">{b.fullName}</p>
                    <p className="text-xs mt-0.5">
                      <span className="text-gold">{formatCOP(b.price)}</span>
                      <span className="text-fog ml-3">{b.durationMinutes} min</span>
                    </p>
                  </div>
                  <SelectMark selected={isSelected} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {barbers.length > 0 && (
        <BottomBar>
          <GoldButton disabled={!selected} onClick={() => selected && onContinue(selected)}>
            Continuar
          </GoldButton>
        </BottomBar>
      )}
    </div>
  );
}

// ── 06 · Fecha y hora (una sola pantalla) ──

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function DateTimeStep({
  selectedDate,
  slots,
  slotsLoading,
  initialSlot,
  onBack,
  onSelectDate,
  onContinue,
}: {
  selectedDate?: string;
  slots: Slot[];
  slotsLoading: boolean;
  initialSlot?: Slot;
  onBack: () => void;
  onSelectDate: (date: string) => void;
  onContinue: (slot: Slot) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T00:00:00`) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [picked, setPicked] = useState<Slot | undefined>(initialSlot);

  // Solo vale un horario que siga estando en la lista del día mostrado.
  const validPicked = picked && slots.some((s) => s.start === picked.start) ? picked : undefined;

  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();
  const changeMonth = (delta: number) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const firstWeekday = (viewDate.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="pb-32">
      <BackHeader title="Selecciona fecha y hora" onBack={onBack} />
      <div className="px-4 pt-2">
        <div className="bg-panel border border-edge rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => changeMonth(-1)}
              disabled={isCurrentMonth}
              aria-label="Mes anterior"
              className="w-9 h-9 flex items-center justify-center rounded-pill text-snow disabled:opacity-25 hover:bg-panel-raised transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <p className="font-display font-medium text-[15px]">{formatMonthYear(viewDate)}</p>
            <button
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
              className="w-9 h-9 flex items-center justify-center rounded-pill text-snow hover:bg-panel-raised transition-colors"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={i} className="text-center text-[10px] uppercase text-fog/70 py-1">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1.5">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const iso = toIsoDate(date);
              const isPast = date < today;
              const isToday = date.getTime() === today.getTime();
              const isSelected = iso === selectedDate;
              return (
                <div key={i} className="flex items-center justify-center">
                  <button
                    disabled={isPast}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDate(iso)}
                    className={`w-9 h-9 rounded-pill flex items-center justify-center text-sm tabular-nums transition-all
                      ${
                        isSelected
                          ? "bg-gold text-night font-semibold shadow-gold-glow"
                          : isPast
                          ? "text-fog/30"
                          : "text-snow hover:bg-panel-raised active:scale-90"
                      }
                      ${isToday && !isSelected ? "ring-1 ring-gold/60" : ""}`}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <h2 className="font-display text-[15px] font-medium mt-6 mb-3">Horarios disponibles</h2>

        {!selectedDate ? (
          <p className="text-fog text-sm">Elige un día para ver los horarios.</p>
        ) : slotsLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`h-11 rounded-xl ${shimmer}`} />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-fog text-sm">No hay horarios disponibles este día. Prueba con otra fecha.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((slot) => {
              const isSelected = validPicked?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  aria-pressed={isSelected}
                  onClick={() => setPicked(slot)}
                  className={`h-11 rounded-xl text-[13px] tabular-nums border transition-colors active:scale-[0.97] ${
                    isSelected
                      ? "bg-gold text-night border-gold font-semibold"
                      : "bg-panel border-edge text-snow hover:border-gold/60"
                  }`}
                >
                  {formatTime(slot.start)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomBar>
        <GoldButton disabled={!validPicked} onClick={() => validPicked && onContinue(validPicked)}>
          Continuar
        </GoldButton>
      </BottomBar>
    </div>
  );
}

// ── 07 · Resumen (y 08 · OTP si hace falta iniciar sesión) ──

function ConfirmStep({
  state,
  onBack,
  onConfirm,
  onRequestOtp,
  onVerifyOtp,
}: {
  state: BookingFlowState;
  onBack: () => void;
  onConfirm: (note?: string) => void;
  onRequestOtp: (phone: string, email: string) => void;
  onVerifyOtp: (code: string, fullName?: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const { selectedBarber, selectedServices, total, duration } = summarize(state);

  // Apenas el código se verifica, la reserva sigue sola: el cliente ya dijo "Confirmar cita".
  useEffect(() => {
    if (showAuth && state.authStatus === "authenticated") onConfirm(note || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuth, state.authStatus]);

  if (showAuth) {
    return (
      <AuthScreen
        state={state}
        onRequestOtp={onRequestOtp}
        onVerifyOtp={onVerifyOtp}
        onCancel={() => setShowAuth(false)}
      />
    );
  }

  const ServiceIcon = selectedServices[0] ? serviceIcon(selectedServices[0].name) : IconScissors;
  const label = "text-[11px] text-fog";

  return (
    <div className="pb-44">
      <BackHeader title="Resumen de tu cita" onBack={onBack} />
      <div className="px-4 pt-2">
        <div className="bg-panel border border-edge rounded-card divide-y divide-edge">
          {selectedBarber && (
            <div className="flex items-center gap-3 p-4">
              <Avatar src={selectedBarber.avatarUrl} name={selectedBarber.fullName} size={44} />
              <div>
                <p className={label}>Barbero</p>
                <p className="font-medium text-[15px]">{selectedBarber.fullName}</p>
              </div>
            </div>
          )}

          {state.barbershop && (
            <div className="flex items-center gap-3 p-4">
              <Avatar src={state.barbershop.logoUrl} name={state.barbershop.tradeName} size={44} />
              <div>
                <p className={label}>Barbería</p>
                <p className="font-medium text-[15px]">{state.barbershop.tradeName}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4">
            <div className="w-11 h-11 rounded-xl border border-edge-strong flex items-center justify-center flex-shrink-0">
              <ServiceIcon className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={label}>Servicio</p>
              <p className="font-medium text-[15px]">{selectedServices.map((s) => s.name).join(" + ")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-fog">{duration} min</p>
              <p className="text-sm">{formatCOP(total)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-edge">
            <div className="flex items-center gap-3 p-4">
              <IconCalendar className="w-5 h-5 text-gold flex-shrink-0" />
              <div>
                <p className={label}>Fecha</p>
                <p className="text-sm font-medium">{state.selectedDate ? formatShortDate(state.selectedDate) : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <IconClock className="w-5 h-5 text-gold flex-shrink-0" />
              <div>
                <p className={label}>Hora</p>
                <p className="text-sm font-medium">{state.selectedSlot ? formatTime(state.selectedSlot.start) : ""}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4">
            <span className="text-fog text-sm">Total</span>
            <span className="text-gold font-semibold text-lg tabular-nums">{formatCOP(total)}</span>
          </div>
        </div>

        {state.authStatus === "authenticated" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Nota para el barbero (opcional)"
            className="mt-4 w-full bg-panel border border-edge focus:border-gold rounded-card px-4 py-3 text-sm placeholder:text-fog/70 outline-none resize-none transition-colors"
          />
        )}
      </div>

      <BottomBar>
        <GoldButton
          onClick={() => (state.authStatus === "authenticated" ? onConfirm(note || undefined) : setShowAuth(true))}
        >
          Confirmar cita
        </GoldButton>
        <GhostButton onClick={onBack}>Modificar</GhostButton>
      </BottomBar>
    </div>
  );
}

// ── 08 · Verificación (OTP) ──

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={OTP_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
      />
      <div className="flex justify-between gap-2 pointer-events-none">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const ch = value[i];
          return (
            <div
              key={i}
              className={`flex-1 max-w-[52px] h-14 rounded-xl border flex items-center justify-center text-xl font-mono transition-colors ${
                ch ? "border-edge-strong bg-panel-raised text-snow" : i === activeIndex ? "border-gold bg-panel" : "border-edge bg-panel"
              }`}
            >
              {ch ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-panel border border-edge focus:border-gold rounded-card px-4 py-3.5 text-[15px] placeholder:text-fog/70 outline-none transition-colors";

function AuthScreen({
  state,
  onRequestOtp,
  onVerifyOtp,
  onCancel,
}: {
  state: BookingFlowState;
  onRequestOtp: (phone: string, email: string) => void;
  onVerifyOtp: (code: string, fullName?: string) => void;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const otpSent = state.authStatus === "otp_sent";

  // Cuenta regresiva para "Reenviar código", que arranca cada vez que se manda uno.
  useEffect(() => {
    if (!otpSent) return;
    setSecondsLeft(RESEND_SECONDS);
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [otpSent]);

  const resend = () => {
    if (secondsLeft > 0 || !state.authPhone || !state.authEmail) return;
    setCode("");
    onRequestOtp(state.authPhone, state.authEmail);
    setSecondsLeft(RESEND_SECONDS);
  };

  const lock = (
    <div className="w-14 h-14 rounded-pill border border-gold/60 flex items-center justify-center mx-auto mb-6">
      <IconLock className="w-6 h-6 text-gold" />
    </div>
  );

  // Ya verificado y la reserva está saliendo (el efecto de ConfirmStep la dispara).
  if (state.authStatus === "authenticated") return <ScreenLoading label="Confirmando tu cita…" />;

  return (
    <div
      className="min-h-screen px-6 pt-20 pb-10 flex flex-col"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,179,87,0.08), transparent 70%), linear-gradient(#09121B, #060D14)",
      }}
    >
      {lock}

      {otpSent ? (
        <>
          <h1 className="font-display text-xl font-semibold text-center">Verifica tu código</h1>
          <p className="text-fog text-sm text-center mt-2 mb-8">
            Te enviamos un código de 6 dígitos a<br />
            <span className="text-snow">{state.authEmail}</span>
          </p>

          <OtpInput value={code} onChange={setCode} />

          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre (solo si es tu primera vez)"
            className={`${inputClass} mt-6`}
          />

          {state.authError && (
            <p role="alert" className="text-ember-light text-xs mt-3 text-center">
              {state.authError}
            </p>
          )}

          <div className="mt-6">
            <GoldButton disabled={code.length < OTP_LENGTH} onClick={() => onVerifyOtp(code, fullName || undefined)}>
              Verificar y confirmar
            </GoldButton>
          </div>

          <button
            onClick={resend}
            disabled={secondsLeft > 0}
            className="mt-6 text-sm text-fog enabled:text-gold enabled:hover:text-gold-light transition-colors"
          >
            {secondsLeft > 0 ? `Reenviar código (${secondsLeft}s)` : "Reenviar código"}
          </button>
        </>
      ) : (
        <>
          <h1 className="font-display text-xl font-semibold text-center">Confirma tu identidad</h1>
          <p className="text-fog text-sm text-center mt-2 mb-8">
            Ingresa tu teléfono y correo. Te enviaremos un código de 6 dígitos para confirmar tu cita.
          </p>

          <div className="space-y-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+57 300 123 4567"
              autoComplete="tel"
              className={inputClass}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              className={inputClass}
            />
          </div>

          {state.authError && (
            <p role="alert" className="text-ember-light text-xs mt-3 text-center">
              {state.authError}
            </p>
          )}

          <div className="mt-6">
            <GoldButton disabled={phone.length < 8 || !email.includes("@")} onClick={() => onRequestOtp(phone, email)}>
              Enviar código
            </GoldButton>
          </div>
        </>
      )}

      <button onClick={onCancel} className="mt-auto pt-10 text-sm text-fog hover:text-snow transition-colors">
        Cancelar
      </button>
    </div>
  );
}

// ── 09 · Cita confirmada ──

function SuccessScreen({
  state,
  confirmation,
}: {
  state: BookingFlowState;
  confirmation: NonNullable<BookingFlowState["confirmation"]>;
}) {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { selectedBarber, selectedServices, total } = summarize(state);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(confirmation.confirmationCode);
      flash("¡Código copiado!");
    } catch {
      // Clipboard API no disponible (contexto no seguro / navegador viejo) — el código
      // sigue visible en pantalla para copiarlo a mano.
    }
  };

  const shareCode = async () => {
    const text = `Mi cita en ${state.barbershop?.tradeName ?? "la barbería"}: ${formatShortDate(confirmation.startsAt)} a las ${formatTime(
      confirmation.startsAt
    )}. Código: ${confirmation.confirmationCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        flash("Detalle copiado");
      }
    } catch {
      // Cancelado por el usuario o no disponible.
    }
  };

  const rows: Array<{ Icon: React.ComponentType<{ className?: string }>; label: string; value: string }> = [
    { Icon: IconMapPin, label: "Barbería", value: state.barbershop?.tradeName ?? "" },
    { Icon: IconUser, label: "Barbero", value: selectedBarber?.fullName ?? "" },
    { Icon: IconScissors, label: "Servicio", value: selectedServices.map((s) => s.name).join(" + ") },
    {
      Icon: IconCalendar,
      label: "Fecha",
      value: `${formatShortDate(confirmation.startsAt)}  ·  ${formatTime(confirmation.startsAt)}`,
    },
  ].filter((r) => r.value);

  return (
    <div className="px-5 pt-14 pb-44 flex flex-col items-center text-center">
      <div className="w-24 h-24 rounded-pill border-2 border-gold flex items-center justify-center mb-6 shadow-gold-glow">
        <svg viewBox="0 0 24 24" fill="none" className="w-11 h-11 text-gold" aria-hidden="true">
          <path
            d="m5 12.5 4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            className="animate-draw-check"
          />
        </svg>
      </div>

      <h1 className="font-display text-xl font-semibold">¡Tu cita ha sido agendada!</h1>
      <p className="text-fog text-sm mt-5 mb-2">Código de tu cita</p>

      <button
        onClick={copyCode}
        aria-label="Copiar código de la cita"
        className="w-full flex items-center justify-center gap-3 bg-panel border border-edge-strong rounded-card py-4 active:scale-[0.99] transition-all hover:border-gold/60"
      >
        <span className="font-mono text-3xl tracking-[0.12em] text-gold">{confirmation.confirmationCode}</span>
        <IconCopy className="w-5 h-5 text-fog" />
      </button>
      <p className="text-xs text-fog mt-2 h-4" role="status">
        {feedback ?? "Toca el código para copiarlo"}
      </p>

      <div className="w-full mt-5 bg-panel border border-edge rounded-card text-left divide-y divide-edge">
        {rows.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <Icon className="w-5 h-5 text-fog flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-fog">{label}</p>
              <p className="text-sm font-medium">{value}</p>
            </div>
          </div>
        ))}
        {total > 0 && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="w-5 text-center text-fog text-sm flex-shrink-0">$</span>
            <p className="text-sm font-medium text-gold tabular-nums">{formatCOP(total)}</p>
          </div>
        )}
      </div>

      <BottomBar>
        <GoldButton onClick={() => navigate("/mis-citas")}>Ver mi cita</GoldButton>
        <GhostButton onClick={shareCode}>
          <span className="inline-flex items-center justify-center gap-2">
            <IconShare className="w-4 h-4" />
            Compartir código
          </span>
        </GhostButton>
      </BottomBar>
    </div>
  );
}

// ── Error (timeout / network / slot ocupado / conflicto de negocio / barbería inexistente) ──

function ErrorScreen({
  error,
  onRetry,
  onChooseAlternative,
  onSearchAnother,
}: {
  error: NonNullable<BookingFlowState["error"]>;
  onRetry: () => void;
  onChooseAlternative?: (slot: Slot) => void;
  onSearchAnother: () => void;
}) {
  const isSlotConflict = error.code === "slot_no_longer_available";
  const isNotFound = error.code === "not_found";

  const title = isSlotConflict
    ? "Ese horario ya no está disponible"
    : isNotFound
    ? "No encontramos esa barbería"
    : "No pudimos completar la acción";
  const message = isNotFound ? "Revisa el nombre e inténtalo de nuevo." : error.message;

  return (
    <div className="flex flex-col items-center text-center pt-24 pb-16 px-6">
      <div className="w-16 h-16 rounded-pill bg-ember/15 flex items-center justify-center mb-4">
        <IconAlert className="w-6 h-6 text-ember-light" />
      </div>
      <p className="font-display text-lg mb-1">{title}</p>
      <p className="text-fog text-sm mb-6">{message}</p>

      {isSlotConflict && error.alternatives && error.alternatives.length > 0 && onChooseAlternative ? (
        <>
          <p className="text-xs text-fog mb-3">Estos horarios siguen libres:</p>
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {error.alternatives.slice(0, 6).map((slot) => (
              <button
                key={slot.start}
                onClick={() => onChooseAlternative(slot)}
                className="h-11 rounded-xl text-[13px] tabular-nums border border-gold/50 text-gold hover:bg-gold/10 transition-colors"
              >
                {formatTime(slot.start)}
              </button>
            ))}
          </div>
        </>
      ) : isNotFound ? (
        <GoldButton onClick={onSearchAnother} className="!w-auto px-8">
          Buscar otra barbería
        </GoldButton>
      ) : (
        <GhostButton onClick={onRetry} className="!w-auto px-8">
          Reintentar
        </GhostButton>
      )}
    </div>
  );
}
