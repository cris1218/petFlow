import { getAccountProfile } from "@/actions/auth";
import { getPlatformMpSettings } from "@/actions/platform";
import { AccountForm } from "@/components/account-form";
import { PlatformMpForm } from "@/components/admin/platform-mp-form";

export default async function AdminAccountPage() {
  const [profile, mp] = await Promise.all([
    getAccountProfile(),
    getPlatformMpSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Minha conta</h1>
        <p className="text-sm text-muted-foreground">
          Altere o e-mail e a senha do master {profile.name}. Configure também
          a conta Mercado Pago que recebe o PIX dos planos.
        </p>
      </div>
      <PlatformMpForm
        pixConfigured={mp.pixConfigured}
        webhookUrl={mp.webhookUrl}
      />
      <AccountForm email={profile.email} />
    </div>
  );
}
