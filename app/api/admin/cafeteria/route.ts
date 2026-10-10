import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getApiHostelAdmin } from "@/lib/api-user";
import type { CafeteriaMenuItemDocument, CafeteriaOrderDocument, MenuCategory } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const categories: MenuCategory[] = ["Breakfast", "Lunch", "Dinner", "Drinks"];
const orderStatuses = ["pending", "preparing", "ready", "collected", "cancelled"] as const;
const orderTransitions: Record<CafeteriaOrderDocument["status"], CafeteriaOrderDocument["status"][]> = {
  pending: ["preparing"],
  preparing: ["ready"],
  ready: ["collected"],
  collected: [],
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
    const [items, orders] = await Promise.all([
      database.collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems")
        .find({ hostelId: auth.user.hostel })
        .sort({ category: 1, name: 1 })
        .toArray(),
      database.collection<CafeteriaOrderDocument>("cafeteriaOrders")
        .find({ hostelId: auth.user.hostel })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    ]);
    const response = NextResponse.json({
      items: items.map(({ _id, ...item }) => ({ id: _id, ...item })),
      orders: orders.map(({ _id, ...order }) => ({
        id: _id?.toHexString(),
        ...order,
        createdAt: order.createdAt.toISOString(),
      })),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Hostel cafeteria dashboard lookup failed:", error);
    return NextResponse.json({ error: "Cafeteria data is temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getApiHostelAdmin();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.name !== "string" ||
    body.name.trim().length < 2 ||
    body.name.trim().length > 100 ||
    typeof body.description !== "string" ||
    body.description.length > 500 ||
    typeof body.category !== "string" ||
    !categories.includes(body.category as MenuCategory) ||
    typeof body.price !== "number" ||
    !Number.isSafeInteger(body.price) ||
    body.price < 0 ||
    typeof body.stockAvailable !== "number" ||
    !Number.isSafeInteger(body.stockAvailable) ||
    body.stockAvailable < 0
  ) {
    return NextResponse.json({ error: "Enter a valid item name, category, price, and stock quantity." }, { status: 400 });
  }

  try {
    const now = new Date();
    const item: CafeteriaMenuItemDocument = {
      _id: randomUUID(),
      hostelId: auth.user.hostel,
      name: body.name.trim(),
      description: body.description.trim(),
      category: body.category as MenuCategory,
      price: body.price,
      stockAvailable: body.stockAvailable,
      active: true,
      isSample: false,
      createdAt: now,
      updatedAt: now,
    };
    await (await getDatabase()).collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems").insertOne(item);
    return NextResponse.json({ item: { id: item._id, ...item } }, { status: 201 });
  } catch (error) {
    console.error("Hostel menu item creation failed:", error);
    return NextResponse.json({ error: "The menu item could not be created." }, { status: 500 });
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
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    if (
      body.type === "item" &&
      typeof body.id === "string" &&
      typeof body.name === "string" &&
      body.name.trim().length >= 2 &&
      body.name.trim().length <= 100 &&
      typeof body.description === "string" &&
      body.description.length <= 500 &&
      typeof body.category === "string" &&
      categories.includes(body.category as MenuCategory) &&
      typeof body.price === "number" &&
      Number.isSafeInteger(body.price) &&
      body.price >= 0 &&
      typeof body.stockAvailable === "number" &&
      Number.isSafeInteger(body.stockAvailable) &&
      body.stockAvailable >= 0 &&
      typeof body.active === "boolean"
    ) {
      const updated = await database.collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems").updateOne(
        { _id: body.id, hostelId: auth.user.hostel },
        {
          $set: {
            name: body.name.trim(),
            description: body.description.trim(),
            category: body.category as MenuCategory,
            price: body.price,
            stockAvailable: body.stockAvailable,
            active: body.active,
            updatedAt: new Date(),
          },
        },
      );
      if (updated.matchedCount !== 1) {
        return NextResponse.json({ error: "Menu item not found in your hostel." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (
      body.type === "order" &&
      typeof body.id === "string" &&
      /^[a-f\d]{24}$/i.test(body.id) &&
      typeof body.status === "string" &&
      orderStatuses.includes(body.status as (typeof orderStatuses)[number])
    ) {
      const orders = database.collection<CafeteriaOrderDocument>("cafeteriaOrders");
      const orderId = new ObjectId(body.id);
      const filter = { _id: orderId, hostelId: auth.user.hostel };
      const currentOrder = await orders.findOne(filter);
      if (!currentOrder) {
        return NextResponse.json({ error: "Order not found in your hostel." }, { status: 404 });
      }
      const nextStatus = body.status as CafeteriaOrderDocument["status"];
      if (nextStatus !== currentOrder.status && !orderTransitions[currentOrder.status].includes(nextStatus)) {
        return NextResponse.json({ error: "Orders can only move forward through preparation and collection." }, { status: 409 });
      }
      const updated = await orders.updateOne(
        { ...filter, status: currentOrder.status },
        { $set: { status: nextStatus, updatedAt: new Date() } },
      );
      if (updated.matchedCount !== 1) {
        return NextResponse.json({ error: "The order changed. Refresh and try again." }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Hostel cafeteria update failed:", error);
    return NextResponse.json({ error: "The cafeteria update could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ error: "Enter a valid menu item or order update." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getApiHostelAdmin();
  if ("response" in auth) return auth.response;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Menu item ID is required." }, { status: 400 });

  try {
    const updated = await (await getDatabase())
      .collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems")
      .updateOne(
        { _id: id, hostelId: auth.user.hostel },
        { $set: { active: false, updatedAt: new Date() } },
      );
    if (updated.matchedCount !== 1) {
      return NextResponse.json({ error: "Menu item not found in your hostel." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Hostel menu item deactivation failed:", error);
    return NextResponse.json({ error: "The menu item could not be deactivated." }, { status: 500 });
  }
}
