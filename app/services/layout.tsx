import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import PortalShell from "@/components/PortalShell";
import { getCurrentUser } from "@/lib/auth";

export default async function ServicesLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role === "admin") {
    redirect("/admin");
  }

  return <PortalShell user={user}>{children}</PortalShell>;
}
