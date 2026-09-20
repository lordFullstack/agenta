// frontend/src/screens/AdminScreen.tsx
// /admin — pantalla aparte para el administrador de la plataforma (no es de ninguna barbería).
// Sirve para subir las fotos de fondo de Inicio y Búsqueda. Entra con el mismo usuario y
// contraseña de siempre; el backend decide quién es administrador con PLATFORM_ADMIN_PHONES.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarbershopApiClient, ApiError } from "../barbershop/api/barbershop-api-client";
import { Logo, GoldButton, GhostButton } from "../components/ui";
import { PlatformBackgrounds } from "../components/PlatformBackgrounds";
import { IconAlert } from "../components/icons";

const api = new BarbershopApiClient((import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000");

type Branding = { hero: string | null; searchBg: string | null };
type Stage = "login" | "ready" | "denied";

const PAGE_BG =
  "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,179,87,0.09), transparent 70%), linear-gradient(#09121B, #060D14)";

export function AdminScreen() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding>({ hero: null, searchBg: null });
  const [notice, setNotice] = useState<string | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(identifier.trim(), password);
      const { isPlatformAdmin } = await api.getPlatformAdminStatus();
      if (!isPlatformAdmin) {
        setStage("denied");
        return;
      }
      setBranding((await api.getPlatformBranding()).branding);
      setStage("ready");
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 400 || err.status === 401)
          ? "Usuario o contraseña incorrectos."
          : err instanceof Error
            ? err.message
            : "No pudimos iniciar sesión."
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api.logout();
    setStage("login");
    setPassword("");
    setNotice(null);
  };

  const upload = async (slot: "hero" | "search_bg", file: File) => {
    setNotice(null);
    const { branding: next } = await api.uploadPlatformImage(slot, file);
    setBranding(next);
    setNotice("Listo, el fondo se actualizó. Puede tardar hasta un minuto en verse para los clientes.");
  };

  const remove = async (slot: "hero" | "search_bg") => {
    setNotice(null);
    const { branding: next } = await api.removePlatformImage(slot);
    setBranding(next);
    setNotice("Listo, volvió la imagen por defecto.");
  };

  // ── Login ──
  if (stage === "login") {
    return (
      <div className="min-h-screen bg-night text-snow font-body flex flex-col items-center justify-center px-6" style={{ backgroundImage: PAGE_BG }}>
        <form onSubmit={login} className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-6">
              <Logo size="md" />
            </div>
            <h1 className="font-display text-2xl font-semibold mb-1">Administración</h1>
            <p className="text-fog text-sm text-center">Solo para el administrador de la plataforma</p>
          </div>

          <div className="bg-panel border border-edge rounded-card p-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fog text-xs">Teléfono o email</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                inputMode="text"
                placeholder="Tu teléfono, tal como lo registraste"
                className="bg-night border border-edge-strong focus:border-gold rounded-xl px-3 py-2.5 text-[15px] outline-none placeholder:text-fog/60 transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fog text-xs">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-night border border-edge-strong focus:border-gold rounded-xl px-3 py-2.5 text-[15px] outline-none placeholder:text-fog/60 transition-colors"
              />
            </label>
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-ember-light text-xs -mt-1">
                <IconAlert className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </p>
            )}
            <GoldButton type="submit" disabled={busy || !identifier.trim() || !password}>
              {busy ? "Entrando…" : "Ingresar"}
            </GoldButton>
          </div>
        </form>
      </div>
    );
  }

  // ── Sesión iniciada, pero esa cuenta no es la del administrador ──
  if (stage === "denied") {
    return (
      <div className="min-h-screen bg-night text-snow font-body flex flex-col items-center justify-center px-6 text-center" style={{ backgroundImage: PAGE_BG }}>
        <div className="w-full max-w-sm">
          <p className="font-display text-lg mb-1">Esta cuenta no es de administrador</p>
          <p className="text-fog text-sm mb-6">
            Para entrar acá, el número tiene que estar en la variable PLATFORM_ADMIN_PHONES del backend.
          </p>
          <GhostButton onClick={logout}>Probar con otra cuenta</GhostButton>
        </div>
      </div>
    );
  }

  // ── Panel del administrador ──
  return (
    <div className="min-h-screen bg-night text-snow font-body" style={{ backgroundImage: PAGE_BG }}>
      <header className="flex items-center justify-between gap-3 px-5 h-16 border-b border-edge">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="text-xs text-fog hover:text-snow underline underline-offset-2 transition-colors"
          >
            Ver la app
          </button>
          <button
            onClick={logout}
            className="text-xs font-medium border border-edge-strong hover:border-gold/60 rounded-full px-3 py-1.5 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 pb-16 pt-6">
        <h1 className="font-display text-2xl font-semibold">Administración de Agenta</h1>
        <p className="text-fog text-sm mt-1">Lo que cambies acá se ve en toda la plataforma.</p>

        {notice && (
          <p role="status" className="mt-4 text-sm text-moss-light bg-moss-light/10 border border-moss-light/30 rounded-xl px-3 py-2">
            {notice}
          </p>
        )}

        <PlatformBackgrounds branding={branding} onUpload={upload} onRemove={remove} />
      </main>
    </div>
  );
}
