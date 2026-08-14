import { getHotelBillingOverview } from "@/actions/billing";
import { PlanPix } from "@/components/dashboard/plan-pix";

export default async function PlanPage() {
  const overview = await getHotelBillingOverview();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Plano</h1>
        <p className="text-sm text-muted-foreground">
          Pague o PIX do valor atual para continuar usando o PetFlow. Cada
          pagamento confirmado libera mais 30 dias.
        </p>
      </div>
      <PlanPix
        hotelName={overview.hotelName}
        pixConfigured={overview.pixConfigured}
        isExpired={overview.billing.isExpired}
        phaseLabel={overview.billing.phaseLabel}
        priceLabel={overview.billing.priceLabel}
        expiresLabel={overview.billing.expiresLabel}
        pixAmount={overview.billing.pixAmount}
        extraUsers={overview.billing.extraUsers}
        extraTotal={overview.billing.extraTotal}
        pending={overview.pending}
      />
    </div>
  );
}
