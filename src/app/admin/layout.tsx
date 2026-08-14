import { redirect } from "next/navigation";
import { requireMasterSession } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const { user } = await requireMasterSession();
    return (
      <AdminSidebar masterName={user.name}>{children}</AdminSidebar>
    );
  } catch {
    redirect("/login");
  }
}
