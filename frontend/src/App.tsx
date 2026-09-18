import React, { useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { BookingFlow } from "./components/BookingFlow";
import { BarbershopApp, RegisterBarbershopScreen } from "./barbershop/components/BarbershopApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/b/:slug" element={<BookingFlowRoute />} />
      <Route path="/negocio/registro" element={<RegisterRoute />} />
      <Route path="/negocio/:branchId" element={<BarbershopAppRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function RegisterRoute() {
  const navigate = useNavigate();
  return <RegisterBarbershopScreen onRegistered={(branchId) => navigate(`/negocio/${branchId}`)} />;
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
  const [branchId, setBranchId] = useState("");

  return (
    <div className="min-h-screen bg-ink text-bone font-body flex flex-col items-center justify-center px-4 gap-10">
      <img src="/agenta-logo.svg" alt="Agenta" className="h-14 md:h-16 w-auto" />
      <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-center">
        Reservá tu turno
      </h1>

      <form
        className="w-full max-w-sm flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (slug.trim()) navigate(`/b/${slug.trim()}`);
        }}
      >
        <label className="font-body text-xs uppercase tracking-wide text-steel">
          Nombre de la barbería
        </label>
        <input
          className="bg-bone/5 border border-steel/40 rounded text-bone font-body text-base py-3 px-4 outline-none focus:border-brass focus:shadow-brass transition-colors"
          placeholder="ej: barberia-el-corte"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button
          type="submit"
          className="bg-brass text-ink font-body font-semibold rounded-full px-6 py-3.5"
        >
          Buscar barbería
        </button>
      </form>

      <div className="w-full max-w-sm border-t border-steel/20 pt-8">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (branchId.trim()) navigate(`/negocio/${branchId.trim()}`);
          }}
        >
          <label className="font-body text-xs uppercase tracking-wide text-steel">
            Soy una barbería — ID de sucursal
          </label>
          <input
            className="bg-bone/5 border border-steel/40 rounded text-bone font-body text-base py-3 px-4 outline-none focus:border-brass focus:shadow-brass transition-colors"
            placeholder="ID de sucursal"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
          <button
            type="submit"
            className="border border-steel/40 text-bone rounded-full px-6 py-3.5"
          >
            Ingresar al panel
          </button>
        </form>
        <button
          onClick={() => navigate("/negocio/registro")}
          className="w-full text-center text-steel text-sm mt-3 underline"
        >
          ¿Todavía no tenés cuenta? Registrá tu barbería
        </button>
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
