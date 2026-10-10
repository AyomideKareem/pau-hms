"use client";

import {
  ArrowLeft,
  Check,
  Clock3,
  MapPin,
  MessageSquareText,
  Minus,
  Plus,
  ShoppingBag,
  Utensils,
  WashingMachine,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatNaira } from "@/lib/cafeteria-menu";
import type { HostelGroup, HostelId } from "@/lib/hostels";
import type {
  CafeteriaOrderDocument,
  ComplaintDocument,
  LaundryRequestDocument,
} from "@/lib/models";

export type HostelService = "cafeteria" | "laundry" | "complaints";

const serviceCopy = {
  cafeteria: {
    title: "Cafeteria",
    intro: "Browse servings and place an order from your chosen hostel.",
    icon: Utensils,
    iconStyle: "bg-amber-50 text-amber-700",
  },
  laundry: {
    title: "Laundry",
    intro: "Choose a hostel and request a laundry pickup.",
    icon: WashingMachine,
    iconStyle: "bg-sky-50 text-sky-700",
  },
  complaints: {
    title: "Hostel complaints",
    intro: "Send feedback to the team responsible for your chosen hostel.",
    icon: MessageSquareText,
    iconStyle: "bg-rose-50 text-rose-700",
  },
} satisfies Record<HostelService, { title: string; intro: string; icon: typeof Utensils; iconStyle: string }>;

const categories = ["All", "Breakfast", "Lunch", "Dinner", "Drinks"] as const;
type MenuCategory = (typeof categories)[number];

interface ApiMenuItem {
  id: string;
  name: string;
  description: string;
  category: Exclude<MenuCategory, "All">;
  price: number;
  stockAvailable: number;
  isSample: boolean;
}

interface ApiLaundryService {
  id: string;
  serviceId: string;
  name: string;
  description: string;
  pricePerLoad: number;
  isSample: boolean;
}

interface ApiOrder extends Omit<CafeteriaOrderDocument, "userId" | "_id" | "createdAt"> {
  id: string;
  createdAt: string;
}

interface ApiLaundryRequest extends Omit<LaundryRequestDocument, "userId" | "_id" | "createdAt"> {
  id: string;
  createdAt: string;
}

interface ApiComplaint extends Omit<ComplaintDocument, "userId" | "_id" | "createdAt"> {
  id: string;
  createdAt: string;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "The request failed. Please try again.";
    throw new Error(message);
  }
  return result as T;
}

