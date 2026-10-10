import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/api-user";
import { isHostelId } from "@/lib/hostels";
import { isComplaintCategory, type ComplaintDocument, type HostelDocument } from "@/lib/models";
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
    const complaints = await database
      .collection<ComplaintDocument>("complaints")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return NextResponse.json({
      complaints: complaints.map(({ _id, ...item }) => ({
        id: _id?.toHexString(),
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Complaint history lookup failed:", error);
    return NextResponse.json({ error: "Your complaint history is unavailable." }, { status: 500 });
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
  if (
    typeof body !== "object" ||
    body === null ||
    !("hostelId" in body) ||
    typeof body.hostelId !== "string" ||
    !isHostelId(body.hostelId) ||
    !("category" in body) ||
    typeof body.category !== "string" ||
    !isComplaintCategory(body.category) ||
    !("subject" in body) ||
    typeof body.subject !== "string" ||
    body.subject.trim().length < 4 ||
    body.subject.trim().length > 100 ||
    !("details" in body) ||
    typeof body.details !== "string" ||
    body.details.trim().length < 10 ||
    body.details.trim().length > 2000
  ) {
    return NextResponse.json({ error: "Enter a valid hostel, category, subject, and complaint details." }, { status: 400 });
  }

  const hostelId = body.hostelId;
  try {
    const database = await getDatabase();
    const hostel = await database.collection<HostelDocument>("hostels").findOne({ _id: hostelId, active: true });
    if (!hostel) {
      return NextResponse.json({ error: "This hostel is not available." }, { status: 404 });
    }

    const now = new Date();
    const complaint: ComplaintDocument = {
      userId: user.objectId,
      studentName: user.name,
      hostelId,
      hostelName: hostel.name,
      category: body.category,
      subject: body.subject.trim(),
      details: body.details.trim(),
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await database.collection<ComplaintDocument>("complaints").insertOne(complaint);
    return NextResponse.json(
      { complaint: { id: inserted.insertedId.toHexString(), ...complaint, createdAt: now.toISOString() } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Complaint creation failed:", error);
    return NextResponse.json({ error: "The complaint could not be saved." }, { status: 500 });
  }
}
