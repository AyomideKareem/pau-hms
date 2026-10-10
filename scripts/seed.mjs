import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

const scrypt = promisify(scryptCallback);
const hostelGroups = JSON.parse(
  await readFile(new URL("../data/hostel-groups.json", import.meta.url), "utf8"),
);
const sampleMenus = JSON.parse(
  await readFile(new URL("../data/sample-menus.json", import.meta.url), "utf8"),
);
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Set MONGODB_URI before seeding the database.");
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(key).toString("hex")}`;
}

const mockUsers = [
  {
    name: "Mr. Patrick",
    normalizedName: "mr. patrick",
    password: "Welcome123!",
    hostel: "amethyst",
    roomNumber: null,
    role: "admin",
  },
  {
    name: "Daniel Samuel",
    normalizedName: "daniel samuel",
    password: "Welcome123!",
    hostel: "faith",
    roomNumber: null,
    role: "admin",
  },
  {
    name: "Ayomide Kareem",
    normalizedName: "ayomide kareem",
    password: "!Ayomide",
    hostel: "emerald",
    roomNumber: "E-204",
    role: "student",
  },
  {
    name: "Maya Okafor",
    normalizedName: "maya okafor",
    password: "Welcome123!",
    hostel: null,
    roomNumber: null,
    role: "student",
  },
];

const client = new MongoClient(uri);

try {
  await client.connect();
  const database = client.db(process.env.MONGODB_DB || "pau_hms");
  const users = database.collection("users");
  const hostels = database.collection("hostels");
  const menus = database.collection("cafeteriaMenuItems");
  const laundryServices = database.collection("laundryServices");
  await users.createIndex({ normalizedName: 1, hostel: 1 }, { unique: true });
  await users.createIndex(
    { normalizedEmail: 1 },
    { unique: true, partialFilterExpression: { normalizedEmail: { $type: "string" } } },
  );
  await users.createIndex(
    { normalizedMatricNumber: 1 },
    { unique: true, partialFilterExpression: { normalizedMatricNumber: { $type: "string" } } },
  );

  await users.updateOne(
    { normalizedName: "ayomide kareem", hostel: "Emerald" },
    { $set: { hostel: "emerald", roomNumber: "E-204", role: "student" } },
  );

  const now = new Date();
  const allHostels = hostelGroups.flatMap((group) =>
    group.hostels.map((hostel) => ({ ...hostel, gender: group.gender })),
  );
  for (const hostel of allHostels) {
    await hostels.updateOne(
      { _id: hostel.id },
      {
        $set: { name: hostel.name, gender: hostel.gender, active: true, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  const adminCredentials = [];
  const mockAdminHostels = new Set(
    mockUsers.filter((user) => user.role === "admin" && user.hostel).map((user) => user.hostel),
  );
  for (const hostel of allHostels) {
    if (mockAdminHostels.has(hostel.id)) continue;
    const assignedAdmin = await users.findOne({ hostel: hostel.id, role: "admin" });
    if (assignedAdmin) continue;

    const name = `${hostel.name} Admin`;
    const normalizedName = name.toLocaleLowerCase("en");
    const existingAdmin = await users.findOne({ normalizedName, hostel: hostel.id });
    if (existingAdmin) {
      if (existingAdmin.role !== "admin") {
        throw new Error(`Cannot create hostel admin: "${name}" already belongs to a non-admin account.`);
      }
      continue;
    }

    const password = randomBytes(18).toString("base64url");
    await users.insertOne({
      name,
      normalizedName,
      passwordHash: await hashPassword(password),
      hostel: hostel.id,
      roomNumber: null,
      role: "admin",
      createdAt: now,
    });
    adminCredentials.push({ hostel: hostel.name, name, password });
  }

  for (const [hostelId, items] of Object.entries(sampleMenus)) {
    for (const item of items) {
      await menus.updateOne(
        { _id: item.id },
        {
          $setOnInsert: {
            hostelId,
            name: item.name,
            description: item.description,
            category: item.category,
            price: item.price,
            stockAvailable: item.quantityAvailable,
            active: true,
            isSample: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }
  }

  const laundryOptions = [
    { id: "wash-fold", name: "Wash & fold", description: "Wash, dry, and fold one laundry load.", pricePerLoad: 1800 },
    { id: "wash-iron", name: "Wash & iron", description: "Wash, dry, and iron one laundry load.", pricePerLoad: 2500 },
    { id: "dry-clean", name: "Dry cleaning", description: "Dry-clean one standard laundry load.", pricePerLoad: 4000 },
  ];
  for (const hostel of allHostels) {
    for (const option of laundryOptions) {
      const id = `${hostel.id}-${option.id}`;
      await laundryServices.updateOne(
        { _id: id },
        {
          $setOnInsert: {
            hostelId: hostel.id,
            serviceId: option.id,
            name: option.name,
            description: option.description,
            pricePerLoad: option.pricePerLoad,
            active: true,
            isSample: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }
  }

  for (const { password, ...user } of mockUsers) {
    await users.updateOne(
      { normalizedName: user.normalizedName, hostel: user.hostel },
      {
        $set: { ...user, passwordHash: await hashPassword(password) },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  console.log(
    `Seeded ${mockUsers.length} mock users, ${allHostels.length} hostels, ${Object.values(sampleMenus).flat().length} menu items, and ${allHostels.length * laundryOptions.length} sample laundry options in "${database.databaseName}".`,
  );
  if (adminCredentials.length > 0) {
    console.log("New hostel administrator credentials (save these now; passwords are not printed again):");
    for (const credentials of adminCredentials) {
      console.log([credentials.hostel, credentials.name, credentials.password].join(" | "));
    }
  }
} finally {
  await client.close();
}
