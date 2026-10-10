import { type NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
  DUMMY_PASSWORD_HASH,
  SESSION_COOKIE,
} from "@/lib/auth";
import type { UserDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { identifier, password } = body;
  if (
    typeof identifier !== "string" ||
    typeof password !== "string" ||
    identifier.trim().length === 0 ||
    identifier.length > 254 ||
    password.length === 0 ||
    password.length > 256
  ) {
    return NextResponse.json({ error: "Enter a valid name or email and password." }, { status: 400 });
  }

  try {
    const normalizedIdentifier = identifier.trim().toLocaleLowerCase("en");
    const database = await getDatabase();
    const users = database.collection<UserDocument>("users");
    const user =
      (await users.findOne({
        $or: [
          { normalizedUsername: normalizedIdentifier },
          { normalizedEmail: normalizedIdentifier },
        ],
      })) ??
      (await users.findOne({ normalizedName: normalizedIdentifier }));
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user?._id || !passwordMatches) {
      return NextResponse.json({ error: "Invalid name/email or password." }, { status: 401 });
    }

    const { token, expiresAt } = createSessionToken(user._id.toHexString());
    const response = NextResponse.json({
      user: {
        id: user._id.toHexString(),
        name: user.name,
        hostel: user.hostel,
        roomNumber: user.roomNumber ?? null,
        role: user.role,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Authentication request failed:", error);
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 500 });
  }
}
