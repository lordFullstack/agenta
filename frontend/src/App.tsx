import React, { useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { BookingFlow } from "./components/BookingFlow";
import { BarbershopApp, RegisterBarbershopScreen, LoginScreen, loginAndGetBranchId } from "./barbershop/components/BarbershopApp";
import { IconMapPin, IconArrowRight } from "./components/icons";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/b/:slug" element={<BookingFlowRoute />} />
      <Route path="/negocio/registro" element={<RegisterRoute />} />
      <Route path="/negocio/entrar" element={<LoginRoute />} />
      <Route path="/negocio/:branchId" element={<BarbershopAppRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function RegisterRoute() {
  const navigate = useNavigate();
  return <RegisterBarbershopScreen onRegistered={(branchId) => navigate(`/negocio/${branchId}`)} />;
}

function LoginRoute() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>();
  const handleLogin = async (identifier: string, password: string) => {
    setError(undefined);
    try {
      const branchId = await loginAndGetBranchId(identifier, password);
      navigate(`/negocio/${branchId}`);
    } catch {
      setError("Usuario o contraseña incorrectos.");
    }
  };
  return <LoginScreen onLogin={handleLogin} error={error} />;
}

function BookingFlowRoute() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <NotFound />;
  return <BookingFlow barbershopSlug={slug} />;
}

function BarbershopAppRoute() {
  const { branchId } = useParams<{ branchId: string }>();
  if (!branchId) return <NotFound />;
  return <BarbershopApp branchId={branchId} />;
}

function Landing() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");

  return (
    <div className="relative min-h-screen bg-ink text-bone font-body flex flex-col items-center justify-center px-4 py-16 gap-10 overflow-hidden">
      {/* ambiente: viñeta cálida + filo diagonal sutil, decorativo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(245,185,63,0.10), transparent 70%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(20,22,26,0.9), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute -top-1/3 -right-1/4 w-[70vmax] h-[70vmax] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, #F5B93F 0%, transparent 65%)" }}
      />

      <div className="relative flex flex-col items-center gap-10 w-full">
        <img src="/agenta-logo.svg" alt="Agenta" className="h-14 md:h-16 w-auto" />
        <div className="text-center">
          <p className="font-body text-xs uppercase tracking-[0.2em] text-brass-light mb-3">
            Reservá en segundos
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">
            Tu turno, en las mejores manos
          </h1>
        </div>

        <form
          className="w-full max-w-sm flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (slug.trim()) navigate(`/b/${encodeURIComponent(slug.trim())}`);
          }}
        >
          <label className="font-body text-xs uppercase tracking-wide text-steel">
            Nombre de la barbería
          </label>
          <div className="relative">
            <IconMapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-steel" />
            <input
              className="w-full bg-bone/5 border border-steel/40 rounded text-bone font-body text-base py-3 pl-11 pr-4 outline-none focus:border-brass focus:shadow-brass transition-colors placeholder:text-steel/70"
              placeholder="ej: Barbería El Corte"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="group flex items-center justify-center gap-2 bg-brass text-ink font-body font-semibold rounded-full px-6 py-3.5
              shadow-card hover:bg-brass-light hover:shadow-brass active:scale-[0.98] transition-all duration-150"
          >
            Buscar barbería
            <IconArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </form>

        <div className="w-full max-w-sm border-t border-steel/20 pt-8 flex flex-col gap-3">
          <button
            onClick={() => navigate("/negocio/entrar")}
            className="border border-steel/40 text-bone rounded-full px-6 py-3.5
              hover:border-brass/60 hover:text-brass-light active:scale-[0.98] transition-all duration-150"
          >
            Soy una barbería — Ingresar al panel
          </button>
          <button
            onClick={() => navigate("/negocio/registro")}
            className="w-full text-center text-steel text-sm mt-1 underline hover:text-bone transition-colors"
          >
            ¿Todavía no tenés cuenta? Registrá tu barbería
          </button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-ink text-bone font-body flex items-center justify-center px-4">
      <p className="text-center">Página no encontrada.</p>
    </div>
  );
}
