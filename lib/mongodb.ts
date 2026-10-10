import { MongoClient, type Db } from "mongodb";
import type {
  CafeteriaMenuItemDocument,
  CafeteriaOrderDocument,
  ComplaintDocument,
  HostelDocument,
  LaundryRequestDocument,
  LaundryServiceDocument,
  HostelRoomInventoryDocument,
} from "@/lib/models";
import { DEMO_HOSTEL_INVENTORY } from "@/lib/demo-hostel-inventory";
import { HOSTEL_GROUPS } from "@/lib/hostels";

type MongoGlobal = typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
  databaseSetupPromise?: Promise<void>;
};

const mongoGlobal = globalThis as MongoGlobal;

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI must be configured.");
  }

  if (!mongoGlobal.mongoClientPromise) {
    mongoGlobal.mongoClientPromise = new MongoClient(uri).connect().catch((error: unknown) => {
      mongoGlobal.mongoClientPromise = undefined;
      throw error;
    });
  }

  const client = await mongoGlobal.mongoClientPromise;
  const database = client.db(process.env.MONGODB_DB || "pau_hms");

  if (!mongoGlobal.databaseSetupPromise) {
    const users = database.collection("users");
    const hostels = database.collection<HostelDocument>("hostels");
    const menus = database.collection<CafeteriaMenuItemDocument>("cafeteriaMenuItems");
    const orders = database.collection<CafeteriaOrderDocument>("cafeteriaOrders");
    const laundryServices = database.collection<LaundryServiceDocument>("laundryServices");
    const laundryRequests = database.collection<LaundryRequestDocument>("laundryRequests");
    const complaints = database.collection<ComplaintDocument>("complaints");
    const roomInventory = database.collection<HostelRoomInventoryDocument>("hostelRoomInventory");
    mongoGlobal.databaseSetupPromise = Promise.all([
      users.createIndex({ normalizedUsername: 1 }, {
        unique: true,
        partialFilterExpression: { normalizedUsername: { $type: "string" } },
      }),
      users.createIndex({ normalizedName: 1, hostel: 1 }, { unique: true }),
      users.createIndex({ normalizedEmail: 1 }, {
        unique: true,
        partialFilterExpression: { normalizedEmail: { $type: "string" } },
      }),
      users.createIndex({ normalizedMatricNumber: 1 }, {
        unique: true,
        partialFilterExpression: { normalizedMatricNumber: { $type: "string" } },
      }),
      hostels.createIndex({ active: 1, gender: 1 }),
      roomInventory.createIndex({ hostelId: 1, roomNumber: 1 }, { unique: true }),
      menus.createIndex({ hostelId: 1, active: 1, category: 1 }),
      orders.createIndex({ userId: 1, createdAt: -1 }),
      orders.createIndex({ hostelId: 1, status: 1, createdAt: -1 }),
      laundryServices.createIndex({ hostelId: 1, active: 1 }),
      laundryRequests.createIndex({ userId: 1, createdAt: -1 }),
      laundryRequests.createIndex({ hostelId: 1, status: 1, createdAt: -1 }),
      complaints.createIndex({ userId: 1, createdAt: -1 }),
      complaints.createIndex({ hostelId: 1, status: 1, createdAt: -1 }),
    ])
      .then(async () => {
        const rooms = HOSTEL_GROUPS.flatMap(({ hostels }) =>
          hostels.flatMap(({ id }) =>
            DEMO_HOSTEL_INVENTORY[id].rooms.map((roomNumber) => ({
              updateOne: {
                filter: { hostelId: id, roomNumber },
                update: {
                  $set: {
                    supportedCapacities: DEMO_HOSTEL_INVENTORY[id].capacities,
                  },
                  $setOnInsert: {
                    hostelId: id,
                    roomNumber,
                    capacity: null,
                    bookedCount: 0,
                  },
                },
                upsert: true,
              },
            })),
          ),
        );
        if (rooms.length > 0) {
          await roomInventory.bulkWrite(rooms);
        }
      })
      .catch((error: unknown) => {
        mongoGlobal.databaseSetupPromise = undefined;
        throw error;
      });
  }

  await mongoGlobal.databaseSetupPromise;
  return database;
}
