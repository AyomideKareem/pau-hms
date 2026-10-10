import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { HostelId } from "@/lib/hostels";
import type { AuthUser } from "@/lib/models";

type ApiError = { response: NextResponse };
type ApiSuccess<T extends AuthUser = AuthUser> = { user: T & { objectId: ObjectId } };

export async function getApiUser(): Promise<ApiError | ApiSuccess> {
  try {
    const user = await getCurrentUser();
    if (!user || !ObjectId.isValid(user.id)) {
      return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
    }
    return { user: { ...user, objectId: new ObjectId(user.id) } };
  } catch (error) {
    console.error("API session verification failed:", error);
    return {
      response: NextResponse.json(
        { error: "Authentication is temporarily unavailable." },
        { status: 503 },
      ),
    };
  }
}

export async function getApiHostelAdmin(): Promise<
  ApiError | ApiSuccess<AuthUser & { role: "admin"; hostel: HostelId }>
> {
  const auth = await getApiUser();
  if ("response" in auth) return auth;
  if (auth.user.role !== "admin" || !auth.user.hostel) {
    return {
      response: NextResponse.json(
        { error: "A hostel administrator account is required." },
        { status: 403 },
      ),
    };
  }
  return {
    user: {
      ...auth.user,
      role: "admin",
      hostel: auth.user.hostel,
    },
  };
}

export async function getApiStudent(): Promise<ApiError | ApiSuccess<AuthUser & { role: "student" }>> {
  const auth = await getApiUser();
  if ("response" in auth) return auth;
  if (auth.user.role !== "student") {
    return {
      response: NextResponse.json({ error: "A student account is required." }, { status: 403 }),
    };
  }
  return { user: { ...auth.user, role: "student" } };
}
