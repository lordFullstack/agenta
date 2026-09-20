// frontend/src/components/ImagePicker.tsx
// Selector de imagen compartido por el panel (logo, portada, foto de barbero).
// Valida tipo y peso en el navegador (mismo límite que el backend: JPG/PNG/WebP, 5 MB)
// para avisar al instante en vez de esperar un error del servidor, y muestra "subiendo"
// mientras dura la subida.
import React, { useState } from "react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function checkImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Usa una imagen JPG, PNG o WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "La imagen pesa más de 5 MB. Prueba con una más liviana.";
  return null;
}

export function ImagePicker({
  onPick,
  onInvalid,
  ariaLabel,
  className = "",
  children,
}: {
  onPick: (file: File) => void | Promise<void>;
  onInvalid?: (message: string | null) => void;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode | ((busy: boolean) => React.ReactNode);
}) {
  const [busy, setBusy] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    const problem = checkImage(file);
    onInvalid?.(problem);
    if (problem) return;
    setBusy(true);
    try {
      await onPick(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      aria-label={ariaLabel}
      className={`${className} ${busy ? "pointer-events-none opacity-70" : "cursor-pointer"}`}
    >
      {typeof children === "function" ? children(busy) : children}
      <input type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleChange} disabled={busy} className="hidden" />
    </label>
  );
}
