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
  IconCamera,
} from "../../components/icons";
import { Logo, Avatar, photoBackground } from "../../components/ui";
import { ImagePicker } from "../../components/ImagePicker";
import { DEFAULT_BRANDING } from "../../lib/platformBranding";
import { formatCOP, formatTime } from "../../lib/format";

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
    <div className="min-h-screen bg-night text-snow font-body">
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
                isPlatformAdmin={app.isPlatformAdmin}
                platformBranding={app.platformBranding}
                onUploadPlatformImage={app.uploadPlatformImage}
                onRemovePlatformImage={app.removePlatformImage}
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
      <label className="block text-xs font-medium text-fog mb-1.5">{label}</label>
      <div
        className={`flex items-center gap-2.5 bg-panel border rounded-xl px-3.5 py-2.5 transition-colors
          ${error ? "border-ember/70" : "border-edge-strong focus-within:border-gold"}`}
      >
        {Icon && <Icon className="w-4 h-4 text-fog flex-shrink-0" />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-snow text-sm outline-none placeholder:text-fog/70"
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-ember-light text-xs mt-1.5">
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
    <div className="min-h-screen bg-night text-snow font-body flex flex-col items-center justify-center px-6" style={{ backgroundImage: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,179,87,0.09), transparent 70%), linear-gradient(#09121B, #060D14)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6"><Logo size="md" /></div>
          <h1 className="font-display text-2xl font-semibold mb-1">Panel de gestión</h1>
          <p className="text-fog text-sm">Ingresa con la cuenta de tu barbería</p>
        </div>

        <div className="bg-panel border border-edge rounded-card p-5 flex flex-col gap-4">
          <Field label="Teléfono o email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+57 300 123 4567" icon={IconPhone} />
          <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" icon={IconLock} />
          {error && (
            <p className="flex items-center gap-1.5 text-ember-light text-xs -mt-1">
              <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}
          <button
            onClick={() => onLogin(identifier, password)}
            disabled={!identifier || !password}
            className="w-full bg-gold text-night font-semibold shadow-gold-glow rounded-full py-3.5 disabled:opacity-40
              hover:enabled:bg-gold-light active:scale-95 transition-all"
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
    tradeName: form.tradeName.trim() ? undefined : "Ingresa el nombre comercial de tu barbería.",
    legalName: form.legalName.trim() ? undefined : "Ingresa la razón social.",
    ownerPhone: form.ownerPhone.trim() ? undefined : "Ingresa un teléfono de contacto.",
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
        setError("Ese teléfono ya tiene una cuenta. Inicia sesión en vez de registrarte.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No pudimos registrar la barbería. Prueba de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-night text-snow font-body flex flex-col items-center justify-center px-6 py-12" style={{ backgroundImage: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,179,87,0.09), transparent 70%), linear-gradient(#09121B, #060D14)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="mb-6"><Logo size="md" /></div>
          <h1 className="font-display text-2xl font-semibold mb-1 text-center">Registra tu barbería</h1>
          <p className="text-fog text-sm text-center">Crea la cuenta del dueño/a y tu primera sucursal</p>
        </div>

        <div className="bg-panel border border-edge rounded-card p-5 flex flex-col gap-4">
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
            placeholder="+57 300 123 4567"
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
            <p className="flex items-center gap-1.5 text-ember-light text-xs">
              <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-gold text-night font-semibold shadow-gold-glow rounded-full py-3.5 disabled:opacity-60
              hover:enabled:bg-gold-light active:scale-95 transition-all"
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
    <nav className="lg:w-60 lg:min-h-screen lg:flex-shrink-0 bg-panel border-b lg:border-b-0 lg:border-r border-edge px-4 py-4 lg:py-6 lg:flex lg:flex-col">
      <div className="hidden lg:flex items-center gap-2.5 px-2 pb-6 mb-2 border-b border-edge">
        <div className="w-9 h-9 rounded-xl bg-panel-raised overflow-hidden flex items-center justify-center flex-shrink-0">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <IconScissors className="w-4 h-4 text-gold-light" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{tenant?.trade_name || "Tu barbería"}</p>
          <p className="text-[11px] text-fog">{ROLE_LABEL[role] ?? role}</p>
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
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left whitespace-nowrap transition-colors flex-shrink-0
                ${active ? "bg-gold/15 text-gold font-medium" : "text-fog hover:bg-panel-raised hover:text-snow"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left text-ember-light/80 hover:bg-ember/10 hover:text-ember-light whitespace-nowrap transition-colors flex-shrink-0 lg:mt-auto"
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
  pending: { label: "Pendiente", cls: "bg-gold/15 text-gold-light" },
  confirmed: { label: "Confirmado", cls: "bg-edge-strong/60 text-snow" },
  in_progress: { label: "En curso", cls: "bg-gold text-night" },
  completed: { label: "Completado", cls: "bg-moss/15 text-moss-light" },
  no_show: { label: "No-show", cls: "bg-ember/15 text-ember-light" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_PILL[status] ?? { label: status, cls: "bg-panel-raised text-fog" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium ${meta.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-pill ${status === "in_progress" ? "bg-night animate-pulse" : "bg-current opacity-70"}`} />
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
        <div className="flex items-center gap-3 bg-gold/10 border border-gold/30 rounded-card px-4 py-3 mb-5">
          <span className="w-2 h-2 rounded-pill bg-gold-light flex-shrink-0 animate-pulse" />
          <p className="text-sm">
            <span className="font-medium">En curso ahora</span> — {inProgress.customer_name} con {inProgress.staff_name}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-panel border border-edge text-snow rounded-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-fog">Citas de hoy</p>
            <div className="w-7 h-7 rounded-xl bg-gold/15 flex items-center justify-center">
              <IconCalendar className="w-3.5 h-3.5 text-gold-dark" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold">{loading ? "…" : agenda.length}</p>
        </div>
        <div className="bg-panel border border-edge text-snow rounded-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-fog">Pendientes</p>
            <div className="w-7 h-7 rounded-xl bg-ember/10 flex items-center justify-center">
              <IconAlert className="w-3.5 h-3.5 text-ember-light" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold">{loading ? "…" : pending}</p>
        </div>
        <div className="bg-panel border border-edge text-snow rounded-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-fog">Facturado hoy</p>
            <div className="w-7 h-7 rounded-xl bg-moss/15 flex items-center justify-center">
              <IconScissors className="w-3.5 h-3.5 text-moss-light" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold font-mono tabular-nums">
            {loading ? "…" : formatCOP(billedToday)}
          </p>
        </div>
      </div>

      <div className="bg-panel border border-edge rounded-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold">Próximos turnos</h2>
          <button onClick={onGoAgenda} className="flex items-center gap-1 text-xs text-gold-light hover:text-gold-dark transition-colors">
            Ver agenda completa
            <IconChevronRight className="w-3 h-3" />
          </button>
        </div>
        {loading ? (
          <p className="text-fog text-sm py-4">Cargando…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-fog text-sm py-4">No hay turnos pendientes para hoy.</p>
        ) : (
          <div className="divide-y divide-edge">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-xs text-fog w-[4.25rem] flex-shrink-0 whitespace-nowrap">
                  {formatTime(a.starts_at)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.customer_name}</p>
                  <p className="text-xs text-fog truncate">con {a.staff_name}</p>
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

  const rawDate = new Date(date + "T00:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const formattedDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="font-display text-2xl font-semibold mr-auto">{formattedDate}</h1>
        <div className="flex items-center gap-1 bg-panel border border-edge rounded-xl">
          <button
            onClick={() => goTo(shiftDate(date, -1))}
            aria-label="Día anterior"
            className="w-8 h-8 flex items-center justify-center text-fog hover:text-snow transition-colors"
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
            className="w-8 h-8 flex items-center justify-center text-fog hover:text-snow transition-colors"
          >
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionError && (
        <p className="flex items-center gap-1.5 text-ember-light text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </p>
      )}

      {loading && <p className="text-fog text-sm">Cargando…</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-ember-light text-sm">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {!loading && !error && agenda.length === 0 && <p className="text-fog text-sm mb-6">Sin citas para este día.</p>}

      {!loading && !error && agenda.length > 0 && (
        <div className="bg-panel border border-edge rounded-card overflow-hidden mb-6">
          <table className="agenda-table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-edge">
                <th className="text-left text-[11px] uppercase tracking-wide text-fog font-medium px-4 py-3">Hora</th>
                <th className="text-left text-[11px] uppercase tracking-wide text-fog font-medium px-4 py-3">Cliente</th>
                <th className="text-left text-[11px] uppercase tracking-wide text-fog font-medium px-4 py-3">Barbero</th>
                <th className="text-left text-[11px] uppercase tracking-wide text-fog font-medium px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {agenda.map((a) => (
                <tr key={a.id} className="border-b border-edge last:border-none hover:bg-panel transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-fog align-middle" data-label="Hora">
                    {formatTime(a.starts_at)}
                  </td>
                  <td className="px-4 py-3 align-middle" data-label="Cliente">
                    <p className="font-medium">{a.customer_name}</p>
                    <p className="text-xs text-fog">{a.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 align-middle text-fog" data-label="Barbero">
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
                          className="text-xs bg-gold/15 text-gold-light hover:bg-gold/25 px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors"
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
        className="fixed bottom-6 right-6 w-14 h-14 rounded-pill bg-gold text-night shadow-float hover:bg-gold-light
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
      <div className="absolute inset-0 bg-night/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:mx-auto bg-panel-raised border-t sm:border border-edge-strong text-snow rounded-t-sheet sm:rounded-b-sheet p-5 pb-8">
        <div className="w-9 h-1 bg-panel-raised rounded-pill mx-auto mb-4 sm:hidden" />
        <h2 className="font-display text-xl font-semibold mb-4">Cargar walk-in</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-fog mb-1.5">ID del barbero</label>
            <input
              placeholder="ID del barbero"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fog mb-1.5">Teléfono del cliente</label>
            <input
              placeholder="+57 300 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fog mb-1.5">Nombre (opcional)</label>
            <input
              placeholder="Nombre del cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fog mb-1.5">Hora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
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
          className="w-full bg-gold text-night font-semibold shadow-gold-glow rounded-full py-3.5 hover:bg-gold-light active:scale-95 transition-all mt-5"
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
          className="flex items-center gap-1.5 bg-gold text-night rounded-full pl-3.5 pr-4 py-2 text-sm font-medium hover:bg-gold-light transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-ember-light text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {showForm && (
        <div className="bg-panel border border-edge text-snow rounded-card p-4 mb-5 flex flex-col gap-3">
          <input
            placeholder="Nombre del servicio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            placeholder="Precio"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            placeholder="Duración (minutos)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
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
            className="w-full bg-gold text-night font-semibold shadow-gold-glow rounded-full py-2.5 disabled:opacity-40 hover:enabled:bg-gold-light transition-colors"
          >
            Guardar servicio
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-fog text-sm">Cargando…</p>
      ) : services.length === 0 ? (
        <p className="text-fog text-sm">Todavía no has cargado ningún servicio.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3.5 bg-panel border border-edge rounded-card px-4 py-3.5 hover:border-edge-strong transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
                <IconScissors className="w-4 h-4 text-gold-light" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-fog text-xs">{s.baseDurationMinutes} min</p>
              </div>
              <p className="font-mono tabular-nums text-sm font-medium mr-2">{formatCOP(s.basePrice)}</p>
              <button onClick={() => onDeactivate(s.id)} className="text-xs text-ember-light/80 hover:text-ember-light transition-colors whitespace-nowrap">
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
  onUploadPhoto: (staffId: string, file: File) => void | Promise<void>;
  getStaffServices: (staffId: string) => Promise<{ services: any[] }>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
        <div>
          <h1 className="font-display text-2xl font-semibold">Barberos</h1>
          <p className="text-fog text-xs mt-1">Toca la foto de un barbero para cambiarla; se muestra en tu perfil.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-gold text-night rounded-full pl-3.5 pr-4 py-2 text-sm font-medium hover:bg-gold-light transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          Invitar
        </button>
      </div>

      {(error || photoError) && (
        <p className="flex items-center gap-1.5 text-ember-light text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {photoError ?? error}
        </p>
      )}

      {showForm && (
        <div className="bg-panel border border-edge text-snow rounded-card p-4 mb-5 flex flex-col gap-3">
          <p className="text-xs text-fog">
            Define una contraseña temporal para que el barbero entre por primera vez — se la comunicas tú directamente.
          </p>
          <input
            placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            placeholder="Contraseña temporal"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold"
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
            className="w-full bg-gold text-night font-semibold shadow-gold-glow rounded-full py-2.5 disabled:opacity-40 hover:enabled:bg-gold-light transition-colors"
          >
            Invitar barbero
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-fog text-sm">Cargando…</p>
      ) : staff.length === 0 ? (
        <p className="text-fog text-sm">Todavía no has invitado a ningún barbero.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {staff.map((s) => (
            <div key={s.id} className="bg-panel border border-edge rounded-card px-4 py-3.5 hover:border-edge-strong transition-colors">
              <div className="flex items-center gap-3.5">
                <ImagePicker
                  ariaLabel={`Cambiar foto de ${s.full_name}`}
                  onPick={(file) => onUploadPhoto(s.id, file)}
                  onInvalid={setPhotoError}
                  className="relative flex-shrink-0"
                >
                  {(busy: boolean) => (
                    <>
                      <Avatar src={s.avatar_url} name={s.full_name} size={48} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-pill bg-gold text-night flex items-center justify-center border-2 border-night">
                        <IconCamera className="w-2.5 h-2.5" />
                      </span>
                      {busy && (
                        <span className="absolute inset-0 rounded-pill bg-night/70 flex items-center justify-center">
                          <span className="w-4 h-4 rounded-pill border-2 border-gold border-t-transparent animate-spin" />
                        </span>
                      )}
                    </>
                  )}
                </ImagePicker>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{s.full_name}</p>
                  <p className="text-fog text-xs">{s.phone}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-pill text-[10px] font-medium whitespace-nowrap ${
                    s.status === "active" ? "bg-moss/15 text-moss-light" : "bg-panel-raised text-fog"
                  }`}
                >
                  {s.status === "active" ? "Activo" : "Pausado"}
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => expand(s.id)}
                    className="text-xs border border-edge-strong hover:border-edge-strong px-3 py-1.5 rounded-full transition-colors"
                  >
                    Servicios
                  </button>
                  <button
                    onClick={() => onToggleStatus(s.id, s.status)}
                    className="text-xs border border-edge-strong hover:border-edge-strong px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s.status === "active" ? "Pausar" : "Reactivar"}
                  </button>
                </div>
              </div>
              {expandedStaffId === s.id && (
                <div className="mt-3 pt-3 border-t border-edge space-y-2">
                  {services.map((sv) => (
                    <label key={sv.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        defaultChecked={assignedServiceIds.includes(sv.id)}
                        onChange={() => onAssignService(s.id, sv.id)}
                        className="accent-gold"
                      />
                      {sv.name}
                    </label>
                  ))}
                  {services.length === 0 && <p className="text-fog text-xs">Carga servicios primero.</p>}
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
  isPlatformAdmin,
  platformBranding,
  onUploadPlatformImage,
  onRemovePlatformImage,
}: {
  tenant: any;
  businessHours: any[];
  loading: boolean;
  error?: string;
  saved: boolean;
  onSaveProfile: (updates: any) => void;
  onSaveHours: (hours: any[]) => void;
  onUploadLogo: (file: File) => void | Promise<void>;
  onUploadCover: (file: File) => void | Promise<void>;
  isPlatformAdmin: boolean;
  platformBranding: { hero: string | null; searchBg: string | null };
  onUploadPlatformImage: (slot: "hero" | "search_bg", file: File) => void | Promise<void>;
  onRemovePlatformImage: (slot: "hero" | "search_bg") => void | Promise<void>;
}) {
  const [tradeName, setTradeName] = useState(tenant?.trade_name ?? "");
  const [opensAt, setOpensAt] = useState("09:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat"]);
  const [imageError, setImageError] = useState<string | null>(null);

  React.useEffect(() => {
    if (tenant?.trade_name) setTradeName(tenant.trade_name);
  }, [tenant]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-6">Configuración</h1>

      {loading && <p className="text-fog text-sm mb-4">Cargando…</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-ember-light text-sm mb-4">
          <IconAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-1.5 text-moss-light text-sm mb-4 bg-moss/10 border border-moss/25 rounded-xl px-3 py-2 w-fit">
          Cambios guardados.
        </p>
      )}

      <section className="bg-panel border border-edge rounded-card p-5 mb-5">
        <h2 className="font-display text-lg font-semibold">Imagen de tu barbería</h2>
        <p className="text-fog text-xs mt-1 mb-4">
          Así ven tu perfil los clientes al reservar. Las fotos de tus barberos se cambian en la sección Barberos.
        </p>

        {/* Vista previa: misma composición que el perfil que ve el cliente (portada + logo circular + nombre) */}
        <div className="rounded-xl overflow-hidden border border-edge bg-night max-w-md">
          <div
            className="relative h-36"
            style={photoBackground(
              tenant?.cover_url ?? "/img/cover-default.jpg",
              "linear-gradient(to bottom, rgba(9,18,27,0.35) 0%, rgba(9,18,27,0.05) 45%, rgba(9,18,27,0.95) 100%)",
              "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(232,179,87,0.22), transparent 70%), linear-gradient(#0F1D29, #09121B)"
            )}
          >
            <ImagePicker
              onPick={onUploadCover}
              onInvalid={setImageError}
              className="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-xs font-medium text-snow bg-night/70 backdrop-blur-md border border-edge-strong hover:border-gold/60 rounded-full px-3 py-1.5 transition-colors"
            >
              {(busy: boolean) => (
                <>
                  <IconCamera className="w-3.5 h-3.5" />
                  {busy ? "Subiendo…" : tenant?.cover_url ? "Cambiar portada" : "Subir portada"}
                </>
              )}
            </ImagePicker>
          </div>

          <div className="-mt-10 flex justify-center relative">
            <div className="relative">
              <div className="w-20 h-20 rounded-pill bg-night border-4 border-night ring-1 ring-gold/50 overflow-hidden flex items-center justify-center">
                {tenant?.logo_url ? (
                  <img src={tenant.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <IconScissors className="w-7 h-7 text-gold" />
                )}
              </div>
              <ImagePicker
                ariaLabel={tenant?.logo_url ? "Cambiar logo" : "Subir logo"}
                onPick={onUploadLogo}
                onInvalid={setImageError}
                className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-pill bg-gold text-night flex items-center justify-center shadow-gold-glow hover:bg-gold-light transition-colors"
              >
                <IconCamera className="w-4 h-4" />
              </ImagePicker>
            </div>
          </div>
          <p className="text-center font-display font-semibold mt-2.5 pb-4 px-4 truncate">{tenant?.trade_name || "Tu barbería"}</p>
        </div>

        {imageError && (
          <p role="alert" className="flex items-center gap-1.5 text-ember-light text-xs mt-3">
            <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
            {imageError}
          </p>
        )}

        <ul className="mt-4 space-y-1 text-xs text-fog">
          <li>
            <span className="text-snow">Portada:</span> horizontal, mínimo 1200 × 700 px.
          </li>
          <li>
            <span className="text-snow">Logo:</span> cuadrado, se recorta en círculo.
          </li>
          <li>JPG, PNG o WebP · máximo 5 MB.</li>
        </ul>
      </section>

      <section className="bg-panel border border-edge rounded-card p-5 mb-5">
        <h2 className="font-display text-lg font-semibold mb-4">Perfil</h2>
        <label className="block text-xs font-medium text-fog mb-1.5">Nombre comercial</label>
        <input
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          className="w-full bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-gold mb-4"
        />
        <button
          onClick={() => onSaveProfile({ tradeName })}
          className="bg-gold text-night rounded-full px-4 py-2 text-sm font-medium hover:bg-gold-light transition-colors"
        >
          Guardar perfil
        </button>
      </section>

      <section className="bg-panel border border-edge rounded-card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">Horario general</h2>

        <div className="mb-4">
          {businessHours.length === 0 ? (
            <p className="text-fog text-sm">Sin horario cargado todavía.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {businessHours.map((h: any, i: number) => (
                <p key={i} className="text-sm text-fog font-mono">
                  {DAYS.find((d) => d.key === h.day_of_week)?.label ?? h.day_of_week}: {h.opens_at} – {h.closes_at}
                </p>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-fog mb-2">Aplicar el mismo horario a:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDays((prev) => (prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key]))}
              aria-pressed={selectedDays.includes(d.key)}
              className={`px-2.5 py-1 rounded-pill text-xs border transition-colors ${
                selectedDays.includes(d.key) ? "bg-gold text-night border-gold" : "border-edge-strong text-fog hover:border-edge-strong"
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
            className="bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            type="time"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="bg-night border border-edge-strong text-snow placeholder:text-fog/70 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <button
          onClick={() => onSaveHours(selectedDays.map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt })))}
          disabled={selectedDays.length === 0}
          className="bg-gold text-night rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 hover:enabled:bg-gold-light transition-colors"
        >
          Guardar horario
        </button>
      </section>

      {isPlatformAdmin && (
        <PlatformBackgrounds
          branding={platformBranding}
          onUpload={onUploadPlatformImage}
          onRemove={onRemovePlatformImage}
        />
      )}
    </div>
  );
}

// ── Fondos de la plataforma (inicio y búsqueda del cliente) — solo el administrador ──

function PlatformBackgrounds({
  branding,
  onUpload,
  onRemove,
}: {
  branding: { hero: string | null; searchBg: string | null };
  onUpload: (slot: "hero" | "search_bg", file: File) => void | Promise<void>;
  onRemove: (slot: "hero" | "search_bg") => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  const slots = [
    {
      slot: "hero" as const,
      title: "Pantalla de inicio",
      hint: "Foto vertical (1080 × 1920 px). Deja al barbero en la mitad de arriba: abajo va el texto.",
      url: branding.hero,
      fallbackUrl: DEFAULT_BRANDING.hero,
      overlay: "linear-gradient(to bottom, rgba(9,18,27,0.2) 0%, rgba(9,18,27,0.1) 30%, rgba(9,18,27,0.9) 66%, #09121B 100%)",
    },
    {
      slot: "search_bg" as const,
      title: "Pantalla de búsqueda",
      hint: "Foto vertical (1080 × 1400 px), por ejemplo la silla de barbero. Se funde hacia el fondo.",
      url: branding.searchBg,
      fallbackUrl: DEFAULT_BRANDING.searchBg,
      overlay: "linear-gradient(to bottom, #09121B 0%, rgba(9,18,27,0.55) 40%, rgba(9,18,27,0.25) 100%)",
    },
  ];

  return (
    <section className="bg-panel border border-edge rounded-card p-5 mt-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h2 className="font-display text-lg font-semibold">Fondos de Agenta</h2>
        <span className="text-[10px] font-medium text-gold bg-gold/10 border border-gold/30 rounded-pill px-2 py-0.5">
          Solo administrador de la plataforma
        </span>
      </div>
      <p className="text-fog text-xs mb-4">
        Son las fotos de fondo que ven todos los clientes en la pantalla de inicio y en la búsqueda; no son de una barbería en particular.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {slots.map((s) => (
          <div key={s.slot}>
            <p className="text-sm font-medium mb-2">{s.title}</p>
            <div
              className="relative aspect-[9/13] rounded-xl overflow-hidden border border-edge"
              style={photoBackground(
                s.url ?? s.fallbackUrl,
                s.overlay,
                "radial-gradient(ellipse 60% 38% at 72% 16%, rgba(232,179,87,0.30), transparent 70%), linear-gradient(#10202D, #09121B)"
              )}
            >
              <span className="absolute bottom-3 inset-x-0 text-center text-[10px] tracking-[0.4em] text-snow/80">AGENTA</span>
              {!s.url && (
                <span className="absolute top-2 left-2 text-[10px] text-fog bg-night/70 rounded-pill px-2 py-0.5">Imagen por defecto</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <ImagePicker
                onPick={(file) => onUpload(s.slot, file)}
                onInvalid={setError}
                className="flex items-center gap-1.5 text-xs font-medium text-night bg-gold hover:bg-gold-light rounded-full px-3 py-1.5 transition-colors"
              >
                {(busy: boolean) => (
                  <>
                    <IconCamera className="w-3.5 h-3.5" />
                    {busy ? "Subiendo…" : s.url ? "Cambiar foto" : "Subir foto"}
                  </>
                )}
              </ImagePicker>
              {s.url && (
                <button
                  onClick={() => onRemove(s.slot)}
                  className="text-xs text-fog hover:text-snow underline underline-offset-2 transition-colors"
                >
                  Restaurar por defecto
                </button>
              )}
            </div>
            <p className="text-[11px] text-fog mt-2">{s.hint}</p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-ember-light text-xs mt-3">
          <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      <p className="text-[11px] text-fog mt-4">JPG, PNG o WebP · máximo 5 MB. Puede tardar hasta un minuto en verse para los clientes.</p>
    </section>
  );
}
