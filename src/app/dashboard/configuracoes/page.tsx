import { redirect } from "next/navigation";
import { requireHotelAdminSession } from "@/lib/auth";
import { getTenantSettings } from "@/actions/settings";
import { getWhatsAppConnection } from "@/actions/whatsapp";
import { listHotelStaff } from "@/actions/team";
import { getAccountProfile } from "@/actions/auth";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getAppUrl } from "@/lib/app-url";

export default async function SettingsPage() {
  try {
    await requireHotelAdminSession();
  } catch {
    redirect("/dashboard");
  }

  const [settings, connection, staff, profile] = await Promise.all([
    getTenantSettings(),
    getWhatsAppConnection(),
    listHotelStaff(),
    getAccountProfile(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Abra cada item para ajustar. Tudo aqui vale para a agenda do cliente e
          para o dia a dia do hotel.
        </p>
      </div>
      <SettingsForm
        initial={{
          ...settings,
          webhookUrl: `${getAppUrl()}/api/webhooks/mercadopago`,
        }}
        whatsapp={{
          connected: connection.connected,
          number: connection.number,
          instanceName: connection.instanceName,
        }}
        staff={staff}
        accountEmail={profile.email}
      />
    </div>
  );
}
