// src/auth/email.service.ts
import { Resend } from "resend";
import { logger } from "../logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Envía el código de verificación por email. Sin RESEND_API_KEY configurada,
 * cae al mismo mock por consola que tenía el OTP por SMS — no bloquea desarrollo
 * local ni un primer deploy antes de tener la cuenta de Resend lista.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.log(`[OTP mock] Enviando código ${code} a ${to} (RESEND_API_KEY no configurada)`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Tu código de verificación: ${code}`,
    html: `<p>Tu código para confirmar la reserva es:</p><h1 style="letter-spacing:4px">${code}</h1><p>Vence en 5 minutos. Si no pediste este código, ignorá este mensaje.</p>`,
  });

  if (error) {
    logger.error({ error }, "No se pudo enviar el email de verificación");
    throw new Error("No se pudo enviar el email de verificación.");
  }
}
