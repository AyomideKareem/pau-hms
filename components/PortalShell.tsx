import Image from "next/image";
import Link from "next/link";
import { Utensils, WashingMachine, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/auth";
import { getHostelName } from "@/lib/hostels";
import LogoutButton from "@/components/LogoutButton";

const navigation = [
  { href: "/", label: "Dashboard", icon: null },
  { href: "/services/cafeteria", label: "Cafeteria", icon: Utensils },
  { href: "/services/laundry", label: "Laundry", icon: WashingMachine },
  { href: "/services/complaints", label: "Complaints", icon: MessageSquareText },
];

export default function PortalShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  const hostelName = getHostelName(user.hostel);
  const userNavigation = user.role === "admin"
    ? [{ href: "/admin", label: "Hostel management", icon: null }]
    : navigation;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/pau-logo2.png"
              alt="PAU"
              width={48}
              height={48}
              className="h-11 w-11 object-contain"
              priority
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-wide text-[#102c56]">
                PAN-ATLANTIC UNIVERSITY
              </span>
              <span className="block text-xs text-slate-500">Student Hostel Portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="min-w-0 max-w-36 text-left sm:max-w-52 sm:text-right">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-slate-500">
                {user.role === "admin" && hostelName
                  ? `${hostelName} administrator`
                  : hostelName && user.roomNumber
                  ? `${hostelName} · Room ${user.roomNumber}`
                  : "Room assignment pending"}
              </p>
            </div>
            <div
              aria-label={`${user.name} profile`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eef8] text-sm font-bold text-[#102c56]"
            >
              {initials}
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav aria-label={user.role === "admin" ? "Hostel management" : "Student services"} className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 sm:px-8">
          {userNavigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-[#d1aa62] hover:text-[#102c56]"
            >
              {Icon && <Icon size={16} aria-hidden />}
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {children}
    </main>
  );
}
