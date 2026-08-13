import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const { user } = await requireStaffSession();
    return (
      <div className="flex min-h-screen">
        <DashboardSidebar
          tenantName={user.tenant.name}
          showLeads={isPlatformAdmin(user.email)}
        />
        <main className="flex-1 bg-muted/30 p-6 lg:p-8">{children}</main>
      </div>
    );
  } catch {
    redirect("/login");
  }
}
