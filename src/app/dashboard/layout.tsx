import { redirect } from "next/navigation";
import { getSession, requireStaffSession } from "@/lib/auth";
import { BillingGate } from "@/components/dashboard/billing-gate";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { getBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session?.role === "MASTER") {
    redirect("/admin");
  }

  try {
    const { user } = await requireStaffSession();
    const userCount = await prisma.user.count({
      where: { tenantId: user.tenant.id },
    });
    const billing = getBillingState(
      user.tenant.createdAt,
      userCount,
      user.tenant.billingPaidUntil,
    );
    return (
      <DashboardSidebar
        tenantName={user.tenant.name}
        role={user.role}
        billingLabel={billing.menuLabel}
        billingExpired={billing.isExpired}
      >
        <BillingGate expired={billing.isExpired}>{children}</BillingGate>
      </DashboardSidebar>
    );
  } catch {
    redirect("/login");
  }
}
