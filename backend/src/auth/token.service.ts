// src/auth/token.service.ts
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-in-production";

export interface AccessTokenPayload {
  sub: string; // userId
  role: string;
  customerId?: string; // presente si el usuario tiene perfil de cliente
  tenantId?: string; // presente si el usuario es staff/admin de un tenant
  staffId?: string; // presente si el usuario es un barbero (role === 'barber') — Loop 12
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("La sesión expiró o fue revocada. Iniciá sesión de nuevo.");
    this.name = "InvalidRefreshTokenError";
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class TokenService {
  constructor(private pool: Pool) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  }

  /**
   * Usado exclusivamente por el endpoint de refresh: verifica la FIRMA del access token
   * (sigue siendo uno emitido legítimamente por este servidor) pero ignora que haya
   * expirado — expirado es justamente el caso normal al pedir un refresh. Nunca usar
   * esto para autorizar una acción real, solo para recuperar el payload de forma segura.
   */
  decodeExpiredAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as AccessTokenPayload;
  }

  /** Emite un par access+refresh nuevo y persiste el refresh hasheado. */
  async issueTokenPair(payload: AccessTokenPayload): Promise<TokenPair> {
    const accessToken = this.signAccessToken(payload);
    const refreshToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [payload.sub, hashToken(refreshToken), expiresAt]
    );

    return { accessToken, refreshToken };
  }

  /**
   * Rotación: revoca el refresh usado y emite un par nuevo. Si el refresh token ya
   * fue usado antes (revocado) o no existe, se rechaza — esto detecta robo de token
   * (si alguien usa un refresh ya rotado, es señal de que dos partes lo tienen).
   */
  async rotateTokenPair(refreshToken: string, payload: AccessTokenPayload): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);
    const { rows } = await this.pool.query(
      `SELECT id FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    if (rows.length === 0) throw new InvalidRefreshTokenError();

    await this.pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [rows[0].id]);
    return this.issueTokenPair(payload);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }
}
