import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/api-user";
import { isHostelId } from "@/lib/hostels";
import { isLaundryServiceId, type HostelDocument, type LaundryRequestDocument, type LaundryServiceDocument } from "@/lib/models";
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
    const [hostel, services] = await Promise.all([
      database.collection<HostelDocument>("hostels").findOne({ _id: hostelId, active: true }),
      database
        .collection<LaundryServiceDocument>("laundryServices")
        .find({ hostelId, active: true })
        .sort({ name: 1 })
        .toArray(),
    ]);
    if (!hostel) {
      return NextResponse.json({ error: "This hostel is not available." }, { status: 404 });
    }
    return NextResponse.json({
      hostel: { id: hostel._id, name: hostel.name },
      services: services.map(({ _id, hostelId: serviceHostelId, ...service }) => ({
        id: _id,
        hostelId: serviceHostelId,
        ...service,
      })),
    });
  } catch (error) {
    console.error("Laundry service lookup failed:", error);
    return NextResponse.json({ error: "Laundry services are temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getApiStudent();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("hostelId" in body) || typeof body.hostelId !== "string" ||
      !isHostelId(body.hostelId) || !("serviceId" in body) || typeof body.serviceId !== "string" ||
      !isLaundryServiceId(body.serviceId) ||
      !("loadCount" in body) || typeof body.loadCount !== "number" || !Number.isInteger(body.loadCount) ||
      body.loadCount < 1 || body.loadCount > 10 || !("pickupDate" in body) || typeof body.pickupDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.pickupDate) || !("notes" in body) || typeof body.notes !== "string" ||
      body.notes.length > 300) {
    return NextResponse.json({ error: "Enter a valid laundry service, load count, pickup date, and notes." }, { status: 400 });
  }

  const hostelId = body.hostelId;
  try {
    const database = await getDatabase();
    const [hostel, service] = await Promise.all([
      database.collection<HostelDocument>("hostels").findOne({ _id: hostelId, active: true }),
      database.collection<LaundryServiceDocument>("laundryServices").findOne({
        serviceId: body.serviceId,
        hostelId,
        active: true,
      }),
    ]);
    if (!hostel || !service) {
      return NextResponse.json({ error: "This hostel or laundry service is unavailable." }, { status: 404 });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (body.pickupDate < today || new Date(`${body.pickupDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== body.pickupDate) {
      return NextResponse.json({ error: "Choose a valid pickup date today or later." }, { status: 400 });
    }

    const now = new Date();
    const laundryRequest: LaundryRequestDocument = {
      userId: user.objectId,
      studentName: user.name,
      hostelId,
      hostelName: hostel.name,
      serviceId: service.serviceId,
      serviceName: service.name,
      loadCount: body.loadCount,
      pricePerLoad: service.pricePerLoad,
      total: service.pricePerLoad * body.loadCount,
      pickupDate: body.pickupDate,
      notes: body.notes.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await database.collection<LaundryRequestDocument>("laundryRequests").insertOne(laundryRequest);
    return NextResponse.json(
      { request: { id: inserted.insertedId.toHexString(), ...laundryRequest, createdAt: now.toISOString() } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Laundry request creation failed:", error);
    return NextResponse.json({ error: "The laundry request could not be saved." }, { status: 500 });
  }
}
