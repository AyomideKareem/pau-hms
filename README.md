# PAU Hostel Management System

## MongoDB Atlas setup

The application and seed script connect to MongoDB through the MongoDB Node.js
driver. Configure both to use the same Atlas cluster and database:

1. Create an Atlas cluster and a **database user** with access to the `pau_hms`
   database. This is separate from your MongoDB Atlas website login.
2. In Atlas Network Access, allow connections from your development machine
   and from the application deployment environment. Prefer specific egress IPs
   where your hosting provider supports them; avoid broad access where
   possible.
3. Copy the Atlas **Drivers** connection string (`mongodb+srv://...`) into
   `.env.local` as `MONGODB_URI`. Replace the username, password, and cluster
   placeholders. URL-encode special characters in the database user's
   password.
4. Keep `MONGODB_DB=pau_hms` and set a unique `SESSION_SECRET` of at least 32
   bytes. Configure these values as server-side environment variables in the
   deployment platform too; never prefix them with `NEXT_PUBLIC_` or commit
   real credentials.
5. Run `pnpm seed` with the same environment variables to initialize the
   hostels and sample data in Atlas.

The app reuses its MongoDB client across requests, creates the required
indexes, and initializes demo room inventory in the configured database.
Deployments do not require a MongoDB server running on the application host.

## Login backend (development)

Students can create an account with a username, matric number, and password;
email is optional. During sign-up they can choose an available hostel, room,
and room capacity, then complete a simulated payment. If they skip room
selection or no rooms are available, the account is created without a hostel
assignment. Demo room inventory is configured in
`lib/demo-hostel-inventory.ts` and persisted in `hostelRoomInventory`. Login
accepts the username or email and password. Passwords are stored as scrypt
hashes. Successful login sets a signed, HTTP-only, seven-day session cookie;
`/api/auth/session` returns the current user and accepts `DELETE` to log out.
The home page requires a valid session and shows room details when assigned.

1. Copy `.env.example` to `.env.local` and replace the Atlas connection-string
   placeholders. Set `SESSION_SECRET` to a unique random value of at least 32
   bytes (for example, generate one with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`).
2. Install dependencies with `pnpm install`.
3. Add mock login accounts using `pnpm seed`.
4. Start the app using `pnpm dev`.

Mock credentials (development only):

| Name | Password | Hostel |
| --- | --- | --- |
| Mr. Patrick | `Welcome123!` | Amethyst |
| Daniel Samuel | `Welcome123!` | Faith |
| Ayomide Kareem | `!Ayomide` | Emerald Hall · Room E-204 |
| Maya Okafor | `Welcome123!` | Not assigned |

Student sign-up is available at `/signup`. The hostel list and gender grouping
are shared by sign-up, the service pages, and MongoDB seeding. The hostel room
list and capacity options are demonstration data and must be replaced with
approved inventory before launch. Accommodation payment is simulated and is
not a real charge.

Service data is defined in `lib/models.ts` and persisted in these collections:

| Collection | Purpose |
| --- | --- |
| `users` | Student and hostel-admin profiles, credentials, roles, and hostel/room assignment |
| `hostels` | Active residences and gender grouping |
| `hostelRoomInventory` | Demo room capacities and atomic room-space reservations |
| `cafeteriaMenuItems` | Hostel-specific menu, price, and available stock |
| `cafeteriaOrders` | Student orders with price snapshots and order status |
| `laundryServices` | Hostel-specific laundry options and sample prices |
| `laundryRequests` | Student pickup requests and request status |
| `complaints` | Hostel-specific student complaints and status |

The cafeteria, laundry, and complaint pages submit records to authenticated API
routes. Cafeteria orders atomically reserve menu stock per item and are saved as
pending; payments are not enabled. Laundry prices and cafeteria menus are sample
data. Replace them with approved information before launch. `pnpm seed` upserts
the hostel list, sample menu from `data/sample-menus.json`, laundry options, and
mock users. It does not reset existing menu stock or delete requests, orders, or
complaints. Re-running the seed also preserves administrator changes to menu
items, cafeteria prices, and laundry service pricing/availability.

Each hostel has its own administrator account. Run `pnpm seed` and save the
newly generated credentials printed for hostels without an existing admin;
each new password is random, hashed before storage, and shown only when that
account is first created. Amethyst's and Faith's existing development
administrators are Mr. Patrick and Daniel Samuel, respectively (listed above).
Sign in using the administrator name and password.
Administrators are restricted to records for their assigned hostel and can add,
edit, price, stock, or disable cafeteria items; process cafeteria orders; edit
laundry prices and availability; process laundry requests; and update complaint
status and response notes. The admin portal is at `/admin`; administrator
accounts cannot be created through student sign-up. For lost credentials,
reset the relevant admin password directly through a secure database/admin
operation rather than creating public admin registration.

Room assignment is represented by `hostel`, `roomNumber`, and `roomCapacity`.
Students without an available room retain a `null` hostel and room assignment.

The MongoDB client is reused across requests and uses the driver's default
connection-pool settings. Monitor server connection counts and request
concurrency in the deployment environment before tuning the pool.