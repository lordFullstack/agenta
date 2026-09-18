// src/auth/otp.service.ts
import { Pool } from "pg";
import crypto from "crypto";
import { sendOtpEmail } from "./email.service";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const OTP_PEPPER = process.env.OTP_PEPPER ?? "dev-only-pepper-change-in-production";

export class OtpExpiredOrInvalidError extends Error {
  constructor() {
    super("El código ingresado es inválido o expiró.");
    this.name = "OtpExpiredOrInvalidError";
  }
}

export class OtpAttemptsExceededError extends Error {
  constructor() {
    super("Se superó el número máximo de intentos. Pedí un código nuevo.");
    this.name = "OtpAttemptsExceededError";
  }
}

function hashCode(phone: string, code: string): string {
  return crypto.createHash("sha256").update(`${OTP_PEPPER}:${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  // 6 dígitos numéricos — crypto.randomInt es CSPRNG, no Math.random()
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export class OtpService {
  constructor(private pool: Pool) {}

  /**
   * Genera un código, lo persiste hasheado, y lo envía por email — el canal de
   * verificación de clientes es email, no SMS (decisión de producto: evita el
   * costo por SMS y la integración de un proveedor de SMS aparte).
   * `phone` sigue siendo la clave que identifica al cliente (contacto, FK lógica
   * hacia users.phone); `email` es solo el canal de entrega del código.
   */
  async requestOtp(phone: string, email: string): Promise<void> {
    const code = generateCode();
    const codeHash = hashCode(phone, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.pool.query(
      `INSERT INTO otp_codes (phone, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [phone, email, codeHash, expiresAt]
    );

    await sendOtpEmail(email, code);
  }

  /**
   * Verifica el código más reciente no consumido para ese teléfono.
   * Incrementa `attempts` en cada intento fallido — no revela si el teléfono existe
   * o no, ni si el código expiró vs. es incorrecto (mismo error genérico) para no dar
   * pistas a un atacante haciendo fuerza bruta.
   * Devuelve el email al que se mandó el código, para que el caller pueda
   * guardarlo en `users` al crear/actualizar la identidad del cliente.
   */
  async verifyOtp(phone: string, code: string): Promise<{ email: string | null }> {
    const { rows } = await this.pool.query(
      `SELECT id, code_hash, attempts, expires_at, email FROM otp_codes
       WHERE phone = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (rows.length === 0) throw new OtpExpiredOrInvalidError();
    const otp = rows[0];

    if (otp.attempts >= MAX_ATTEMPTS) throw new OtpAttemptsExceededError();
    if (new Date(otp.expires_at) < new Date()) throw new OtpExpiredOrInvalidError();

    const candidateHash = hashCode(phone, code);
    if (candidateHash !== otp.code_hash) {
      await this.pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);
      throw new OtpExpiredOrInvalidError();
    }

    await this.pool.query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [otp.id]);
    return { email: otp.email ?? null };
  }
}
