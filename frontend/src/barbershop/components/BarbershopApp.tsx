// frontend/src/barbershop/components/BarbershopApp.tsx
import React, { useState } from "react";
import { useBarbershopApp, AppointmentRow } from "../hooks/useBarbershopApp";
import { BarbershopApiClient, ApiError } from "../api/barbershop-api-client";
import {
  IconHome,
  IconCalendar,
  IconScissors,
  IconUsers,
  IconSettings,
  IconLogout,
  IconPlus,
  IconPhone,
  IconLock,
  IconImage,
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
} from "../../components/icons";

const api = new BarbershopApiClient((import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000");

/**
 * Login sin conocer el branchId de antemano: autentica y resuelve la sucursal
 * principal del propio tenant — evita que el owner tenga que escribir su UUID a
 * mano (fuente de errores reales, ver ISSUE de branchId inválido en la URL).
 */
export async function loginAndGetBranchId(identifier: string, password: string): Promise<string> {
  await api.login(identifier, password);
  const { branch } = await api.getMyBranch();
  return branch.id;
}

const ROLE_LABEL: Record<string, string> = { owner: "Dueño/a", branch_admin: "Administración", barber: "Barbero" };

export function BarbershopApp({ branchId }: { branchId: string }) {
  const app = useBarbershopApp(api, branchId);

  return (
    <div className="min-h-screen bg-ink text-bone font-body">
      {app.screen === "login" && <LoginScreen onLogin={app.login} error={app.loginError} />}
      {app.session && app.screen !== "login" && (
        <div className="lg:flex">
          <SideNav
            screen={app.screen}
            onNavigate={app.setScreen}
            onLogout={app.logout}
            role={app.session.role}
            tenant={app.tenant}
          />
          <main className="flex-1 min-w-0 px-4 py-6 lg:px-10 lg:py-9 max-w-6xl">
            {app.screen === "dashboard" && (
              <DashboardScreen agenda={app.agenda} loading={app.agendaLoading} onGoAgenda={() => app.setScreen("agenda")} />
            )}
            {app.screen === "agenda" && (
              <AgendaScreen
                agenda={app.agenda}
                loading={app.agendaLoading}
                error={app.agendaError}
                actionError={app.actionError}
                onLoadDate={(date) => app.loadAgenda(date)}
                onUpdateStatus={app.updateStatus}
                onCreateWalkIn={app.createWalkIn}
              />
            )}
            {app.screen === "services" && (
              <ServicesScreen
                services={app.services}
                loading={app.servicesLoading}
                error={app.actionError}
                onCreate={app.createService}
                onDeactivate={app.deactivateService}
              />
            )}
            {app.screen === "staff" && (
              <StaffScreen
                staff={app.staff}
                services={app.services}
                loading={app.staffLoading}
                error={app.actionError}
                onInvite={app.inviteStaff}
                onToggleStatus={app.toggleStaffStatus}
                onAssignService={app.assignService}
                onUploadPhoto={app.uploadStaffPhoto}
                getStaffServices={app.getStaffServices}
              />
            )}
            {app.screen === "settings" && (
              <SettingsScreen
                tenant={app.tenant}
                businessHours={app.businessHours}
                loading={app.settingsLoading}
                error={app.settingsError}
                saved={app.settingsSaved}
                onSaveProfile={app.saveTenantProfile}
                onSaveHours={app.saveBusinessHours}
                onUploadLogo={app.uploadLogo}
                onUploadCover={app.uploadCover}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// ── Input compartido: contenedor + ícono + error inline visible ──

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  error,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ComponentType<{ className?: string }>;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-steel mb-1.5">{label}</label>
      <div
        className={`flex items-center gap-2.5 bg-bone/5 border rounded-lg px-3.5 py-2.5 transition-colors
          ${error ? "border-ember/70" : "border-steel/30 focus-within:border-brass"}`}
      >
        {Icon && <Icon className="w-4 h-4 text-steel flex-shrink-0" />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-bone text-sm outline-none placeholder:text-steel/60"
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-ember text-xs mt-1.5">
          <IconAlert className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Login ──

export function LoginScreen({ onLogin, error }: { onLogin: (id: string, pw: string) => void; error?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-ink text-bone font-body flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/agenta-logo.svg" alt="Agenta" className="h-10 w-auto mb-6" />
          <h1 className="font-display text-2xl font-semibold mb-1">Panel de gestión</h1>
          <p className="text-steel text-sm">Ingresá con la cuenta de tu barbería</p>
        </div>

        <div className="bg-bone/[0.04] border border-steel/15 rounded-2xl p-5 flex flex-col gap-4">
          <Field label="Teléfono o email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+54 9 11 5555-0000" icon={IconPhone} />
          <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" icon={IconLock} />
          {error && (
            <p className="flex items-center gap-1.5 text-ember text-xs -mt-1">
              <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}
          <button
            onClick={() => onLogin(identifier, password)}
            disabled={!identifier || !password}
            className="w-full bg-brass text-ink font-semibold rounded-full py-3.5 disabled:opacity-40
              hover:enabled:bg-brass-light active:scale-95 transition-all"
          >
            Ingresar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Registro — onboarding público, punto de entrada para una barbería nueva ──

export function RegisterBarbershopScreen({ onRegistered }: { onRegistered: (branchId: string) => void }) {
  const [form, setForm] = useState({
    tradeName: "",
    legalName: "",
    ownerFullName: "",
    ownerPhone: "",
    ownerPassword: "",
  });
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const fieldErrors = {
    tradeName: form.tradeName.trim() ? undefined : "Ingresá el nombre comercial de tu barbería.",
    legalName: form.legalName.trim() ? undefined : "Ingresá la razón social.",
    ownerPhone: form.ownerPhone.trim() ? undefined : "Ingresá un teléfono de contacto.",
    ownerPassword: form.ownerPassword.length >= 8 ? undefined : "La contraseña necesita al menos 8 caracteres.",
  };
  const canSubmit = !fieldErrors.tradeName && !fieldErrors.legalName && !fieldErrors.ownerPhone && !fieldErrors.ownerPassword;

  const submit = async () => {
    if (!canSubmit) {
      setShowErrors(true);
      return;
    }
    if (loading) return;
    setError(undefined);
    setLoading(true);
    try {
      const result = await api.registerBarbershop({
        tradeName: form.tradeName.trim(),
        legalName: form.legalName.trim(),
        ownerFullName: form.ownerFullName.trim() || undefined,
        ownerPhone: form.ownerPhone.trim(),
        ownerPassword: form.ownerPassword,
      });
      onRegistered(result.branchId);
    } catch (err) {
      if (err instanceof ApiError && err.code === "phone_already_registered") {
        setError("Ese teléfono ya tiene una cuenta. Iniciá sesión en vez de registrarte.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No pudimos registrar la barbería. Probá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-bone font-body flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <img src="/agenta-logo.svg" alt="Agenta" className="h-10 w-auto mb-6" />
          <h1 className="font-display text-2xl font-semibold mb-1 text-center">Registrá tu barbería</h1>
          <p className="text-steel text-sm text-center">Creá la cuenta del dueño/a y tu primera sucursal</p>
        </div>

        <div className="bg-bone/[0.04] border border-steel/15 rounded-2xl p-5 flex flex-col gap-4">
          <Field
            label="Nombre comercial"
            value={form.tradeName}
            onChange={set("tradeName")}
            placeholder="Barbería El Corte"
            icon={IconScissors}
            error={showErrors ? fieldErrors.tradeName : undefined}
          />
          <Field
            label="Razón social"
            value={form.legalName}
            onChange={set("legalName")}
            placeholder="El Corte SRL"
            error={showErrors ? fieldErrors.legalName : undefined}
          />
          <Field label="Tu nombre (opcional)" value={form.ownerFullName} onChange={set("ownerFullName")} placeholder="Nombre y apellido" />
          <Field
            label="Tu teléfono"
            value={form.ownerPhone}
            onChange={set("ownerPhone")}
            placeholder="+54 9 11 5555-0000"
            icon={IconPhone}
            error={showErrors ? fieldErrors.ownerPhone : undefined}
          />
          <Field
            label="Contraseña (mín. 8 caracteres)"
            type="password"
            value={form.ownerPassword}
            onChange={set("ownerPassword")}
            placeholder="••••••••"
            icon={IconLock}
            error={showErrors ? fieldErrors.ownerPassword : undefined}
          />

          {error && (
            <p className="flex items-center gap-1.5 text-ember text-xs">
              <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-brass text-ink font-semibold rounded-full py-3.5 disabled:opacity-60
              hover:enabled:bg-brass-light active:scale-95 transition-all"
          >
            {loading ? "Creando cuenta…" : "Crear mi barbería"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Navegación lateral (rail — esta app es de uso mayormente en mostrador/tablet) ──

function SideNav({
  screen,
  onNavigate,
  onLogout,
  role,
  tenant,
}: {
  screen: string;
  onNavigate: (s: any) => void;
  onLogout: () => void;
  role: string;
  tenant: any;
}) {
  const items = [
    { id: "dashboard", label: "Inicio", icon: IconHome },
    { id: "agenda", label: "Agenda", icon: IconCalendar },
    { id: "services", label: "Servicios", icon: IconScissors },
    { id: "staff", label: "Barberos", icon: IconUsers },
    { id: "settings", label: "Configuración", icon: IconSettings },
  ];
  return (
    <nav className="lg:w-60 lg:min-h-screen lg:flex-shrink-0 bg-bone/[0.03] border-b lg:border-b-0 lg:border-r border-steel/15 px-4 py-4 lg:py-6 lg:flex lg:flex-col">
      <div className="hidden lg:flex items-center gap-2.5 px-2 pb-6 mb-2 border-b border-steel/15">
        <div className="w-9 h-9 rounded-lg bg-steel/10 overflow-hidden flex items-center justify-center flex-shrink-0">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <IconScissors className="w-4 h-4 text-brass-light" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{tenant?.trade_name || "Tu barbería"}</p>
          <p className="text-[11px] text-steel">{ROLE_LABEL[role] ?? role}</p>
        </div>
      </div>

      <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left whitespace-nowrap transition-colors flex-shrink-0
                ${active ? "bg-brass/15 text-brass font-medium" : "text-steel hover:bg-bone/5 hover:text-bone"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left text-ember/80 hover:bg-ember/10 hover:text-ember whitespace-nowrap transition-colors flex-shrink-0 lg:mt-auto"
        >
          <IconLogout className="w-4 h-4 flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}

// ── Badges de estado — un color por estado, ver docs/DESIGN_SYSTEM.md §10 ──

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-brass/15 text-brass-light" },
  confirmed: { label: "Confirmado", cls: "bg-steel/15 text-bone" },
  in_progress: { label: "En curso", cls: "bg-brass text-ink" },
  completed: { label: "Completado", cls: "bg-moss/15 text-moss-light" },
  no_show: { label: "No-show", cls: "bg-ember/15 text-ember-light" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_PILL[status] ?? { label: status, cls: "bg-steel/15 text-steel" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium ${meta.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-pill ${status === "in_progress" ? "bg-ink animate-pulse" : "bg-current opacity-70"}`} />
      {meta.label}
    </span>
  );
}

// ── Dashboard ──

function DashboardScreen({ agenda, loading, onGoAgenda }: { agenda: AppointmentRow[]; loading: boolean; onGoAgenda: () => void }) {
  const pending = agenda.filter((a) => a.status === "confirmed" || a.status === "pending").length;
  const inProgress = agenda.find((a) => a.status === "in_progress");
  const billedToday = agenda
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + (parseFloat(a.price_total) || 0), 0);

  const upcoming = agenda
    .filter((a) => a.status === "pending" || a.status === "confirmed")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 4);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-6">Hoy</h1>

      {inProgress && (
        <div className="flex items-center gap-3 bg-brass/10 border border-brass/30 rounded-2xl px-4 py-3 mb-5">
          <span className="w-2 h-2 rounded-pill bg-brass-light flex-shrink-0 animate-pulse" />
          <p className="text-sm">
            <span className="font-medium">En curso ahora</span> — {inProgress.customer_name} con {inProgress.staff_name}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-bone text-ink rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-steel">Citas de hoy</p>
            <div className="w-7 h-7 rounded-lg bg-brass/15 flex items-center justify-center">
              <IconCalendar className="w-3.5 h-3.5 text-brass-dark" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold">{loading ? "…" : agenda.length}</p>
        </div>
        <div className="bg-bone text-ink rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-steel">Pendientes</p>
            <div className="w-7 h-7 rounded-lg bg-ember/10 flex items-center justify-center">
              <IconAlert className="w-3.5 h-3.5 text-ember" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold">{loading ? "…" : pending}</p>
        </div>
        <div className="bg-bone text-ink rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-steel">Facturado hoy</p>
            <div className="w-7 h-7 rounded-lg bg-moss/15 flex items-center justify-center">
              <IconScissors className="w-3.5 h-3.5 text-moss" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold font-mono tabular-nums">
            {loading ? "…" : `$${billedToday.toLocaleString("es-AR")}`}
          </p>
        </div>
      </div>

      <div className="bg-bone/[0.04] border border-steel/15 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold">Próximos turnos</h2>
          <button onClick={onGoAgenda} className="flex items-center gap-1 text-xs text-brass-light hover:text-brass-dark transition-colors">
            Ver agenda completa
            <IconChevronRight className="w-3 h-3" />
          </button>
        </div>
        {loading ? (
          <p className="text-steel text-sm py-4">Cargando…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-steel text-sm py-4">No hay turnos pendientes para hoy.</p>
        ) : (
          <div className="divide-y divide-steel/10">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-xs text-steel w-11 flex-shrink-0">
                  {new Date(a.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.customer_name}</p>
                  <p className="text-xs text-steel truncate">con {a.staff_name}</p>
                </div>
                <StatusPill status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agenda ──

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function AgendaScreen({
  agenda,
  loading,
  error,
  actionError,
  onLoadDate,
  onUpdateStatus,
  onCreateWalkIn,
}: {
  agenda: AppointmentRow[];
  loading: boolean;
  error?: string;
  actionError?: string;
  onLoadDate: (date: string) => void;
  onUpdateStatus: (id: string, status: string, date: string) => void;
  onCreateWalkIn: (input: any, date: string) => Promise<boolean>;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showWalkIn, setShowWalkIn] = useState(false);

  const nextStatus: Record<string, string> = { pending: "confirmed", confirmed: "in_progress", in_progress: "completed" };
  const statusLabel: Record<string, string> = { pending: "Confirmar", confirmed: "Iniciar", in_progress: "Completar" };

  const goTo = (d: string) => {
    setDate(d);
    onLoadDate(d);
  };

  const rawDate = new Date(date + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const formattedDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="font-display text-2xl font-semibold mr-auto">{formattedDate}</h1>
        <div className="flex items-center gap-1 bg-bone/5 border border-steel/25 rounded-lg">
          <button
            onClick={() => goTo(shiftDate(date, -1))}
            aria-label="Día anterior"
            className="w-8 h-8 flex items-center justify-center text-steel hover:text-bone transition-colors"
          >
            <IconChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => goTo(e.target.value)}
            className="bg-transparent px-1 py-2 text-sm outline-none"
          />
          <button
            onClick={() => goTo(shiftDate(date, 1))}
            aria-label="Día siguiente"
            className="w-8 h-8 flex items-center justify-center text-steel hover:text-bone transition-colors"
          >
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionError && (
        <p className="flex items-center gap-1.5 text-ember text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </p>
      )}

      {loading && <p className="text-steel text-sm">Cargando…</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-ember text-sm">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {!loading && !error && agenda.length === 0 && <p className="text-steel text-sm mb-6">Sin citas para este día.</p>}

      {!loading && !error && agenda.length > 0 && (
        <div className="bg-bone/[0.03] border border-steel/15 rounded-2xl overflow-hidden mb-6">
          <table className="agenda-table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-steel/15">
                <th className="text-left text-[11px] uppercase tracking-wide text-steel font-medium px-4 py-3">Hora</th>
                <th className="text-left text-[11px] uppercase tracking-wide text-steel font-medium px-4 py-3">Cliente</th>
                <th className="text-left text-[11px] uppercase tracking-wide text-steel font-medium px-4 py-3">Barbero</th>
                <th className="text-left text-[11px] uppercase tracking-wide text-steel font-medium px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {agenda.map((a) => (
                <tr key={a.id} className="border-b border-steel/10 last:border-none hover:bg-bone/[0.03] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-steel align-middle" data-label="Hora">
                    {new Date(a.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 align-middle" data-label="Cliente">
                    <p className="font-medium">{a.customer_name}</p>
                    <p className="text-xs text-steel">{a.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 align-middle text-steel" data-label="Barbero">
                    {a.staff_name}
                  </td>
                  <td className="px-4 py-3 align-middle" data-label="Estado">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex gap-2 justify-end">
                      {nextStatus[a.status] && (
                        <button
                          onClick={() => onUpdateStatus(a.id, nextStatus[a.status], date)}
                          className="text-xs bg-brass/15 text-brass-light hover:bg-brass/25 px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors"
                        >
                          {statusLabel[a.status]}
                        </button>
                      )}
                      {(a.status === "pending" || a.status === "confirmed") && (
                        <button
                          onClick={() => onUpdateStatus(a.id, "no_show", date)}
                          className="text-xs border border-ember/40 text-ember-light hover:bg-ember/10 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
                        >
                          No-show
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => setShowWalkIn(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-pill bg-brass text-ink shadow-float hover:bg-brass-light
          flex items-center justify-center active:scale-95 transition-all z-30"
        aria-label="Cargar walk-in"
      >
        <IconPlus className="w-6 h-6" />
      </button>

      {showWalkIn && (
        <WalkInSheet
          date={date}
          onClose={() => setShowWalkIn(false)}
          onSubmit={async (input) => {
            const ok = await onCreateWalkIn(input, date);
            if (ok) setShowWalkIn(false);
          }}
        />
      )}
    </div>
  );
}

function WalkInSheet({ date, onClose, onSubmit }: { date: string; onClose: () => void; onSubmit: (input: any) => void }) {
  const [staffId, setStaffId] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [time, setTime] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:mx-auto bg-bone text-ink rounded-t-sheet sm:rounded-b-sheet p-5 pb-8">
        <div className="w-9 h-1 bg-steel/30 rounded-pill mx-auto mb-4 sm:hidden" />
        <h2 className="font-display text-xl font-semibold mb-4">Cargar walk-in</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-steel mb-1.5">ID del barbero</label>
            <input
              placeholder="ID del barbero"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1.5">Teléfono del cliente</label>
            <input
              placeholder="+54 9 11 5555-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1.5">Nombre (opcional)</label>
            <input
              placeholder="Nombre del cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1.5">Hora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
            />
          </div>
        </div>
        <button
          onClick={() =>
            onSubmit({
              staffId,
              customerPhone: phone,
              customerFullName: name || undefined,
              serviceIds: [],
              startsAt: `${date}T${time}:00`,
            })
          }
          className="w-full bg-brass text-ink font-semibold rounded-full py-3.5 hover:bg-brass-light active:scale-95 transition-all mt-5"
        >
          Confirmar walk-in
        </button>
      </div>
    </div>
  );
}

// ── Servicios ──

function ServicesScreen({
  services,
  loading,
  error,
  onCreate,
  onDeactivate,
}: {
  services: any[];
  loading: boolean;
  error?: string;
  onCreate: (input: any) => Promise<boolean>;
  onDeactivate: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Servicios</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-brass text-ink rounded-full pl-3.5 pr-4 py-2 text-sm font-medium hover:bg-brass-light transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-ember text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {showForm && (
        <div className="bg-bone text-ink rounded-2xl p-4 mb-5 flex flex-col gap-3">
          <input
            placeholder="Nombre del servicio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
          />
          <input
            placeholder="Precio"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
          />
          <input
            placeholder="Duración (minutos)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
          />
          <button
            onClick={async () => {
              const ok = await onCreate({ name, base_price: Number(price), base_duration_minutes: Number(duration) });
              if (ok) {
                setShowForm(false);
                setName("");
                setPrice("");
                setDuration("");
              }
            }}
            disabled={!name || !price || !duration}
            className="w-full bg-brass text-ink font-semibold rounded-full py-2.5 disabled:opacity-40 hover:enabled:bg-brass-light transition-colors"
          >
            Guardar servicio
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-steel text-sm">Cargando…</p>
      ) : services.length === 0 ? (
        <p className="text-steel text-sm">Todavía no cargaste ningún servicio.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3.5 bg-bone/[0.03] border border-steel/15 rounded-2xl px-4 py-3.5 hover:border-steel/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-brass/15 flex items-center justify-center flex-shrink-0">
                <IconScissors className="w-4 h-4 text-brass-light" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-steel text-xs">{s.baseDurationMinutes} min</p>
              </div>
              <p className="font-mono tabular-nums text-sm font-medium mr-2">${s.basePrice}</p>
              <button onClick={() => onDeactivate(s.id)} className="text-xs text-ember/80 hover:text-ember-light transition-colors whitespace-nowrap">
                Desactivar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Barberos ──

function StaffScreen({
  staff,
  services,
  loading,
  error,
  onInvite,
  onToggleStatus,
  onAssignService,
  onUploadPhoto,
  getStaffServices,
}: {
  staff: any[];
  services: any[];
  loading: boolean;
  error?: string;
  onInvite: (input: any) => Promise<boolean>;
  onToggleStatus: (staffId: string, currentStatus: string) => void;
  onAssignService: (staffId: string, serviceId: string) => void;
  onUploadPhoto: (staffId: string, file: File) => void;
  getStaffServices: (staffId: string) => Promise<{ services: any[] }>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);

  async function expand(staffId: string) {
    if (expandedStaffId === staffId) {
      setExpandedStaffId(null);
      return;
    }
    const { services: assigned } = await getStaffServices(staffId);
    setAssignedServiceIds(assigned.map((a: any) => a.service_id));
    setExpandedStaffId(staffId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Barberos</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-brass text-ink rounded-full pl-3.5 pr-4 py-2 text-sm font-medium hover:bg-brass-light transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          Invitar
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-ember text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {showForm && (
        <div className="bg-bone text-ink rounded-2xl p-4 mb-5 flex flex-col gap-3">
          <p className="text-xs text-steel">
            Definís una contraseña temporal para que el barbero entre por primera vez — se la comunicás vos directamente.
          </p>
          <input
            placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
          />
          <input
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
          />
          <input
            placeholder="Contraseña temporal"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass"
          />
          <button
            onClick={async () => {
              const ok = await onInvite({ phone, full_name: fullName, temp_password: tempPassword });
              if (ok) {
                setShowForm(false);
                setPhone("");
                setFullName("");
                setTempPassword("");
              }
            }}
            disabled={!phone || !fullName || !tempPassword}
            className="w-full bg-brass text-ink font-semibold rounded-full py-2.5 disabled:opacity-40 hover:enabled:bg-brass-light transition-colors"
          >
            Invitar barbero
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-steel text-sm">Cargando…</p>
      ) : staff.length === 0 ? (
        <p className="text-steel text-sm">Todavía no invitaste a ningún barbero.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {staff.map((s) => (
            <div key={s.id} className="bg-bone/[0.03] border border-steel/15 rounded-2xl px-4 py-3.5 hover:border-steel/30 transition-colors">
              <div className="flex items-center gap-3.5">
                <label className="relative w-11 h-11 rounded-pill bg-steel/10 overflow-hidden flex-shrink-0 cursor-pointer">
                  {s.avatar_url && <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />}
                  {!s.avatar_url && (
                    <div className="w-full h-full flex items-center justify-center font-display font-semibold text-steel">
                      {s.full_name.charAt(0)}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => e.target.files?.[0] && onUploadPhoto(s.id, e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{s.full_name}</p>
                  <p className="text-steel text-xs">{s.phone}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-pill text-[10px] font-medium whitespace-nowrap ${
                    s.status === "active" ? "bg-moss/15 text-moss-light" : "bg-steel/15 text-steel"
                  }`}
                >
                  {s.status === "active" ? "Activo" : "Pausado"}
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => expand(s.id)}
                    className="text-xs border border-steel/30 hover:border-steel/50 px-3 py-1.5 rounded-full transition-colors"
                  >
                    Servicios
                  </button>
                  <button
                    onClick={() => onToggleStatus(s.id, s.status)}
                    className="text-xs border border-steel/30 hover:border-steel/50 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s.status === "active" ? "Pausar" : "Reactivar"}
                  </button>
                </div>
              </div>
              {expandedStaffId === s.id && (
                <div className="mt-3 pt-3 border-t border-steel/15 space-y-2">
                  {services.map((sv) => (
                    <label key={sv.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        defaultChecked={assignedServiceIds.includes(sv.id)}
                        onChange={() => onAssignService(s.id, sv.id)}
                        className="accent-brass"
                      />
                      {sv.name}
                    </label>
                  ))}
                  {services.length === 0 && <p className="text-steel text-xs">Cargá servicios primero.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Configuración ──

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

function SettingsScreen({
  tenant,
  businessHours,
  loading,
  error,
  saved,
  onSaveProfile,
  onSaveHours,
  onUploadLogo,
  onUploadCover,
}: {
  tenant: any;
  businessHours: any[];
  loading: boolean;
  error?: string;
  saved: boolean;
  onSaveProfile: (updates: any) => void;
  onSaveHours: (hours: any[]) => void;
  onUploadLogo: (file: File) => void;
  onUploadCover: (file: File) => void;
}) {
  const [tradeName, setTradeName] = useState(tenant?.trade_name ?? "");
  const [opensAt, setOpensAt] = useState("09:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat"]);

  React.useEffect(() => {
    if (tenant?.trade_name) setTradeName(tenant.trade_name);
  }, [tenant]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-6">Configuración</h1>

      {loading && <p className="text-steel text-sm mb-4">Cargando…</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-ember text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-1.5 text-moss-light text-sm mb-4 bg-moss/10 border border-moss/25 rounded-lg px-3 py-2 w-fit">
          Cambios guardados.
        </p>
      )}

      <section className="bg-bone/[0.03] border border-steel/15 rounded-2xl p-5 mb-5">
        <h2 className="font-display text-lg font-semibold mb-4">Imagen</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-pill bg-steel/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {tenant?.logo_url ? <img src={tenant.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <IconImage className="w-6 h-6 text-steel" />}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-bone bg-bone/10 hover:bg-bone/15 border border-steel/25 rounded-full px-3 py-2 cursor-pointer w-fit transition-colors">
              <IconImage className="w-3.5 h-3.5" />
              Subir logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && onUploadLogo(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <div>
          <div className="w-full h-28 rounded-xl bg-steel/10 overflow-hidden mb-2 flex items-center justify-center">
            {tenant?.cover_url ? <img src={tenant.cover_url} alt="Portada" className="w-full h-full object-cover" /> : <IconImage className="w-6 h-6 text-steel" />}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-bone bg-bone/10 hover:bg-bone/15 border border-steel/25 rounded-full px-3 py-2 cursor-pointer w-fit transition-colors">
            <IconImage className="w-3.5 h-3.5" />
            Subir portada
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => e.target.files?.[0] && onUploadCover(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
      </section>

      <section className="bg-bone/[0.03] border border-steel/15 rounded-2xl p-5 mb-5">
        <h2 className="font-display text-lg font-semibold mb-4">Perfil</h2>
        <label className="block text-xs font-medium text-steel mb-1.5">Nombre comercial</label>
        <input
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          className="w-full bg-ink/5 border border-steel/25 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-brass mb-4"
        />
        <button
          onClick={() => onSaveProfile({ tradeName })}
          className="bg-brass text-ink rounded-full px-4 py-2 text-sm font-medium hover:bg-brass-light transition-colors"
        >
          Guardar perfil
        </button>
      </section>

      <section className="bg-bone/[0.03] border border-steel/15 rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-4">Horario general</h2>

        <div className="mb-4">
          {businessHours.length === 0 ? (
            <p className="text-steel text-sm">Sin horario cargado todavía.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {businessHours.map((h: any, i: number) => (
                <p key={i} className="text-sm text-steel font-mono">
                  {h.day_of_week}: {h.opens_at} – {h.closes_at}
                </p>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-steel mb-2">Aplicar el mismo horario a:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDays((prev) => (prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key]))}
              aria-pressed={selectedDays.includes(d.key)}
              className={`px-2.5 py-1 rounded-pill text-xs border transition-colors ${
                selectedDays.includes(d.key) ? "bg-brass text-ink border-brass" : "border-steel/30 text-steel hover:border-steel/50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mb-4">
          <input
            type="time"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="bg-ink/5 border border-steel/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-brass"
          />
          <input
            type="time"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="bg-ink/5 border border-steel/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <button
          onClick={() => onSaveHours(selectedDays.map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt })))}
          disabled={selectedDays.length === 0}
          className="bg-brass text-ink rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 hover:enabled:bg-brass-light transition-colors"
        >
          Guardar horario
        </button>
      </section>
    </div>
  );
}
