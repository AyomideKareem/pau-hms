"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { getHostelName } from "@/lib/hostels";
import type { MenuCategory } from "@/lib/models";

type Tab = "cafeteria" | "laundry" | "complaints";
type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  stockAvailable: number;
  active: boolean;
  isSample: boolean;
};
type Order = {
  id: string;
  studentName: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  total: number;
  status: string;
  createdAt: string;
};
type LaundryService = {
  id: string;
  name: string;
  description: string;
  pricePerLoad: number;
  active: boolean;
};
type LaundryRequest = {
  id: string;
  studentName: string;
  serviceName: string;
  loadCount: number;
  total: number;
  pickupDate: string;
  notes: string;
  status: string;
};
type Complaint = {
  id: string;
  studentName: string;
  category: string;
  subject: string;
  details: string;
  status: string;
  adminResponse?: string;
  createdAt: string;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "cafeteria", label: "Cafeteria & orders" },
  { id: "laundry", label: "Laundry & requests" },
  { id: "complaints", label: "Complaints" },
];
const menuCategories: MenuCategory[] = ["Breakfast", "Lunch", "Dinner", "Drinks"];
const nextOrderStatuses: Record<string, string[]> = {
  pending: ["pending", "preparing"],
  preparing: ["preparing", "ready"],
  ready: ["ready", "collected"],
  collected: ["collected"],
  cancelled: ["cancelled"],
};
const nextRequestStatuses: Record<string, string[]> = {
  pending: ["pending", "accepted", "cancelled"],
  accepted: ["accepted", "collected", "cancelled"],
  collected: ["collected", "processing", "cancelled"],
  processing: ["processing", "ready", "cancelled"],
  ready: ["ready", "completed"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};
const complaintStatuses = ["open", "in_review", "resolved", "closed"];
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#102c56] focus:ring-2 focus:ring-blue-100";
const buttonClass = "rounded-lg bg-[#102c56] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#183d70] disabled:opacity-60";

async function fetchAdminData() {
  const [cafeteriaResponse, laundryResponse, complaintsResponse] = await Promise.all([
    fetch("/api/admin/cafeteria", { cache: "no-store" }),
    fetch("/api/admin/laundry", { cache: "no-store" }),
    fetch("/api/admin/complaints", { cache: "no-store" }),
  ]);
  const [cafeteria, laundry, complaintData] = await Promise.all([
    cafeteriaResponse.json(),
    laundryResponse.json(),
    complaintsResponse.json(),
  ]);
  for (const [response, data] of [
    [cafeteriaResponse, cafeteria],
    [laundryResponse, laundry],
    [complaintsResponse, complaintData],
  ] as const) {
    if (!response.ok) throw new Error(data.error ?? "Unable to load hostel management data.");
  }
  return {
    items: cafeteria.items as MenuItem[],
    orders: cafeteria.orders as Order[],
    laundryServices: laundry.services as LaundryService[],
    laundryRequests: laundry.requests as LaundryRequest[],
    complaints: complaintData.complaints as Complaint[],
  };
}

function formatPrice(price: number) {
  return `₦${price.toLocaleString("en-NG")}`;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#102c56]">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AdminWorkspace({ hostelId }: { hostelId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("cafeteria");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [laundryServices, setLaundryServices] = useState<LaundryService[]>([]);
  const [laundryRequests, setLaundryRequests] = useState<LaundryRequest[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const applyData = useCallback((data: Awaited<ReturnType<typeof fetchAdminData>>) => {
    setItems(data.items);
    setOrders(data.orders);
    setLaundryServices(data.laundryServices);
    setLaundryRequests(data.laundryRequests);
    setComplaints(data.complaints);
  }, []);

  const loadData = useCallback(async () => {
    try {
      applyData(await fetchAdminData());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load hostel management data.");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    let active = true;
    fetchAdminData()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load hostel management data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyData]);

  async function save(endpoint: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save this change.");
      await loadData();
      setNotice("Changes saved to the database.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this change.");
    } finally {
      setSaving(false);
    }
  }

  function submitItem(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category") ?? ""),
      price: Number(form.get("price")),
      stockAvailable: Number(form.get("stockAvailable")),
      ...(id ? { type: "item", id, active: form.get("active") === "on" } : {}),
    };
    void save("/api/admin/cafeteria", id ? "PATCH" : "POST", body);
  }

  function submitLaundry(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save("/api/admin/laundry", "PATCH", {
      type: "service",
      id,
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      pricePerLoad: Number(form.get("pricePerLoad")),
      active: form.get("active") === "on",
    });
  }

  function submitComplaint(event: FormEvent<HTMLFormElement>, complaint: Complaint) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save("/api/admin/complaints", "PATCH", {
      id: complaint.id,
      status: String(form.get("status") ?? ""),
      adminResponse: String(form.get("adminResponse") ?? ""),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <section className="rounded-3xl bg-[#102c56] px-6 py-7 text-white shadow-lg sm:px-9">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Hostel administration</p>
        <h1 className="mt-2 text-3xl font-semibold">{getHostelName(hostelId) ?? "Hostel"} dashboard</h1>
        <p className="mt-2 text-sm text-blue-100">Manage this hostel&apos;s menu, prices, available quantities, laundry, orders, and student complaints.</p>
      </section>

      <nav aria-label="Administration sections" className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === tab.id ? "border-[#d1aa62] text-[#102c56]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading hostel records…</p>
      ) : (
        <div className="mt-6 space-y-6">
          {activeTab === "cafeteria" && (
            <>
              <Section title="Menu and stock" description="Prices are in naira. Stock updates immediately affect student ordering.">
                <form onSubmit={(event) => submitItem(event)} className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-6">
                  <input name="name" required minLength={2} maxLength={100} placeholder="Food or drink name" className={`${inputClass} md:col-span-2`} />
                  <select name="category" required className={inputClass}>{menuCategories.map((category) => <option key={category}>{category}</option>)}</select>
                  <input name="price" type="number" min="0" step="1" required placeholder="Price (₦)" className={inputClass} />
                  <input name="stockAvailable" type="number" min="0" step="1" required placeholder="Quantity" className={inputClass} />
                  <button className={buttonClass} disabled={saving}>Add item</button>
                  <input name="description" maxLength={500} placeholder="Description (optional)" className={`${inputClass} md:col-span-5`} />
                </form>
                {items.length === 0 ? <p className="text-sm text-slate-500">No menu items yet.</p> : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <form key={item.id} onSubmit={(event) => submitItem(event, item.id)} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-6">
                        <input name="name" required minLength={2} maxLength={100} defaultValue={item.name} className={`${inputClass} md:col-span-2`} />
                        <select name="category" defaultValue={item.category} className={inputClass}>{menuCategories.map((category) => <option key={category}>{category}</option>)}</select>
                        <input name="price" type="number" min="0" step="1" required defaultValue={item.price} className={inputClass} aria-label="Price in naira" />
                        <input name="stockAvailable" type="number" min="0" step="1" required defaultValue={item.stockAvailable} className={inputClass} aria-label="Available quantity" />
                        <label className="flex items-center gap-2 text-sm text-slate-600"><input name="active" type="checkbox" defaultChecked={item.active} /> Available</label>
                        <input name="description" maxLength={500} defaultValue={item.description} className={`${inputClass} md:col-span-5`} aria-label="Description" />
                        <div className="flex items-center justify-between gap-2 md:col-span-6">
                          <span className="text-xs text-slate-500">{item.isSample ? "Sample item" : "Hostel item"} · {formatPrice(item.price)}</span>
                          <button className={buttonClass} disabled={saving}>Save item</button>
                        </div>
                      </form>
                    ))}
                  </div>
                )}
              </Section>
              <Section title="Recent cafeteria orders" description="Update the preparation and collection status for orders placed at your hostel.">
                <div className="space-y-3">
                  {orders.length === 0 && <p className="text-sm text-slate-500">No orders yet.</p>}
                  {orders.map((order) => (
                    <div key={order.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-slate-800">{order.studentName} <span className="font-normal text-slate-500">· {formatPrice(order.total)}</span></p>
                        <p className="mt-1 text-sm text-slate-600">{order.items.map((line) => `${line.name} × ${line.quantity}`).join(", ")}</p>
                      </div>
                      <select aria-label={`Status for order by ${order.studentName}`} value={order.status} onChange={(event) => void save("/api/admin/cafeteria", "PATCH", { type: "order", id: order.id, status: event.target.value })} className={`${inputClass} sm:w-44`} disabled={saving}>
                        {(nextOrderStatuses[order.status] ?? [order.status]).map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {activeTab === "laundry" && (
            <>
              <Section title="Laundry services and prices" description="Edit the per-load charge or disable a service to hide it from student ordering.">
                <div className="space-y-4">
                  {laundryServices.map((service) => (
                    <form key={service.id} onSubmit={(event) => submitLaundry(event, service.id)} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-5">
                      <input name="name" required minLength={2} maxLength={100} defaultValue={service.name} className={`${inputClass} md:col-span-2`} />
                      <input name="pricePerLoad" type="number" min="0" step="1" required defaultValue={service.pricePerLoad} className={inputClass} aria-label="Price per load in naira" />
                      <label className="flex items-center gap-2 text-sm text-slate-600"><input name="active" type="checkbox" defaultChecked={service.active} /> Available</label>
                      <button className={buttonClass} disabled={saving}>Save service</button>
                      <input name="description" maxLength={500} defaultValue={service.description} className={`${inputClass} md:col-span-4`} aria-label="Description" />
                    </form>
                  ))}
                  {laundryServices.length === 0 && <p className="text-sm text-slate-500">No laundry services have been seeded.</p>}
                </div>
              </Section>
              <Section title="Laundry requests" description="Process pickup requests and keep students informed of their request status.">
                <div className="space-y-3">
                  {laundryRequests.length === 0 && <p className="text-sm text-slate-500">No laundry requests yet.</p>}
                  {laundryRequests.map((laundryRequest) => (
                    <div key={laundryRequest.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-slate-800">{laundryRequest.studentName} · {laundryRequest.serviceName}</p>
                        <p className="mt-1 text-sm text-slate-600">{laundryRequest.loadCount} load(s) · {formatPrice(laundryRequest.total)} · Pickup {laundryRequest.pickupDate}</p>
                        {laundryRequest.notes && <p className="mt-1 text-sm text-slate-500">{laundryRequest.notes}</p>}
                      </div>
                      <select aria-label={`Status for laundry request by ${laundryRequest.studentName}`} value={laundryRequest.status} onChange={(event) => void save("/api/admin/laundry", "PATCH", { type: "request", id: laundryRequest.id, status: event.target.value })} className={`${inputClass} sm:w-44`} disabled={saving}>
                        {(nextRequestStatuses[laundryRequest.status] ?? [laundryRequest.status]).map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {activeTab === "complaints" && (
            <Section title="Student complaints" description="Review hostel complaints, update status, and send a response that is saved with the complaint.">
              <div className="space-y-4">
                {complaints.length === 0 && <p className="text-sm text-slate-500">No complaints yet.</p>}
                {complaints.map((complaint) => (
                  <form key={complaint.id} onSubmit={(event) => submitComplaint(event, complaint)} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{complaint.subject}</h3>
                        <p className="mt-1 text-xs text-slate-500">{complaint.studentName} · {complaint.category} · {new Date(complaint.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{complaint.status.replace("_", " ")}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{complaint.details}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr_auto]">
                      <select name="status" defaultValue={complaint.status} className={inputClass}>
                        {complaintStatuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                      </select>
                      <textarea name="adminResponse" maxLength={2000} defaultValue={complaint.adminResponse ?? ""} placeholder="Response or resolution note for the student" className={`${inputClass} min-h-11`} />
                      <button className={buttonClass} disabled={saving}>Save response</button>
                    </div>
                  </form>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
