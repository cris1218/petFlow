import { getWhatsAppConnection } from "@/actions/whatsapp";
import { WhatsAppQrCard } from "@/components/dashboard/whatsapp-qr";

export default async function WhatsAppPage() {
  const connection = await getWhatsAppConnection();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp do hotel</h1>
        <p className="text-sm text-muted-foreground">
          Pareie o número do estabelecimento com a Evolution API (Baileys).
        </p>
      </div>
      <WhatsAppQrCard
        connected={connection.connected}
        number={connection.number}
        instanceName={connection.instanceName}
      />
    </div>
  );
}
