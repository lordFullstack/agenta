// frontend/src/barbershop/components/BarbershopApp.tsx
import React, { useState } from "react";
import { useBarbershopApp, AppointmentRow } from "../hooks/useBarbershopApp";
import { BarbershopApiClient, ApiError } from "../api/barbershop-api-client";

const api = new BarbershopApiClient((import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000");

export function BarbershopApp({ branchId }: { branchId: string }) {
  const app = useBarbershopApp(api, branchId);

  return (
    <div className="min-h-screen bg-ink text-bone font-body">
      {app.screen === "login" && <LoginScreen onLogin={app.login} error={app.loginError} />}
      {app.session && app.screen !== "login" && (
        <div className="lg:flex">
          <SideNav screen={app.screen} onNavigate={app.setScreen} onLogout={app.logout} role={app.session.role} />
          <main className="flex-1 px-4 py-6 lg:px-8 max-w-4xl">
            {app.screen === "dashboard" && <DashboardScreen agenda={app.agenda} loading={app.agendaLoading} onGoAgenda={() => app.setScreen("agenda")} />}
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
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// ── Login ──

function LoginScreen({ onLogin, error }: { onLogin: (id: string, pw: string) => void; error?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <h1 className="font-display text-3xl font-semibold mb-1">Barbería</h1>
      <p className="text-steel text-sm mb-8">Panel de gestión</p>

      <div className="w-full max-w-sm">
        <label htmlFor="identifier" className="block text-xs text-steel mb-1">Teléfono o email</label>
        <input
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-bone py-2 outline-none mb-4"
        />
        <label htmlFor="password" className="block text-xs text-steel mb-1">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-bone py-2 outline-none mb-6"
        />
        {error && <p className="text-ember text-xs mb-4">{error}</p>}
        <button
          onClick={() => onLogin(identifier, password)}
          disabled={!identifier || !password}
          className="w-full bg-brass text-ink font-semibold rounded-full py-3.5 disabled:opacity-40 active:scale-95 transition-all"
        >
          Ingresar
        </button>
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

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const canSubmit =
    form.tradeName.trim() && form.legalName.trim() && form.ownerPhone.trim() && form.ownerPassword.length >= 8;

  const submit = async () => {
    if (!canSubmit || loading) return;
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
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <h1 className="font-display text-3xl font-semibold mb-1">Registrá tu barbería</h1>
      <p className="text-steel text-sm mb-8">Creá la cuenta del dueño/a y tu primera sucursal</p>

      <div className="w-full max-w-sm space-y-4">
        <Field label="Nombre comercial" value={form.tradeName} onChange={set("tradeName")} placeholder="Barbería El Corte" />
        <Field label="Razón social" value={form.legalName} onChange={set("legalName")} placeholder="El Corte SRL" />
        <Field label="Tu nombre" value={form.ownerFullName} onChange={set("ownerFullName")} placeholder="Opcional" />
        <Field label="Tu teléfono" value={form.ownerPhone} onChange={set("ownerPhone")} placeholder="+54911..." />
        <Field label="Contraseña (mín. 8 caracteres)" type="password" value={form.ownerPassword} onChange={set("ownerPassword")} />

        {error && <p className="text-ember text-xs">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit || loading}
          className="w-full bg-brass text-ink font-semibold rounded-full py-3.5 disabled:opacity-40 active:scale-95 transition-all"
        >
          {loading ? "Creando cuenta…" : "Crear mi barbería"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-steel mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass text-bone py-2 outline-none"
      />
    </div>
  );
}

// ── Navegación lateral (rail — esta app es de uso mayormente en mostrador/tablet) ──

function SideNav({ screen, onNavigate, onLogout, role }: { screen: string; onNavigate: (s: any) => void; onLogout: () => void; role: string }) {
  const items = [
    { id: "dashboard", label: "Inicio" },
    { id: "agenda", label: "Agenda" },
    { id: "services", label: "Servicios" },
    { id: "staff", label: "Barberos" },
    { id: "settings", label: "Configuración" },
  ];
  return (
    <nav className="lg:w-56 lg:min-h-screen bg-bone/5 border-b lg:border-b-0 lg:border-r border-steel/15 px-4 py-4 lg:py-8">
      <p className="text-xs text-steel uppercase tracking-wide mb-4 hidden lg:block">{role}</p>
      <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={screen === item.id ? "page" : undefined}
            className="px-3 py-2 rounded-card text-sm text-left whitespace-nowrap text-steel aria-[current=page]:bg-brass aria-[current=page]:text-ink aria-[current=page]:font-medium"
          >
            {item.label}
          </button>
        ))}
        <button onClick={onLogout} className="px-3 py-2 rounded-card text-sm text-left text-ember whitespace-nowrap">
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}

// ── Dashboard ──

function DashboardScreen({ agenda, loading, onGoAgenda }: { agenda: AppointmentRow[]; loading: boolean; onGoAgenda: () => void }) {
  const pending = agenda.filter((a) => a.status === "confirmed" || a.status === "pending").length;
  const inProgress = agenda.find((a) => a.status === "in_progress");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-6">Hoy</h1>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-bone text-ink rounded-card shadow-card p-4">
          <p className="text-xs text-steel mb-1">Citas de hoy</p>
          <p className="font-display text-2xl font-semibold">{loading ? "…" : agenda.length}</p>
        </div>
        <div className="bg-bone text-ink rounded-card shadow-card p-4">
          <p className="text-xs text-steel mb-1">Pendientes</p>
          <p className="font-display text-2xl font-semibold">{loading ? "…" : pending}</p>
        </div>
      </div>
      {inProgress && (
        <div className="bg-brass text-ink rounded-card p-4 mb-6">
          <p className="text-xs font-medium mb-1">En curso ahora</p>
          <p className="font-display font-semibold">{inProgress.customer_name} con {inProgress.staff_name}</p>
        </div>
      )}
      <button onClick={onGoAgenda} className="w-full bg-bone/5 border border-steel/20 rounded-card py-3.5 text-sm font-medium">
        Ver agenda completa
      </button>
    </div>
  );
}

// ── Agenda ──

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Agenda</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            onLoadDate(e.target.value);
          }}
          className="bg-bone/5 border border-steel/25 rounded-card px-3 py-2 text-sm outline-none focus:border-brass"
        />
      </div>

      {actionError && <p className="text-ember text-sm mb-4">{actionError}</p>}

      {loading && <p className="text-steel text-sm">Cargando…</p>}
      {error && <p className="text-ember text-sm">{error}</p>}

      {!loading && !error && agenda.length === 0 && (
        <p className="text-steel text-sm mb-6">Sin citas para este día.</p>
      )}

      <div className="space-y-2 mb-6">
        {agenda.map((a) => (
          <div key={a.id} className="bg-bone text-ink rounded-card shadow-card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{a.customer_name}</p>
              <p className="text-steel text-xs font-mono">
                {new Date(a.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {a.staff_name}
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-pill text-[10px] font-medium bg-brass/15 text-brass">{a.status}</span>
            </div>
            <div className="flex gap-2">
              {nextStatus[a.status] && (
                <button
                  onClick={() => onUpdateStatus(a.id, nextStatus[a.status], date)}
                  className="text-xs bg-brass text-ink px-3 py-2 rounded-full font-medium whitespace-nowrap"
                >
                  {statusLabel[a.status]}
                </button>
              )}
              {(a.status === "pending" || a.status === "confirmed") && (
                <button
                  onClick={() => onUpdateStatus(a.id, "no_show", date)}
                  className="text-xs border border-ember/40 text-ember px-3 py-2 rounded-full whitespace-nowrap"
                >
                  No-show
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowWalkIn(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-pill bg-brass text-ink shadow-float flex items-center justify-center text-2xl font-semibold"
        aria-label="Cargar walk-in"
      >
        +
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
      <div className="relative w-full bg-bone text-ink rounded-t-sheet p-5 pb-8">
        <h2 className="font-display text-xl font-semibold mb-4">Cargar walk-in</h2>
        <input placeholder="ID del barbero" value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 mb-3 outline-none focus:border-brass bg-transparent" />
        <input placeholder="Teléfono del cliente" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 mb-3 outline-none focus:border-brass bg-transparent" />
        <input placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 mb-3 outline-none focus:border-brass bg-transparent" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 mb-6 outline-none focus:border-brass bg-transparent" />
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
          className="w-full bg-brass text-ink font-semibold rounded-full py-3.5"
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
        <button onClick={() => setShowForm((v) => !v)} className="bg-brass text-ink rounded-full px-4 py-2 text-sm font-medium">
          + Nuevo
        </button>
      </div>

      {error && <p className="text-ember text-sm mb-4">{error}</p>}

      {showForm && (
        <div className="bg-bone text-ink rounded-card p-4 mb-5 space-y-3">
          <input placeholder="Nombre del servicio" value={name} onChange={(e) => setName(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
          <input placeholder="Precio" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
          <input placeholder="Duración (minutos)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
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
            className="w-full bg-brass text-ink font-semibold rounded-full py-2.5 disabled:opacity-40"
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
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="bg-bone text-ink rounded-card shadow-card p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-steel text-xs font-mono">{s.baseDurationMinutes} min · ${s.basePrice}</p>
              </div>
              <button onClick={() => onDeactivate(s.id)} className="text-xs text-ember">Desactivar</button>
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
  getStaffServices,
}: {
  staff: any[];
  services: any[];
  loading: boolean;
  error?: string;
  onInvite: (input: any) => Promise<boolean>;
  onToggleStatus: (staffId: string, currentStatus: string) => void;
  onAssignService: (staffId: string, serviceId: string) => void;
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
        <button onClick={() => setShowForm((v) => !v)} className="bg-brass text-ink rounded-full px-4 py-2 text-sm font-medium">
          + Invitar
        </button>
      </div>

      {error && <p className="text-ember text-sm mb-4">{error}</p>}

      {showForm && (
        <div className="bg-bone text-ink rounded-card p-4 mb-5 space-y-3">
          <p className="text-xs text-steel">
            Definís una contraseña temporal para que el barbero entre por primera vez — se la comunicás vos directamente.
          </p>
          <input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
          <input placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
          <input placeholder="Contraseña temporal" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
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
            className="w-full bg-brass text-ink font-semibold rounded-full py-2.5 disabled:opacity-40"
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
        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.id} className="bg-bone text-ink rounded-card shadow-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-steel text-xs">{s.phone}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-pill text-[10px] font-medium ${s.status === "active" ? "bg-brass/15 text-brass" : "bg-steel/15 text-steel"}`}>
                    {s.status === "active" ? "Activo" : "Pausado"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => expand(s.id)} className="text-xs border border-steel/30 px-3 py-2 rounded-full">Servicios</button>
                  <button onClick={() => onToggleStatus(s.id, s.status)} className="text-xs border border-steel/30 px-3 py-2 rounded-full">
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
}: {
  tenant: any;
  businessHours: any[];
  loading: boolean;
  error?: string;
  saved: boolean;
  onSaveProfile: (updates: any) => void;
  onSaveHours: (hours: any[]) => void;
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

      {loading && <p className="text-steel text-sm">Cargando…</p>}
      {error && <p className="text-ember text-sm mb-4">{error}</p>}
      {saved && <p className="text-brass text-sm mb-4">Cambios guardados.</p>}

      <section className="bg-bone text-ink rounded-card p-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">Perfil</h2>
        <label className="block text-xs text-steel mb-1">Nombre comercial</label>
        <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className="w-full border-b-2 border-steel/30 py-2 mb-4 outline-none focus:border-brass bg-transparent" />
        <button onClick={() => onSaveProfile({ tradeName })} className="bg-brass text-ink rounded-full px-4 py-2 text-sm font-medium">
          Guardar perfil
        </button>
      </section>

      <section className="bg-bone text-ink rounded-card p-4">
        <h2 className="font-display text-lg font-semibold mb-3">Horario general</h2>

        <div className="mb-3">
          {businessHours.length === 0 ? (
            <p className="text-steel text-sm">Sin horario cargado todavía.</p>
          ) : (
            businessHours.map((h: any, i: number) => (
              <p key={i} className="text-sm text-steel">{h.day_of_week}: {h.opens_at} – {h.closes_at}</p>
            ))
          )}
        </div>

        <p className="text-xs text-steel mb-2">Aplicar el mismo horario a:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() =>
                setSelectedDays((prev) => (prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key]))
              }
              aria-pressed={selectedDays.includes(d.key)}
              className="px-2.5 py-1 rounded-pill text-xs border border-steel/30 aria-pressed:bg-brass aria-pressed:text-ink aria-pressed:border-brass"
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mb-4">
          <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
          <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="border-b-2 border-steel/30 py-2 outline-none focus:border-brass bg-transparent" />
        </div>
        <button
          onClick={() => onSaveHours(selectedDays.map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt })))}
          disabled={selectedDays.length === 0}
          className="bg-brass text-ink rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Guardar horario
        </button>
      </section>
    </div>
  );
}
