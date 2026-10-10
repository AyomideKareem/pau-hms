import { NextResponse } from "next/server";
import { HOSTEL_GROUPS } from "@/lib/hostels";
import { getApiStudent } from "@/lib/api-user";
import type { HostelDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getApiStudent();
  if ("response" in auth) return auth.response;

  try {
    const database = await getDatabase();
    const storedHostels = await database
      .collection<HostelDocument>("hostels")
      .find({ active: true })
      .toArray();
    const byId = new Map(storedHostels.map((hostel) => [hostel._id, hostel]));
    const hostels = HOSTEL_GROUPS.map((group) => ({
      gender: group.gender,
      hostels: group.hostels.flatMap((hostel) => {
        const stored = byId.get(hostel.id);
        return stored ? [{ id: stored._id, name: stored.name }] : [];
      }),
    }));
    const response = NextResponse.json({ hostels });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Hostel lookup failed:", error);
    return NextResponse.json({ error: "Hostels are temporarily unavailable." }, { status: 500 });
  }
}
