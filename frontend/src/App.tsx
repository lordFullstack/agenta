import React, { useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { BookingFlow } from "./components/BookingFlow";
import { BarbershopApp, RegisterBarbershopScreen, LoginScreen, loginAndGetBranchId } from "./barbershop/components/BarbershopApp";
import { LandingScreen, SearchScreen, MyAppointmentsScreen, ProfileScreen } from "./screens/ClientScreens";
import { Screen, GoldButton } from "./components/ui";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingScreen />} />
      <Route path="/buscar" element={<SearchScreen />} />
      <Route path="/mis-citas" element={<MyAppointmentsScreen />} />
      <Route path="/perfil" element={<ProfileScreen />} />
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

function NotFound() {
  const navigate = useNavigate();
  return (
    <Screen className="flex flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-lg mb-1">Página no encontrada</p>
      <p className="text-fog text-sm mb-6">Es posible que el enlace esté incompleto.</p>
      <GoldButton onClick={() => navigate("/")} className="!w-auto px-8">
        Ir al inicio
      </GoldButton>
    </Screen>
  );
}
