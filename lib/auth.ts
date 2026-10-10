import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import type { AuthUser, UserDocument } from "@/lib/models";

const SESSION_COOKIE = "pau_hms_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DUMMY_PASSWORD_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;

export type { AuthUser, UserDocument } from "@/lib/models";

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 bytes.");
  }
  return secret;
}

async function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !saltHex ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !keyHex ||
    !/^[0-9a-f]{128}$/i.test(keyHex)
  ) {
    return false;
  }

  const expectedKey = Buffer.from(keyHex, "hex");
  const actualKey = await derivePasswordKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actualKey, expectedKey);
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt } satisfies SessionPayload)).toString(
    "base64url",
  );
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = Buffer.from(sign(payload), "base64url");
  const providedSignature = Buffer.from(signature, "base64url");
  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "userId" in parsed &&
      typeof parsed.userId === "string" &&
      ObjectId.isValid(parsed.userId) &&
      "expiresAt" in parsed &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Math.floor(Date.now() / 1000)
    ) {
      return { userId: parsed.userId, expiresAt: parsed.expiresAt };
    }
  } catch {
    return null;
  }
  return null;
}

export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(expiresAt * 1000),
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = verifySessionToken(token);
  if (!session) {
    return null;
  }

  const database = await getDatabase();
  const user = await database
    .collection<UserDocument>("users")
    .findOne({ _id: new ObjectId(session.userId) });
  if (!user?._id) {
    return null;
  }

  return {
    id: user._id.toHexString(),
    name: user.name,
    hostel: user.hostel,
    roomNumber: user.roomNumber ?? null,
    role: user.role,
  };
}

export { DUMMY_PASSWORD_HASH, SESSION_COOKIE, SESSION_TTL_SECONDS };
