// frontend/src/components/PlatformBackgrounds.tsx
// Fondos de la plataforma (pantalla de inicio y de búsqueda del cliente).
// Los usa el administrador de la plataforma, tanto en /admin como en Configuración del panel.
import React, { useState } from "react";
import { IconCamera, IconAlert } from "./icons";
import { photoBackground } from "./ui";
import { ImagePicker } from "./ImagePicker";
import { DEFAULT_BRANDING } from "../lib/platformBranding";

export function PlatformBackgrounds({
  branding,
  onUpload,
  onRemove,
}: {
  branding: { hero: string | null; searchBg: string | null };
  onUpload: (slot: "hero" | "search_bg", file: File) => void | Promise<void>;
  onRemove: (slot: "hero" | "search_bg") => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => void | Promise<void>, fallback: string) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallback);
    }
  };

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
                onPick={(file) => run(() => onUpload(s.slot, file), "No pudimos subir el fondo.")}
                onInvalid={(msg) => setError(msg)}
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
                  onClick={() => run(() => onRemove(s.slot), "No pudimos restaurar el fondo.")}
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
