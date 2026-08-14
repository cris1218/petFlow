import { redirect } from "next/navigation";
import { requireHotelAdminSession } from "@/lib/auth";
import { getTenantSettings } from "@/actions/settings";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getAppUrl } from "@/lib/app-url";

export default async function SettingsPage() {
  try {
    await requireHotelAdminSession();
  } catch {
    redirect("/dashboard");
  }

  const settings = await getTenantSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Logo, serviços, WhatsApp e Mercado Pago da conta do hotel.
        </p>
      </div>
      <SettingsForm
        initial={{
          ...settings,
          webhookUrl: `${getAppUrl()}/api/webhooks/mercadopago`,
        }}
      />
    </div>
  );
}
