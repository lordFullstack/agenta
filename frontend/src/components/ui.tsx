// frontend/src/components/ui.tsx
// Piezas visuales compartidas del lado cliente (tema oscuro + dorado del mockup).
import React from "react";
import { NavLink } from "react-router-dom";
import { IconScissors, IconChevronLeft, IconHome, IconSearch, IconCalendar, IconUser } from "./icons";
import { hasMyAppointments } from "../lib/myAppointments";
import { bookingApi } from "../api/instance";

// ── Contenedor de pantalla: columna móvil centrada, fondo noche ──

export function Screen({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-night text-snow font-body">
      <div className={`relative mx-auto w-full max-w-md min-h-screen ${className}`}>{children}</div>
    </div>
  );
}

// ── Marca ──

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const icon = size === "lg" ? "w-10 h-10" : size === "md" ? "w-8 h-8" : "w-6 h-6";
  const word = size === "lg" ? "text-[22px] tracking-[0.42em]" : size === "md" ? "text-lg tracking-[0.4em]" : "text-sm tracking-[0.4em]";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <IconScissors className={`${icon} text-gold`} />
      <span className={`font-display font-medium text-snow ${word} pl-[0.4em]`}>AGENTA</span>
      {size !== "sm" && <span className="text-[8px] tracking-[0.5em] text-fog pl-[0.5em]">BARBER BOOKING</span>}
    </div>
  );
}

/** Versión horizontal compacta (ícono + palabra) para encabezados. */
export function LogoInline() {
  return (
    <div className="flex items-center gap-2.5">
      <IconScissors className="w-6 h-6 text-gold" />
      <span className="font-display font-medium text-sm tracking-[0.4em] text-snow">AGENTA</span>
    </div>
  );
}

// ── Fondos con foto: la imagen va encima de un degradado, así que si el archivo
//    todavía no existe en /public/img se ve el degradado y no un hueco. ──

export function photoBackground(url: string | null | undefined, overlay: string, fallback: string): React.CSSProperties {
  const layers = [overlay, url ? `url("${url}")` : null, fallback].filter(Boolean).join(", ");
  return { backgroundImage: layers, backgroundSize: "cover", backgroundPosition: "center" };
}

// ── Encabezado con flecha atrás ──

export function BackHeader({
  title,
  onBack,
  right,
  centered = false,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 h-14 px-3 bg-night/90 backdrop-blur-md">
      <button
        onClick={onBack}
        aria-label="Volver"
        className="w-10 h-10 flex items-center justify-center rounded-pill text-snow hover:bg-panel active:scale-95 transition"
      >
        <IconChevronLeft className="w-5 h-5" />
      </button>
      <h1 className={`flex-1 font-display text-[15px] font-medium truncate ${centered ? "text-center" : ""}`}>{title}</h1>
      <div className="w-10 h-10 flex items-center justify-center">{right}</div>
    </header>
  );
}

// ── Botones ──

const buttonBase = "w-full rounded-pill font-body font-semibold text-[15px] py-3.5 transition-all duration-150 active:scale-[0.98]";

export function GoldButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${buttonBase} bg-gold text-night shadow-gold-glow hover:enabled:bg-gold-light disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${buttonBase} border border-edge-strong text-snow hover:enabled:border-gold/60 hover:enabled:text-gold-light disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Barra fija inferior para el botón principal de cada paso. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-night via-night/95 to-night/0 pt-6">
      <div
        className="mx-auto w-full max-w-md px-4 flex flex-col gap-3"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Avatar: foto o inicial ──

export function Avatar({
  src,
  name,
  size = 48,
  ring = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-pill overflow-hidden flex-shrink-0 bg-panel-raised flex items-center justify-center ${
        ring ? "ring-2 ring-gold" : "ring-1 ring-edge-strong"
      }`}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-display font-semibold text-gold" style={{ fontSize: size * 0.4 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// ── Círculo de selección (check dorado) ──

export function SelectMark({ selected }: { selected: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-pill flex items-center justify-center flex-shrink-0 transition-colors ${
        selected ? "bg-gold text-night" : "border border-edge-strong"
      }`}
    >
      {selected && (
        <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Navegación inferior de la app cliente ──
// "Mis citas" aparece solo cuando hay algo que mostrar (o sesión iniciada), como en el mockup:
// la pantalla 02 muestra 3 pestañas y la 10 muestra 4.

export function BottomNav() {
  const showAppointments = hasMyAppointments() || bookingApi.isAuthenticated();
  const items = [
    { to: "/", label: "Inicio", Icon: IconHome, end: true },
    { to: "/buscar", label: "Buscar", Icon: IconSearch, end: false },
    ...(showAppointments ? [{ to: "/mis-citas", label: "Mis citas", Icon: IconCalendar, end: false }] : []),
    { to: "/perfil", label: "Perfil", Icon: IconUser, end: false },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-night/95 backdrop-blur-md border-t border-edge">
      <div
        className="mx-auto w-full max-w-md flex justify-around pt-2"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 min-w-[64px] py-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-gold" : "text-fog hover:text-snow"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
