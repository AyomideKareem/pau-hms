import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getApiHostelAdmin } from "@/lib/api-user";
import type { ComplaintDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const complaintStatuses = ["open", "in_review", "resolved", "closed"] as const;

export async function GET() {
  const auth = await getApiHostelAdmin();
  if ("response" in auth) return auth.response;

  try {
    const complaints = await (await getDatabase())
      .collection<ComplaintDocument>("complaints")
      .find({ hostelId: auth.user.hostel })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    const response = NextResponse.json({
      complaints: complaints.map(({ _id, ...complaint }) => ({
        id: _id?.toHexString(),
        ...complaint,
        createdAt: complaint.createdAt.toISOString(),
      })),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Hostel complaint dashboard lookup failed:", error);
    return NextResponse.json({ error: "Complaint data is temporarily unavailable." }, { status: 500 });
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
  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string" ||
    !ObjectId.isValid(body.id) ||
    !("status" in body) ||
    typeof body.status !== "string" ||
    !complaintStatuses.includes(body.status as (typeof complaintStatuses)[number]) ||
    !("adminResponse" in body) ||
    typeof body.adminResponse !== "string" ||
    body.adminResponse.length > 2000
  ) {
    return NextResponse.json({ error: "Enter a valid complaint status and response." }, { status: 400 });
  }

  try {
    const updated = await (await getDatabase()).collection<ComplaintDocument>("complaints").updateOne(
      { _id: new ObjectId(body.id), hostelId: auth.user.hostel },
      {
        $set: {
          status: body.status as (typeof complaintStatuses)[number],
          adminResponse: body.adminResponse.trim(),
          handledBy: auth.user.objectId,
          updatedAt: new Date(),
        },
      },
    );
    if (updated.matchedCount !== 1) {
      return NextResponse.json({ error: "Complaint not found in your hostel." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Hostel complaint update failed:", error);
    return NextResponse.json({ error: "The complaint update could not be saved." }, { status: 500 });
  }
}
