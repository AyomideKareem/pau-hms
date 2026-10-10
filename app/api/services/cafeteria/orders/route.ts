import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/api-user";
import { isHostelId } from "@/lib/hostels";
import type { CafeteriaMenuItemDocument, CafeteriaOrderDocument, HostelDocument } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

class InsufficientStockError extends Error {}

interface RequestedLine {
  menuItemId: string;
  quantity: number;
}

function isOrderLines(value: unknown): value is RequestedLine[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 20 &&
    value.every(
      (line) =>
        typeof line === "object" &&
        line !== null &&
        "menuItemId" in line &&
        typeof line.menuItemId === "string" &&
        "quantity" in line &&
        typeof line.quantity === "number" &&
        Number.isInteger(line.quantity) &&
        line.quantity >= 1 &&
        line.quantity <= 10,
    ) &&
    new Set(value.map((line) => line.menuItemId)).size === value.length
  );
}

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
    const orders = await database
      .collection<CafeteriaOrderDocument>("cafeteriaOrders")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return NextResponse.json({
      orders: orders.map(({ _id, ...order }) => ({
        id: _id?.toHexString(),
        ...order,
        createdAt: order.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Cafeteria order history lookup failed:", error);
    return NextResponse.json({ error: "Your order history is temporarily unavailable." }, { status: 500 });
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
    !("items" in body) ||
    !isOrderLines(body.items)
  ) {
    return NextResponse.json({ error: "Choose a hostel and at least one valid menu item." }, { status: 400 });
  }

  const hostelId = body.hostelId;
  const requestedItems = body.items;
  try {
    const database = await getDatabase();
    const hostel = await database.collection<HostelDocument>("hostels").findOne({ _id: hostelId, active: true });
    if (!hostel) {
      return NextResponse.json({ error: "This hostel is not available." }, { status: 404 });
    }

    const menus = database.collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems");
    const menuItems = await menus
      .find({ _id: { $in: requestedItems.map((item) => item.menuItemId) }, hostelId, active: true })
      .toArray();
    if (menuItems.length !== requestedItems.length) {
      return NextResponse.json({ error: "One or more menu items are unavailable." }, { status: 409 });
    }

    const snapshots = requestedItems.map((requested) => {
      const menuItem = menuItems.find((item) => item._id === requested.menuItemId);
      if (!menuItem) {
        throw new Error("Validated menu item was not found.");
      }
      return {
        menuItemId: menuItem._id,
        name: menuItem.name,
        quantity: requested.quantity,
        unitPrice: menuItem.price,
        lineTotal: menuItem.price * requested.quantity,
      };
    });

    const reserved: RequestedLine[] = [];
    try {
      for (const requested of requestedItems) {
        const update = await menus.updateOne(
          {
            _id: requested.menuItemId,
            hostelId,
            active: true,
            stockAvailable: { $gte: requested.quantity },
          },
          { $inc: { stockAvailable: -requested.quantity }, $set: { updatedAt: new Date() } },
        );
        if (update.modifiedCount !== 1) {
          throw new InsufficientStockError("Menu item stock changed while ordering.");
        }
        reserved.push(requested);
      }

      const now = new Date();
      const order: CafeteriaOrderDocument = {
        userId: user.objectId,
        studentName: user.name,
        hostelId,
        hostelName: hostel.name,
        items: snapshots,
        total: snapshots.reduce((sum, item) => sum + item.lineTotal, 0),
        status: "pending",
        isSampleMenu: menuItems.some((item) => item.isSample),
        createdAt: now,
        updatedAt: now,
      };
      const inserted = await database.collection<CafeteriaOrderDocument>("cafeteriaOrders").insertOne(order);
      return NextResponse.json(
        {
          order: {
            id: inserted.insertedId.toHexString(),
            ...order,
            createdAt: now.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      try {
        if (reserved.length > 0) {
          await menus.bulkWrite(
            reserved.map((item) => ({
              updateOne: {
                filter: { _id: item.menuItemId, hostelId },
                update: { $inc: { stockAvailable: item.quantity } },
              },
            })),
          );
        }
      } catch (rollbackError) {
        console.error("Cafeteria stock rollback failed:", rollbackError);
      }

      if (error instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: "A serving just sold out. Refresh the menu and try again." },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Cafeteria order creation failed:", error);
    return NextResponse.json({ error: "The order could not be saved. Please try again." }, { status: 500 });
  }
}
