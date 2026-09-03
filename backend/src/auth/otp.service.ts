// src/auth/otp.service.ts
import { Pool } from "pg";
import crypto from "crypto";

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
   * Genera un código, lo persiste hasheado, y lo "envía" (mock — loguea en vez de
   * llamar a un proveedor de SMS real, que no está integrado todavía).
   */
  async requestOtp(phone: string): Promise<void> {
    const code = generateCode();
    const codeHash = hashCode(phone, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.pool.query(
      `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [phone, codeHash, expiresAt]
    );

    // Mock de envío — reemplazar por integración real de SMS en un loop futuro.
    // eslint-disable-next-line no-console
    console.log(`[OTP mock] Enviando código ${code} a ${phone} (expira en ${OTP_TTL_MINUTES} min)`);
  }

  /**
   * Verifica el código más reciente no consumido para ese teléfono.
   * Incrementa `attempts` en cada intento fallido — no revela si el teléfono existe
   * o no, ni si el código expiró vs. es incorrecto (mismo error genérico) para no dar
   * pistas a un atacante haciendo fuerza bruta.
   */
  async verifyOtp(phone: string, code: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT id, code_hash, attempts, expires_at FROM otp_codes
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
  }
}
