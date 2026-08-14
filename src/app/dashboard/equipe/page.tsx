import { redirect } from "next/navigation";
import { requireHotelAdminSession } from "@/lib/auth";
import { listHotelStaff } from "@/actions/team";
import { CreateStaffForm } from "@/components/dashboard/staff-form";
import { StaffList } from "@/components/dashboard/staff-list";

export default async function HotelTeamPage() {
  try {
    await requireHotelAdminSession();
  } catch {
    redirect("/dashboard");
  }

  const users = await listHotelStaff();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          O cadastro inicial inclui 1 gestor. Cada login extra da equipe adiciona{" "}
          R$ 9,90 no plano.
        </p>
      </div>
      <CreateStaffForm />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Usuários da equipe</h2>
        <StaffList users={users} />
      </div>
    </div>
  );
}
