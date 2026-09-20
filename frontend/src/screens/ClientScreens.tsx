// frontend/src/screens/ClientScreens.tsx
// Pantallas del cliente fuera del flujo de reserva, según el mockup:
//   01 Landing · 02 Búsqueda · 10 Mis citas · (Perfil, no incluido en el mockup)
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen, Logo, LogoInline, BottomNav, GoldButton, GhostButton, Avatar, photoBackground } from "../components/ui";
import { IconSearch, IconArrowRight, IconChevronRight, IconScissors } from "../components/icons";
import { bookingApi } from "../api/instance";
import { listMyAppointments, StoredAppointment } from "../lib/myAppointments";
import { formatShortDate, formatTime } from "../lib/format";
import { usePlatformBranding } from "../lib/platformBranding";

// ── 01 · Landing ──
// La foto la sube el administrador desde Configuración (o, por defecto, /public/img/hero.jpg).
// Mientras no exista ninguna se ve el degradado dorado/azul.

export function LandingScreen() {
  const navigate = useNavigate();
  const branding = usePlatformBranding();

  return (
    <Screen>
      <div
        className="relative min-h-screen flex flex-col justify-end px-6 pb-8 overflow-hidden"
        style={photoBackground(
          branding.hero,
          "linear-gradient(to bottom, rgba(9,18,27,0.2) 0%, rgba(9,18,27,0.1) 30%, rgba(9,18,27,0.9) 66%, #09121B 100%)",
          "radial-gradient(ellipse 60% 38% at 72% 16%, rgba(232,179,87,0.30), transparent 70%), radial-gradient(ellipse 55% 35% at 15% 28%, rgba(90,120,150,0.20), transparent 70%), linear-gradient(#10202D, #09121B)"
        )}
      >
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <h1 className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight">
          Tu estilo,
          <br />
          en las mejores
          <br />
          manos.
        </h1>
        <p className="text-fog text-[15px] leading-relaxed mt-4 mb-8 max-w-[19rem]">
          Encuentra y reserva tu cita en las mejores barberías de tu ciudad.
        </p>

        <GoldButton onClick={() => navigate("/buscar")}>Buscar barbería</GoldButton>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <button
            onClick={() => navigate("/negocio/entrar")}
            className="inline-flex items-center gap-2 text-fog hover:text-snow transition-colors"
          >
            ¿Eres una barbería? <span className="text-snow font-medium inline-flex items-center gap-1">Ingresar <IconArrowRight className="w-3.5 h-3.5" /></span>
          </button>
          <button
            onClick={() => navigate("/negocio/registro")}
            className="text-xs text-fog/80 underline underline-offset-2 hover:text-gold-light transition-colors"
          >
            Registrar mi barbería
          </button>
        </div>
      </div>
    </Screen>
  );
}

// ── 02 · Búsqueda ──
// El backend hoy resuelve barberías por nombre/slug (lo normaliza él), no por ciudad ni ubicación.

