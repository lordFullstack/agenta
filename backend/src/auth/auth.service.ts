// src/auth/auth.service.ts
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { OtpService } from "./otp.service";
import { TokenService, TokenPair } from "./token.service";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Teléfono/email o contraseña incorrectos.");
    this.name = "InvalidCredentialsError";
  }
}

export class AuthService {
  constructor(private pool: Pool, private otp: OtpService, private tokens: TokenService) {}

  async requestCustomerOtp(phone: string): Promise<void> {
    await this.otp.requestOtp(phone);
  }

  /**
   * Verifica el OTP y hace login-or-register: si el teléfono no existe todavía como
   * `users`/`customers`, se crea acá mismo — el OTP verificado ES la prueba de identidad,
   * no hace falta un paso de registro separado (menos fricción, ver PRODUCT_VISION.md:
   * "reservar sin llamar a nadie", el registro no debería ser una barrera aparte).
   */
  async verifyCustomerOtpAndLogin(phone: string, code: string, fullName?: string): Promise<TokenPair> {
    await this.otp.verifyOtp(phone, code); // lanza si es inválido/expirado/agotado

    const { rows: existingUsers } = await this.pool.query(`SELECT id FROM users WHERE phone = $1`, [phone]);

    let userId: string;
    let customerId: string;

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
      const { rows: existingCustomers } = await this.pool.query(
        `SELECT id FROM customers WHERE user_id = $1`,
        [userId]
      );
      customerId = existingCustomers[0]?.id;
      if (!customerId) {
        const { rows } = await this.pool.query(
          `INSERT INTO customers (user_id) VALUES ($1) RETURNING id`,
          [userId]
        );
        customerId = rows[0].id;
      }
    } else {
      const { rows: newUser } = await this.pool.query(
        `INSERT INTO users (phone, full_name) VALUES ($1, $2) RETURNING id`,
        [phone, fullName ?? "Cliente"]
      );
      userId = newUser[0].id;
      const { rows: newCustomer } = await this.pool.query(
        `INSERT INTO customers (user_id) VALUES ($1) RETURNING id`,
        [userId]
      );
      customerId = newCustomer[0].id;
    }

    return this.tokens.issueTokenPair({ sub: userId, role: "customer", customerId });
  }

  /**
   * Login de staff/admin con password. El `tenantId` se resuelve server-side desde
   * `tenant_memberships`/`staff_members` — nunca se recibe del cliente (evitaría que
   * alguien se autentique "como" un tenant ajeno con solo cambiar un campo del body).
   */
  async loginWithPassword(identifier: string, password: string): Promise<TokenPair> {
    const { rows } = await this.pool.query(
      `SELECT id, password_hash FROM users WHERE phone = $1 OR email = $1`,
      [identifier]
    );
    if (rows.length === 0 || !rows[0].password_hash) throw new InvalidCredentialsError();

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) throw new InvalidCredentialsError();

    const userId = rows[0].id;

    const { rows: membership } = await this.pool.query(
      `SELECT tenant_id, role FROM tenant_memberships WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const { rows: staffRow } = await this.pool.query(
      `SELECT id, tenant_id FROM staff_members WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );

    const tenantId = membership[0]?.tenant_id ?? staffRow[0]?.tenant_id;
    const role = membership[0]?.role ?? (staffRow.length > 0 ? "barber" : "customer");
    const staffId = staffRow[0]?.id; // Loop 12: la agenda necesita saber "cuáles son mis citas"

    return this.tokens.issueTokenPair({ sub: userId, role, tenantId, staffId });
  }

  async refresh(refreshToken: string, payload: Parameters<TokenService["rotateTokenPair"]>[1]): Promise<TokenPair> {
    return this.tokens.rotateTokenPair(refreshToken, payload);
  }

  async logout(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
