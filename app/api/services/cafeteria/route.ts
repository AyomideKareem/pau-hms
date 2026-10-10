import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/api-user";
import { isHostelId } from "@/lib/hostels";
import type { CafeteriaMenuItemDocument, HostelDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getApiStudent();
  if ("response" in auth) return auth.response;

  const hostelId = request.nextUrl.searchParams.get("hostelId");
  if (!hostelId || !isHostelId(hostelId)) {
    return NextResponse.json({ error: "Select a valid hostel." }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const [hostel, items] = await Promise.all([
      database.collection<HostelDocument>("hostels").findOne({ _id: hostelId, active: true }),
      database
        .collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems")
        .find({ hostelId, active: true })
        .sort({ category: 1, name: 1 })
        .toArray(),
    ]);
    if (!hostel) {
      return NextResponse.json({ error: "This hostel is not available." }, { status: 404 });
    }

    const response = NextResponse.json({
      hostel: { id: hostel._id, name: hostel.name },
      items: items.map(({ _id, hostelId: itemHostelId, ...item }) => ({
        id: _id,
        hostelId: itemHostelId,
        ...item,
      })),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Cafeteria menu lookup failed:", error);
    return NextResponse.json({ error: "The cafeteria menu is temporarily unavailable." }, { status: 500 });
  }
}
