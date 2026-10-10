import { MongoServerError, ObjectId } from "mongodb";
import { type NextRequest, NextResponse } from "next/server";
import {
  type UserDocument,
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { isHostelId, type HostelId } from "@/lib/hostels";
import { DEMO_HOSTEL_INVENTORY, type RoomCapacity } from "@/lib/demo-hostel-inventory";
import type { HostelDocument, HostelRoomInventoryDocument } from "@/lib/models";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRoomCapacity(value: unknown): value is RoomCapacity {
  return value === 1 || value === 2 || value === 3 || value === 4;
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

  const { name, email, matricNumber, password, accommodation, paymentCompleted } = body;
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedEmail =
    trimmedEmail ? trimmedEmail.toLocaleLowerCase("en") : undefined;
  if (
    typeof name !== "string" ||
    typeof matricNumber !== "string" ||
    typeof password !== "string" ||
    (email !== undefined && typeof email !== "string") ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    (normalizedEmail !== undefined &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254)) ||
    matricNumber.trim().length < 3 ||
    matricNumber.trim().length > 40 ||
    password.length < 8 ||
    password.length > 256
  ) {
    return NextResponse.json(
      { error: "Enter a valid username, matric number, and password (at least 8 characters)." },
      { status: 400 },
    );
  }

  const normalizedMatricNumber = matricNumber.trim().toLocaleLowerCase("en");
  const normalizedName = name.trim().toLocaleLowerCase("en");
  const hasAccommodation = accommodation !== undefined && accommodation !== null;
  let accommodationDetails: {
    hostelId: HostelId;
    roomNumber: string;
    capacity: RoomCapacity;
  } | null = null;
  if (hasAccommodation) {
    if (
      !isRecord(accommodation) ||
      typeof accommodation.hostelId !== "string" ||
      !isHostelId(accommodation.hostelId) ||
      typeof accommodation.roomNumber !== "string" ||
      !isRoomCapacity(accommodation.capacity) ||
      paymentCompleted !== true
    ) {
      return NextResponse.json({ error: "Choose a valid room and complete the demo payment." }, { status: 400 });
    }
    const configuration = DEMO_HOSTEL_INVENTORY[accommodation.hostelId];
    if (
      !configuration.rooms.includes(accommodation.roomNumber) ||
      !configuration.capacities.includes(accommodation.capacity)
    ) {
      return NextResponse.json({ error: "That room option is not available." }, { status: 400 });
    }
    accommodationDetails = {
      hostelId: accommodation.hostelId,
      roomNumber: accommodation.roomNumber,
      capacity: accommodation.capacity,
    };
  }

  let reservedRoom: { hostelId: HostelId; roomNumber: string; capacity: RoomCapacity } | null = null;
  let insertedUserId: ObjectId | null = null;
  try {
    const database = await getDatabase();
    const existingName = await database.collection<UserDocument>("users").findOne({
      normalizedName,
    });
    if (existingName) {
      return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    }
    if (accommodationDetails) {
      const hostel = await database.collection<HostelDocument>("hostels").findOne({
        _id: accommodationDetails.hostelId,
        active: true,
      });
      if (!hostel) {
        return NextResponse.json({ error: "That hostel is not currently available." }, { status: 409 });
      }
      const reservation = await database
        .collection<HostelRoomInventoryDocument>("hostelRoomInventory")
        .updateOne(
          {
            hostelId: accommodationDetails.hostelId,
            roomNumber: accommodationDetails.roomNumber,
            supportedCapacities: accommodationDetails.capacity,
            $or: [
              { capacity: null, bookedCount: 0 },
              {
                capacity: accommodationDetails.capacity,
                bookedCount: { $lt: accommodationDetails.capacity },
              },
            ],
          },
          {
            $set: { capacity: accommodationDetails.capacity },
            $inc: { bookedCount: 1 },
          },
        );
      if (reservation.matchedCount === 0) {
        return NextResponse.json(
          { error: "That room option was just taken. Select another room or continue without a hostel." },
          { status: 409 },
        );
      }
      reservedRoom = {
        hostelId: accommodationDetails.hostelId,
        roomNumber: accommodationDetails.roomNumber,
        capacity: accommodationDetails.capacity,
      };
    }
    const user: UserDocument = {
      name: name.trim(),
      normalizedName,
      username: name.trim(),
      normalizedUsername: normalizedName,
      passwordHash: await hashPassword(password),
      ...(normalizedEmail ? { email: trimmedEmail, normalizedEmail } : {}),
      matricNumber: matricNumber.trim(),
      normalizedMatricNumber,
      hostel: accommodationDetails?.hostelId ?? null,
      roomNumber: accommodationDetails?.roomNumber ?? null,
      roomCapacity: accommodationDetails?.capacity ?? null,
      accommodationPaymentStatus: accommodationDetails ? "paid" : "not_required",
      role: "student",
      createdAt: new Date(),
    };
    const result = await database.collection<UserDocument>("users").insertOne(user);
    insertedUserId = result.insertedId;
    const { token, expiresAt } = createSessionToken(result.insertedId.toHexString());
    const response = NextResponse.json(
      {
        user: {
          id: result.insertedId.toHexString(),
          name: user.name,
          hostel: user.hostel,
          roomNumber: user.roomNumber,
          role: user.role,
        },
      },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    let shouldReleaseRoom = insertedUserId === null;
    if (insertedUserId) {
      try {
        const deletion = await (await getDatabase())
          .collection<UserDocument>("users")
          .deleteOne({ _id: insertedUserId });
        shouldReleaseRoom = deletion.deletedCount > 0;
      } catch (rollbackError) {
        console.error("Registration rollback failed:", rollbackError);
      }
    }
    if (reservedRoom && shouldReleaseRoom) {
      try {
        const inventory = (await getDatabase()).collection<HostelRoomInventoryDocument>("hostelRoomInventory");
        const roomFilter = {
          hostelId: reservedRoom.hostelId,
          roomNumber: reservedRoom.roomNumber,
          capacity: reservedRoom.capacity,
        };
        await inventory.updateOne({ ...roomFilter, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
        await inventory.updateOne({ ...roomFilter, bookedCount: 0 }, { $set: { capacity: null } });
      } catch (rollbackError) {
        console.error("Room reservation rollback failed:", rollbackError);
      }
    }
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json(
        { error: "An account already exists with this username, email, or matric number." },
        { status: 409 },
      );
    }
    console.error("Student registration failed:", error);
    return NextResponse.json({ error: "Registration is temporarily unavailable." }, { status: 500 });
  }
}
