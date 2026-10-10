import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/api-user";
import { isHostelId } from "@/lib/hostels";
import type { LaundryRequestDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getApiStudent();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const hostelId = request.nextUrl.searchParams.get("hostelId");
    if (hostelId && !isHostelId(hostelId)) {
      return NextResponse.json({ error: "Select a valid hostel." }, { status: 400 });
    }
    const database = await getDatabase();
    const filter = hostelId && isHostelId(hostelId)
      ? { userId: user.objectId, hostelId }
      : { userId: user.objectId };
    const requests = await database
      .collection<LaundryRequestDocument>("laundryRequests")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return NextResponse.json({
      requests: requests.map(({ _id, ...item }) => ({
        id: _id?.toHexString(),
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Laundry request history lookup failed:", error);
    return NextResponse.json({ error: "Your laundry request history is unavailable." }, { status: 500 });
  }
}
