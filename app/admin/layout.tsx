import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import PortalShell from "@/components/PortalShell";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  if (!user.hostel) redirect("/login");

  return <PortalShell user={user}>{children}</PortalShell>;
}
