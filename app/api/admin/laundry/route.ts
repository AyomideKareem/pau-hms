import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getApiHostelAdmin } from "@/lib/api-user";
import type { LaundryRequestDocument, LaundryServiceDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const requestStatuses = ["pending", "accepted", "collected", "processing", "ready", "completed", "cancelled"] as const;
const requestTransitions: Record<LaundryRequestDocument["status"], LaundryRequestDocument["status"][]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["collected", "cancelled"],
  collected: ["processing", "cancelled"],
  processing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const auth = await getApiHostelAdmin();
  if ("response" in auth) return auth.response;

  try {
    const database = await getDatabase();
    const [services, requests] = await Promise.all([
      database.collection<LaundryServiceDocument>("laundryServices")
        .find({ hostelId: auth.user.hostel })
        .sort({ name: 1 })
        .toArray(),
      database.collection<LaundryRequestDocument>("laundryRequests")
        .find({ hostelId: auth.user.hostel })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    ]);
    const response = NextResponse.json({
      services: services.map(({ _id, ...service }) => ({ id: _id, ...service })),
      requests: requests.map(({ _id, ...laundryRequest }) => ({
        id: _id?.toHexString(),
        ...laundryRequest,
        createdAt: laundryRequest.createdAt.toISOString(),
      })),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Hostel laundry dashboard lookup failed:", error);
    return NextResponse.json({ error: "Laundry data is temporarily unavailable." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiHostelAdmin();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isRecord(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  try {
    const database = await getDatabase();
    if (
      body.type === "service" &&
      typeof body.id === "string" &&
      typeof body.name === "string" &&
      body.name.trim().length >= 2 &&
      body.name.trim().length <= 100 &&
      typeof body.description === "string" &&
      body.description.length <= 500 &&
      typeof body.pricePerLoad === "number" &&
      Number.isSafeInteger(body.pricePerLoad) &&
      body.pricePerLoad >= 0 &&
      typeof body.active === "boolean"
    ) {
      const updated = await database.collection<LaundryServiceDocument>("laundryServices").updateOne(
        { _id: body.id, hostelId: auth.user.hostel },
        {
          $set: {
            name: body.name.trim(),
            description: body.description.trim(),
            pricePerLoad: body.pricePerLoad,
            active: body.active,
            updatedAt: new Date(),
          },
        },
      );
      if (updated.matchedCount !== 1) {
        return NextResponse.json({ error: "Laundry service not found in your hostel." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (
      body.type === "request" &&
      typeof body.id === "string" &&
      ObjectId.isValid(body.id) &&
      typeof body.status === "string" &&
      requestStatuses.includes(body.status as (typeof requestStatuses)[number])
    ) {
      const requests = database.collection<LaundryRequestDocument>("laundryRequests");
      const requestId = new ObjectId(body.id);
      const filter = { _id: requestId, hostelId: auth.user.hostel };
      const currentRequest = await requests.findOne(filter);
      if (!currentRequest) {
        return NextResponse.json({ error: "Laundry request not found in your hostel." }, { status: 404 });
      }
      const nextStatus = body.status as LaundryRequestDocument["status"];
      if (nextStatus !== currentRequest.status && !requestTransitions[currentRequest.status].includes(nextStatus)) {
        return NextResponse.json({ error: "Laundry requests can only move forward through their workflow." }, { status: 409 });
      }
      const updated = await requests.updateOne(
        { ...filter, status: currentRequest.status },
        { $set: { status: nextStatus, updatedAt: new Date() } },
      );
      if (updated.matchedCount !== 1) {
        return NextResponse.json({ error: "The laundry request changed. Refresh and try again." }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Hostel laundry update failed:", error);
    return NextResponse.json({ error: "The laundry update could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ error: "Enter a valid laundry service or request update." }, { status: 400 });
}
