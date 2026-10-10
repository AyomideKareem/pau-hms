import { NextResponse, type NextRequest } from "next/server";
import { isHostelId } from "@/lib/hostels";
import { DEMO_HOSTEL_INVENTORY } from "@/lib/demo-hostel-inventory";
import { getDatabase } from "@/lib/mongodb";
import type { HostelDocument, HostelRoomInventoryDocument } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const hostelId = request.nextUrl.searchParams.get("hostelId");
  if (!hostelId || !isHostelId(hostelId)) {
    return NextResponse.json({ error: "Choose a valid hostel." }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const hostel = await database
      .collection<HostelDocument>("hostels")
      .findOne({ _id: hostelId, active: true });
    if (!hostel) {
      return NextResponse.json({ error: "That hostel is not currently available." }, { status: 404 });
    }
    const rooms = await database
      .collection<HostelRoomInventoryDocument>("hostelRoomInventory")
      .find({ hostelId })
      .sort({ roomNumber: 1 })
      .toArray();

    const configuredRoomNumbers = DEMO_HOSTEL_INVENTORY[hostelId].rooms;
    const availableRooms = rooms.filter((room) => configuredRoomNumbers.includes(room.roomNumber)).map((room) => {
      const capacity = room.capacity;
      const remaining =
        capacity === null
          ? null
          : Math.max(0, capacity - room.bookedCount);
      return {
        roomNumber: room.roomNumber,
        capacities:
          capacity === null
            ? room.supportedCapacities.map((value) => ({ value, availableSpaces: value }))
            : remaining && room.supportedCapacities.includes(capacity)
              ? [{ value: capacity, availableSpaces: remaining }]
              : [],
      };
    });
    const response = NextResponse.json({ rooms: availableRooms });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Room availability lookup failed:", error);
    return NextResponse.json({ error: "Room availability is temporarily unavailable." }, { status: 500 });
  }
}