export function SearchScreen() {
  const navigate = useNavigate();
  const branding = usePlatformBranding();
  const [query, setQuery] = useState("");

  // "Tus barberías": las últimas donde el cliente reservó desde este dispositivo.
  const recents = useMemo(() => {
    const seen = new Set<string>();
    return listMyAppointments().filter((a) => (seen.has(a.slug) ? false : (seen.add(a.slug), true))).slice(0, 4);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/b/${encodeURIComponent(query.trim())}`);
  };

  return (
    <Screen className="pb-24">
      {/* Foto inferior de la silla (search-bg.jpg) con fundido hacia el fondo */}
      <div
        className="absolute inset-x-0 bottom-0 h-[58%] pointer-events-none"
        style={photoBackground(
          branding.searchBg,
          "linear-gradient(to bottom, #09121B 0%, rgba(9,18,27,0.55) 40%, rgba(9,18,27,0.25) 100%)",
          "radial-gradient(ellipse 60% 45% at 65% 75%, rgba(232,179,87,0.16), transparent 70%), linear-gradient(#0B1621, #09121B)"
        )}
      />

      <div className="relative z-10 px-6 pt-8">
        <div className="flex items-center justify-between mb-10">
          <LogoInline />
        </div>

        <h1 className="font-display text-[28px] leading-tight font-semibold">
          Encuentra tu
          <br />
          barbería ideal
        </h1>
        <p className="text-fog text-sm mt-3 mb-6">Escribe el nombre de tu barbería y reserva en segundos.</p>

        <form onSubmit={submit} className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fog" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre de la barbería"
            aria-label="Nombre de la barbería"
            className="w-full bg-panel/90 border border-edge focus:border-gold rounded-card text-[15px] py-3.5 pl-12 pr-14 outline-none placeholder:text-fog/70 transition-colors"
          />
          <button
            type="submit"
            aria-label="Buscar"
            disabled={!query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-pill bg-gold text-night flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
          >
            <IconArrowRight className="w-4 h-4" />
          </button>
        </form>

        {recents.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-[0.18em] text-fog mb-3">Tus barberías</h2>
            <div className="space-y-2.5">
              {recents.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => navigate(`/b/${encodeURIComponent(a.slug)}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-card bg-panel/90 border border-edge hover:border-gold/50 text-left transition-colors"
                >
                  <Avatar src={a.logoUrl} name={a.tradeName} size={40} />
                  <span className="flex-1 font-medium text-[15px] truncate">{a.tradeName}</span>
                  <IconChevronRight className="w-4 h-4 text-fog" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </Screen>
  );
}

// ── 10 · Mis citas ──

type Tab = "upcoming" | "history";

export function MyAppointmentsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("upcoming");

  const { upcoming, history } = useMemo(() => {
    const now = Date.now();
    const all = listMyAppointments();
    return {
      upcoming: all.filter((a) => new Date(a.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      history: all.filter((a) => new Date(a.startsAt).getTime() < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }, []);

  const list = tab === "upcoming" ? upcoming : history;

  return (
    <Screen className="pb-28">
      <div className="px-5 pt-10">
        <h1 className="font-display text-2xl font-semibold mb-5">Mis citas</h1>

        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-pill bg-panel border border-edge mb-5">
          {([
            ["upcoming", "Próximas"],
            ["history", "Historial"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`py-2.5 rounded-pill text-sm font-medium transition-colors ${
                tab === id ? "bg-gold text-night" : "text-fog hover:text-snow"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-14">
            <div className="w-16 h-16 rounded-pill bg-panel border border-edge flex items-center justify-center mb-4">
              <IconScissors className="w-6 h-6 text-fog" />
            </div>
            <p className="font-display text-lg mb-1">
              {tab === "upcoming" ? "No tienes citas próximas" : "Aún no tienes historial"}
            </p>
            <p className="text-fog text-sm mb-6">
              {tab === "upcoming" ? "Reserva tu próximo corte en segundos." : "Aquí aparecerán tus citas pasadas."}
            </p>
            {tab === "upcoming" && (
              <GoldButton onClick={() => navigate("/buscar")} className="!w-auto px-8">
                Buscar barbería
              </GoldButton>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <AppointmentCard key={a.id} appointment={a} past={tab === "history"} onOpen={() => navigate(`/b/${encodeURIComponent(a.slug)}`)} />
            ))}
          </div>
        )}

        <p className="text-[11px] text-fog/70 text-center mt-8">Aquí ves las citas que reservaste desde este dispositivo.</p>
      </div>

      <BottomNav />
    </Screen>
  );
}

function AppointmentCard({ appointment: a, past, onOpen }: { appointment: StoredAppointment; past: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-panel border border-edge rounded-card p-4 hover:border-edge-strong transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar src={a.logoUrl} name={a.tradeName} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[15px] truncate">{a.tradeName}</p>
          <p className="text-xs text-fog mt-0.5">
            {formatShortDate(a.startsAt)} · {formatTime(a.startsAt)}
          </p>
          <p className="text-xs text-fog mt-1.5 truncate">
            {[a.barberName, a.serviceNames.join(" + ")].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-edge">
        <span className="font-mono text-sm text-gold tracking-wider">#{a.code}</span>
        <span
          className={`text-[11px] font-medium rounded-pill px-2.5 py-1 border ${
            past ? "text-fog border-edge-strong" : "text-moss-light border-moss-light/50"
          }`}
        >
          {past ? "Pasada" : "Confirmada"}
        </span>
      </div>
    </button>
  );
}

// ── Perfil ──

export function ProfileScreen() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(bookingApi.isAuthenticated());

  const logout = async () => {
    await bookingApi.logout();
    setAuthenticated(false);
  };

  return (
    <Screen className="pb-28">
      <div className="px-5 pt-10">
        <h1 className="font-display text-2xl font-semibold mb-5">Perfil</h1>

        <div className="bg-panel border border-edge rounded-card p-4 mb-6">
          <p className="font-medium text-[15px]">{authenticated ? "Sesión iniciada" : "Aún no has iniciado sesión"}</p>
          <p className="text-fog text-sm mt-1 mb-4">
            {authenticated
              ? "Tu sesión queda guardada en este dispositivo para reservar más rápido."
              : "Te pediremos un código por correo cuando confirmes tu primera cita."}
          </p>
          {authenticated && <GhostButton onClick={logout}>Cerrar sesión</GhostButton>}
        </div>

        <h2 className="text-xs uppercase tracking-[0.18em] text-fog mb-3">Para barberías</h2>
        <div className="space-y-3">
          <GhostButton onClick={() => navigate("/negocio/entrar")}>Ingresar al panel</GhostButton>
          <GhostButton onClick={() => navigate("/negocio/registro")}>Registrar mi barbería</GhostButton>
        </div>
      </div>

      <BottomNav />
    </Screen>
  );
}
