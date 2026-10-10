import AdminWorkspace from "@/components/AdminWorkspace";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.hostel) redirect("/login");
  return <AdminWorkspace hostelId={user.hostel} />;
}