function StatusMessage({ children, tone = "success" }: { children: string; tone?: "success" | "error" }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl p-4 text-sm leading-6 ${
        tone === "error" ? "bg-rose-50 text-rose-900" : "bg-emerald-50 text-emerald-900"
      }`}
    >
      {children}
    </p>
  );
}

function HostelPicker({
  groups,
  selected,
  onSelect,
}: {
  groups: HostelGroup[];
  selected: HostelId | null;
  onSelect: (hostel: HostelId) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {groups.map((group) => (
        <section
          key={group.gender}
          aria-labelledby={`hostels-${group.gender.toLowerCase()}`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7538]">
                {group.gender} residences
              </p>
              <h2 id={`hostels-${group.gender.toLowerCase()}`} className="mt-1 text-lg font-semibold text-[#102c56]">
                Select a hostel
              </h2>
            </div>
            <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-xs font-semibold text-slate-500">
              {group.hostels.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.hostels.map((hostel) => {
              const isSelected = selected === hostel.id;
              return (
                <button
                  key={hostel.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(hostel.id)}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition ${
                    isSelected
                      ? "border-[#102c56] bg-[#eef2f8] text-[#102c56] ring-1 ring-[#102c56]/10"
                      : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{hostel.name}</span>
                  {isSelected && <Check size={16} className="shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function CafeteriaMenu({ hostelId }: { hostelId: HostelId }) {
  const [category, setCategory] = useState<MenuCategory>("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ items: ApiMenuItem[] }>(`/api/services/cafeteria?hostelId=${hostelId}`),
      apiRequest<{ orders: ApiOrder[] }>(`/api/services/cafeteria/orders?hostelId=${hostelId}`),
    ])
      .then(([menuResult, orderResult]) => {
        if (active) {
          setItems(menuResult.items);
          setOrders(orderResult.orders);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "The cafeteria menu could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hostelId]);

  const visibleItems = category === "All" ? items : items.filter((item) => item.category === category);
  const cartItems = items.filter((item) => (cart[item.id] ?? 0) > 0);
  const total = cartItems.reduce((sum, item) => sum + item.price * cart[item.id], 0);

  function changeQuantity(id: string, delta: number, max: number) {
    setSuccess("");
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(max, (current[id] ?? 0) + delta)),
    }));
  }

  async function placeOrder() {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest<{ order: ApiOrder }>("/api/services/cafeteria/orders", {
        method: "POST",
        body: JSON.stringify({
          hostelId,
          items: cartItems.map((item) => ({ menuItemId: item.id, quantity: cart[item.id] })),
        }),
      });
      setSuccess(`Order saved (${result.order.id.slice(-6)}). Status: ${result.order.status}.`);
      setCart({});
      const [menuResult, orderResult] = await Promise.all([
        apiRequest<{ items: ApiMenuItem[] }>(`/api/services/cafeteria?hostelId=${hostelId}`),
        apiRequest<{ orders: ApiOrder[] }>(`/api/services/cafeteria/orders?hostelId=${hostelId}`),
      ]);
      setItems(menuResult.items);
      setOrders(orderResult.orders);
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "The order could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading the live menu...</p>;
  }
  if (error && items.length === 0) {
    return <StatusMessage tone="error">{error}</StatusMessage>;
  }

  return (
    <div className="space-y-6">
      {items.some((item) => item.isSample) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950">
          <strong>Sample menu:</strong> dishes, prices, and stock are illustrative development data.
        </div>
      )}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {success && <StatusMessage>{success}</StatusMessage>}

      <div className="flex flex-wrap items-center gap-2" aria-label="Filter menu by meal type">
        {categories.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            aria-pressed={category === option}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              category === option
                ? "bg-[#102c56] text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {visibleItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const quantity = cart[item.id] ?? 0;
            return (
              <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-[#f5f7fb] px-3 py-1 text-xs font-semibold text-slate-600">{item.category}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <ShoppingBag size={14} aria-hidden />
                    {item.stockAvailable - quantity} available
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#102c56]">{item.name}</h3>
                <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{item.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="text-lg font-bold text-[#102c56]">{formatNaira(item.price)}</span>
                  <div className="flex items-center gap-2">
                    {quantity > 0 && (
                      <>
                        <button
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => changeQuantity(item.id, -1, item.stockAvailable)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <Minus size={15} aria-hidden />
                        </button>
                        <span className="min-w-5 text-center text-sm font-semibold">{quantity}</span>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={quantity >= item.stockAvailable}
                      onClick={() => changeQuantity(item.id, 1, item.stockAvailable)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#102c56] px-3 text-sm font-semibold text-white hover:bg-[#193d70] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={15} aria-hidden />
                      Add
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          There are no active menu items for this hostel yet.
        </p>
      )}

      <section className="rounded-2xl border border-[#dce3ef] bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7538]">Your order</p>
          <p className="mt-1 text-lg font-semibold text-[#102c56]">
            {cartItems.length} {cartItems.length === 1 ? "serving" : "servings"} · {formatNaira(total)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Orders are saved as pending. Payment is not enabled.</p>
        </div>
        <button
          type="button"
          disabled={cartItems.length === 0 || submitting}
          onClick={placeOrder}
          className="mt-4 w-full rounded-lg bg-[#102c56] px-5 py-3 text-sm font-semibold text-white hover:bg-[#193d70] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto"
        >
          {submitting ? "Saving order..." : "Place order"}
        </button>
      </section>

      {orders.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-[#102c56]">Recent orders</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</span>
                <span className="font-semibold">{formatNaira(order.total)} · {order.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LaundryRequest({ hostelId }: { hostelId: HostelId }) {
  const [services, setServices] = useState<ApiLaundryService[]>([]);
  const [requests, setRequests] = useState<ApiLaundryRequest[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [loadCount, setLoadCount] = useState("1");
  const [pickupDate, setPickupDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ services: ApiLaundryService[] }>(`/api/services/laundry?hostelId=${hostelId}`),
      apiRequest<{ requests: ApiLaundryRequest[] }>(`/api/services/laundry/requests?hostelId=${hostelId}`),
    ])
      .then(([serviceResult, requestResult]) => {
        if (active) {
          setServices(serviceResult.services);
          setRequests(requestResult.requests);
          setServiceId(serviceResult.services[0]?.serviceId ?? "");
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Laundry services could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hostelId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest<{ request: ApiLaundryRequest }>("/api/services/laundry", {
        method: "POST",
        body: JSON.stringify({ hostelId, serviceId, loadCount: Number(loadCount), pickupDate, notes }),
      });
      setSuccess(`Laundry request saved (${result.request.id.slice(-6)}). Status: ${result.request.status}.`);
      setNotes("");
      const requestResult = await apiRequest<{ requests: ApiLaundryRequest[] }>(
        `/api/services/laundry/requests?hostelId=${hostelId}`,
      );
      setRequests(requestResult.requests);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The laundry request could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading laundry services...</p>;
  if (error && services.length === 0) return <StatusMessage tone="error">{error}</StatusMessage>;

  const selectedService = services.find((service) => service.serviceId === serviceId);
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Laundry prices are sample estimates and payment is not enabled.
      </div>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {success && <StatusMessage>{success}</StatusMessage>}
      {services.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No laundry options are active for this hostel.</p>
      ) : (
        <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-start gap-3 rounded-xl bg-sky-50 p-4 text-sm leading-5 text-sky-950">
            <Clock3 size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>Choose a service and preferred pickup date. Your request will be stored with pending status.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Laundry service
              <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                {services.map((service) => (
                  <option key={service.id} value={service.serviceId}>
                    {service.name} · {formatNaira(service.pricePerLoad)}/load
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Number of loads
              <input required type="number" min="1" max="10" value={loadCount} onChange={(event) => setLoadCount(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3.5 py-3" />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Preferred pickup date
              <input required type="date" min={new Date().toISOString().slice(0, 10)} value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3.5 py-3" />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Pickup notes <span className="font-normal text-slate-400">(optional)</span>
              <textarea rows={3} maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a pickup note..." className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3.5 py-3" />
            </label>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#102c56]">
            Estimated total: {formatNaira((selectedService?.pricePerLoad ?? 0) * Number(loadCount || 0))}
          </p>
          <button type="submit" disabled={submitting} className="mt-5 rounded-lg bg-[#102c56] px-5 py-3 text-sm font-semibold text-white hover:bg-[#193d70] disabled:opacity-60">
            {submitting ? "Saving request..." : "Request laundry pickup"}
          </button>
        </form>
      )}
      {requests.length > 0 && (
        <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-[#102c56]">Your recent laundry requests</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{request.serviceName} · {request.loadCount} {request.loadCount === 1 ? "load" : "loads"} · {request.pickupDate}</span>
                <span className="font-semibold">{request.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ComplaintForm({ hostelId }: { hostelId: HostelId }) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<{ complaints: ApiComplaint[] }>(`/api/services/complaints?hostelId=${hostelId}`)
      .then((result) => {
        if (active) setComplaints(result.complaints);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Your complaints could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hostelId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest<{ complaint: ApiComplaint }>("/api/services/complaints", {
        method: "POST",
        body: JSON.stringify({ hostelId, category, subject, details }),
      });
      setSuccess(`Complaint saved (${result.complaint.id.slice(-6)}). Status: ${result.complaint.status}.`);
      setSubject("");
      setDetails("");
      const history = await apiRequest<{ complaints: ApiComplaint[] }>(
        `/api/services/complaints?hostelId=${hostelId}`,
      );
      setComplaints(history.complaints);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The complaint could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-5 text-rose-950">
        Your complaint will be linked to this hostel. Do not use this form for emergency reports.
      </div>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {success && <StatusMessage>{success}</StatusMessage>}
      <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="mb-5 text-xs font-semibold text-slate-500">Describe the issue so the hostel team can follow up.</p>
        <div className="space-y-5">
          <label className="block text-sm font-medium text-slate-700">
            Complaint type
            <select required value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <option value="">Choose a category</option>
              <option value="maintenance">Room maintenance</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="noise">Noise</option>
              <option value="safety">Safety or security</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Subject
            <input required minLength={4} maxLength={100} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Briefly describe the issue" className="mt-2 w-full rounded-lg border border-slate-200 px-3.5 py-3" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Details
            <textarea required minLength={10} maxLength={2000} rows={5} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Tell us what happened and where..." className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3.5 py-3" />
            <span className="mt-1 block text-right text-xs font-normal text-slate-400">{details.length}/2000</span>
          </label>
        </div>
        <button type="submit" disabled={submitting} className="mt-5 rounded-lg bg-[#102c56] px-5 py-3 text-sm font-semibold text-white hover:bg-[#193d70] disabled:opacity-60">
          {submitting ? "Saving complaint..." : "Submit complaint"}
        </button>
      </form>
      {!loading && complaints.length > 0 && (
        <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-[#102c56]">Your complaints for this hostel</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {complaints.map((complaint) => (
              <li key={complaint.id} className="py-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">{complaint.subject}</span>
                  <span className="font-semibold">{complaint.status.replace("_", " ")}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{complaint.category} · {new Date(complaint.createdAt).toLocaleDateString()}</p>
                <p className="mt-2 text-sm leading-5 text-slate-600">{complaint.details}</p>
                {complaint.adminResponse && (
                  <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm leading-5 text-blue-950">
                    <span className="font-semibold">Hostel response: </span>
                    {complaint.adminResponse}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ServiceWorkspace({ service }: { service: HostelService }) {
  const [groups, setGroups] = useState<HostelGroup[]>([]);
  const [hostelId, setHostelId] = useState<HostelId | null>(null);
  const [hostelError, setHostelError] = useState("");
  const [loadingHostels, setLoadingHostels] = useState(true);
  const copy = serviceCopy[service];
  const Icon = copy.icon;
  const selectedHostel = groups.flatMap((group) => group.hostels).find((hostel) => hostel.id === hostelId);
  const selectedHostelId = selectedHostel?.id;

  useEffect(() => {
    let active = true;
    apiRequest<{ hostels: HostelGroup[] }>("/api/hostels")
      .then((result) => {
        if (active) setGroups(result.hostels);
      })
      .catch((loadError: unknown) => {
        if (active) setHostelError(loadError instanceof Error ? loadError.message : "Hostels could not be loaded.");
      })
      .finally(() => {
        if (active) setLoadingHostels(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#102c56]">
        <ArrowLeft size={16} aria-hidden />
        Back to dashboard
      </Link>
      <div className="mb-7 flex items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${copy.iconStyle}`}>
          <Icon size={23} aria-hidden />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7538]">Student service</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#102c56] sm:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{copy.intro}</p>
        </div>
      </div>
      {selectedHostel && selectedHostelId ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce3ef] bg-white px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2f8] text-[#102c56]">
                <MapPin size={17} aria-hidden />
              </span>
              <div>
                <p className="text-xs text-slate-500">Selected hostel</p>
                <p className="text-sm font-semibold text-[#102c56]">{selectedHostel.name}</p>
              </div>
            </div>
            <button type="button" onClick={() => setHostelId(null)} className="text-sm font-semibold text-[#102c56] hover:underline">
              Change hostel
            </button>
          </div>
          {service === "cafeteria" && <CafeteriaMenu key={selectedHostelId} hostelId={selectedHostelId} />}
          {service === "laundry" && <LaundryRequest key={selectedHostelId} hostelId={selectedHostelId} />}
          {service === "complaints" && <ComplaintForm key={selectedHostelId} hostelId={selectedHostelId} />}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-[#dce3ef] bg-white p-4 text-sm leading-5 text-slate-600">
            <MapPin size={18} className="mt-0.5 shrink-0 text-[#9a7538]" aria-hidden />
            <p>
              {service === "cafeteria"
                ? "Choose which hostel cafeteria you want to view. Menus and serving counts differ by hostel."
                : service === "laundry"
                  ? "Choose the hostel where you want laundry service."
                  : "Choose the hostel your feedback is about."}
            </p>
          </div>
          {loadingHostels ? (
            <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading hostel list...</p>
          ) : hostelError ? (
            <StatusMessage tone="error">{hostelError}</StatusMessage>
          ) : (
            <HostelPicker groups={groups} selected={hostelId} onSelect={setHostelId} />
          )}
        </div>
      )}
      <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
        Pan-Atlantic University · Student Hostel Portal
      </footer>
    </div>
  );
}
