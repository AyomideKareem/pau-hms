import { NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const response = NextResponse.json({ user });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ error: "Session lookup is temporarily unavailable." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
