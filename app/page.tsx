import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  MessageSquareText,
  Utensils,
  WashingMachine,
} from "lucide-react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { getCurrentUser } from "@/lib/auth";
import { getHostelName } from "@/lib/hostels";

const services = [
  {
    name: "Cafeteria",
    description: "Find dining information and campus meal updates.",
    status: "Choose a hostel · Browse sample menu",
    href: "/services/cafeteria",
    icon: Utensils,
    iconStyle: "bg-amber-50 text-amber-700",
  },
  {
    name: "Laundry",
    description: "Select a hostel and preview a laundry pickup request.",
    status: "Choose a hostel · Laundry request",
    href: "/services/laundry",
    icon: WashingMachine,
    iconStyle: "bg-sky-50 text-sky-700",
  },
  {
    name: "Complaints",
    description: "Choose the hostel your feedback is about and prepare a complaint.",
    status: "Choose a hostel · Send feedback",
    href: "/services/complaints",
    icon: MessageSquareText,
    iconStyle: "bg-rose-50 text-rose-700",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role === "admin") {
    redirect("/admin");
  }

  const isAssigned = Boolean(user.hostel && user.roomNumber);
  const hostelName = getHostelName(user.hostel);

  return (
    <PortalShell user={user}>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="relative isolate overflow-hidden rounded-3xl bg-[#102c56] px-6 py-8 text-white shadow-xl shadow-blue-950/10 sm:px-10 sm:py-10">
          <div aria-hidden className="absolute -right-14 -top-32 -z-10 h-80 w-80 rounded-full border-[42px] border-white/[0.06]" />
          <div aria-hidden className="absolute -bottom-36 right-36 -z-10 h-64 w-64 rounded-full bg-[#d1aa62]/20 blur-3xl" />
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-blue-100">
              YOUR CAMPUS, ONE PLACE
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome, {user.name.split(/\s+/)[0]}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Quick access to the services and information you need during your stay at PAU.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-inset ring-white/15">
              <span className={`h-2 w-2 rounded-full ${isAssigned ? "bg-emerald-400" : "bg-amber-300"}`} />
              {isAssigned ? `${hostelName} · Room ${user.roomNumber}` : "Hostel room not assigned"}
            </div>
            {!isAssigned && (
              <span className="text-xs text-blue-100">
                Your room details will appear here once assigned by the hostel office.
              </span>
            )}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="services-title">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7538]">
                Student services
              </p>
              <h2 id="services-title" className="mt-1 text-2xl font-semibold tracking-tight text-[#102c56]">
                What do you need today?
              </h2>
            </div>
            <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <Bell size={16} aria-hidden />
              More services will be added here
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.map(({ name, description, status, href, icon: Icon, iconStyle }) => (
              <Link
                href={href}
                key={name}
                className="group flex min-h-56 flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-950/[0.02] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102c56]"
              >
                <div className="flex items-start justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconStyle}`}>
                    <Icon size={23} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-[#102c56] group-hover:bg-[#102c56] group-hover:text-white">
                    <ArrowUpRight size={17} aria-hidden />
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-[#102c56]">{name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs font-medium text-slate-500">{status}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#102c56]">
                    Open service <ChevronRight size={14} aria-hidden />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          Pan-Atlantic University · Student Hostel Portal
        </footer>
      </div>
    </PortalShell>
  );
}
