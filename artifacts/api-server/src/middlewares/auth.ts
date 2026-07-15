import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const CLOCK_TOLERANCE_SECONDS = 30;
const DEFAULT_AUDIENCE = "authenticated";

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type SupabaseJwtPayload = {
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type Jwk = {
  kty?: string;
  use?: string;
  key_ops?: string[];
  kid?: string;
  alg?: string;
  x5u?: string;
  x5c?: string[];
  x5t?: string;
  "x5t#S256"?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
};

type Jwks = {
  keys?: Jwk[];
};

type AuthenticatedUser = {
  userId: number;
  supabaseUserId: string;
  email: string | null;
};

let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function normalizeSupabaseUrl(): string {
  return getRequiredEnv("SUPABASE_URL").replace(/\/+$/, "");
}

function getExpectedIssuer(): string {
  return process.env["SUPABASE_JWT_ISSUER"]?.trim() ?? `${normalizeSupabaseUrl()}/auth/v1`;
}

function getExpectedAudience(): string {
  return process.env["SUPABASE_JWT_AUDIENCE"]?.trim() ?? DEFAULT_AUDIENCE;
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function decodeJsonPart<T>(part: string): T {
  return JSON.parse(base64UrlDecode(part).toString("utf8")) as T;
}

function extractBearerToken(req: Request): string {
  const authHeader = req.header("authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw Object.assign(new Error("Missing bearer token"), { statusCode: 401 });
  }

  return match[1].trim();
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function fetchJwks(forceRefresh = false): Promise<Jwk[]> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const response = await fetch(`${normalizeSupabaseUrl()}/auth/v1/.well-known/jwks.json`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Supabase JWKS: ${response.status}`);
  }

  const body = (await response.json()) as Jwks;
  const keys = body.keys ?? [];

  jwksCache = {
    keys,
    expiresAt: now + JWKS_CACHE_TTL_MS,
  };

  return keys;
}

async function getJwkForHeader(header: JwtHeader): Promise<Jwk> {
  if (!header.kid) {
    throw new Error("JWT key id is missing");
  }

  let keys = await fetchJwks();
  let jwk = keys.find((key) => key.kid === header.kid);

  if (!jwk) {
    keys = await fetchJwks(true);
    jwk = keys.find((key) => key.kid === header.kid);
  }

  if (!jwk) {
    throw new Error("JWT signing key was not found");
  }

  return jwk;
}

function verifyHmacSignature(
  signingInput: string,
  signature: string,
  alg: string,
): boolean {
  const secret = process.env["SUPABASE_JWT_SECRET"];
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is required for HS256 tokens");
  }

  const digest = alg === "HS256" ? "sha256" : null;
  if (!digest) {
    throw new Error(`Unsupported HMAC JWT algorithm: ${alg}`);
  }

  const expected = crypto.createHmac(digest, secret).update(signingInput).digest("base64url");
  return timingSafeEqualString(expected, signature);
}

/**
 * JWT ES256 signatures are raw R‖S (32 bytes each = 64 bytes for P-256).
 * Node.js crypto.verify expects DER-encoded ASN.1 SEQUENCE { INTEGER r, INTEGER s }.
 * This function converts the raw format to DER so Node can verify it.
 */
function ecJwtSignatureToDer(rawSig: Buffer): Buffer {
  const half = rawSig.length / 2;
  let r = rawSig.subarray(0, half);
  let s = rawSig.subarray(half);

  // Strip leading zeros but keep at least one byte; prepend 0x00 if high bit set
  // (DER encodes integers as signed, so a leading 1-bit means "negative" without the pad)
  while (r.length > 1 && r[0] === 0x00 && (r[1] & 0x80) === 0) r = r.subarray(1);
  while (s.length > 1 && s[0] === 0x00 && (s[1] & 0x80) === 0) s = s.subarray(1);
  if (r[0] & 0x80) r = Buffer.concat([Buffer.from([0x00]), r]);
  if (s[0] & 0x80) s = Buffer.concat([Buffer.from([0x00]), s]);

  // SEQUENCE { INTEGER r, INTEGER s }
  const rEncoded = Buffer.concat([Buffer.from([0x02, r.length]), r]);
  const sEncoded = Buffer.concat([Buffer.from([0x02, s.length]), s]);
  const inner = Buffer.concat([rEncoded, sEncoded]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

function verifyAsymmetricSignature(
  signingInput: string,
  signature: string,
  alg: string,
  jwk: Jwk,
): boolean {
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const rawSig = base64UrlDecode(signature);

  if (alg === "RS256") {
    return crypto.verify("SHA256", Buffer.from(signingInput), key, rawSig);
  }

  if (alg === "ES256") {
    // Convert raw R‖S to DER before verifying
    const derSig = ecJwtSignatureToDer(rawSig);
    return crypto.verify("SHA256", Buffer.from(signingInput), key, derSig);
  }

  throw new Error(`Unsupported JWT algorithm: ${alg}`);
}

function assertClaims(payload: SupabaseJwtPayload): asserts payload is SupabaseJwtPayload & { sub: string } {
  const now = Math.floor(Date.now() / 1000);
  const expectedIssuer = getExpectedIssuer();
  const expectedAudience = getExpectedAudience();

  if (!payload.sub) {
    throw new Error("JWT subject is missing");
  }

  if (payload.iss !== expectedIssuer) {
    throw new Error("JWT issuer is invalid");
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(expectedAudience)) {
    throw new Error("JWT audience is invalid");
  }

  if (!payload.exp || payload.exp < now - CLOCK_TOLERANCE_SECONDS) {
    throw new Error("JWT is expired");
  }

  if (payload.nbf && payload.nbf > now + CLOCK_TOLERANCE_SECONDS) {
    throw new Error("JWT is not active yet");
  }
}

async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload & { sub: string }> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error("JWT format is invalid");
  }

  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  const payload = decodeJsonPart<SupabaseJwtPayload>(encodedPayload);

  if (!header.alg || header.alg === "none") {
    throw new Error("JWT algorithm is invalid");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const verified =
    header.alg.startsWith("HS")
      ? verifyHmacSignature(signingInput, signature, header.alg)
      : verifyAsymmetricSignature(
          signingInput,
          signature,
          header.alg,
          await getJwkForHeader(header),
        );

  if (!verified) {
    throw new Error("JWT signature is invalid");
  }

  assertClaims(payload);
  return payload;
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function findOrCreateUser(payload: SupabaseJwtPayload & { sub: string }): Promise<AuthenticatedUser> {
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.supabaseUserId, payload.sub));

  if (existingUser) {
    // Deny access for soft-deleted accounts
    if (existingUser.deletedAt) {
      throw Object.assign(new Error("Account has been deleted"), { statusCode: 401 });
    }

    return {
      userId: existingUser.id,
      supabaseUserId: payload.sub,
      email: payload.email ?? null,
    };
  }

  const displayName =
    getMetadataString(payload.user_metadata, "name") ??
    getMetadataString(payload.user_metadata, "full_name") ??
    payload.email?.split("@")[0] ??
    "New user";

  const university =
    getMetadataString(payload.user_metadata, "university") ??
    getMetadataString(payload.user_metadata, "school") ??
    "Unknown";

  const avatarUrl =
    getMetadataString(payload.user_metadata, "avatar_url") ??
    getMetadataString(payload.user_metadata, "picture");

  const [createdUser] = await db
    .insert(usersTable)
    .values({
      supabaseUserId: payload.sub,
      name: displayName,
      university,
      avatarUrl,
      interests: [],
      lookingFor: [],
      availability: [],
    })
    .onConflictDoNothing({ target: usersTable.supabaseUserId })
    .returning();

  if (!createdUser) {
    const [racedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.supabaseUserId, payload.sub));

    if (!racedUser) {
      throw new Error("Authenticated user profile could not be provisioned");
    }

    return {
      userId: racedUser.id,
      supabaseUserId: payload.sub,
      email: payload.email ?? null,
    };
  }

  return {
    userId: createdUser.id,
    supabaseUserId: payload.sub,
    email: payload.email ?? null,
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    const payload = await verifySupabaseJwt(token);
    req.auth = await findOrCreateUser(payload);
    next();
  } catch (err) {
    const statusCode =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      typeof err.statusCode === "number"
        ? err.statusCode
        : 401;

    logger.warn({ err }, "Authentication failed");
    res.status(statusCode).json({ error: "Unauthorized" });
  }
}
