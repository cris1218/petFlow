import { getAccountProfile } from "@/actions/auth";
import { AccountForm } from "@/components/account-form";

export default async function DashboardAccountPage() {
  const profile = await getAccountProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Minha conta</h1>
        <p className="text-sm text-muted-foreground">
          Altere o e-mail e a senha de {profile.name}.
        </p>
      </div>
      <AccountForm email={profile.email} />
    </div>
  );
}
