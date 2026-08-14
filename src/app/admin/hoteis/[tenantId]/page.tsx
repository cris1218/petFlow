import Link from "next/link";
import { notFound } from "next/navigation";
import { getHotelUsers } from "@/actions/admin";
import { HotelUsersList } from "@/components/admin/hotel-users-list";
import { Button } from "@/components/ui/button";

export default async function HotelUsersPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const result = await getHotelUsers(params.tenantId);
  if (!result.ok) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Voltar aos hotéis</Link>
        </Button>
        <h1 className="mt-4 text-xl font-semibold sm:text-2xl">{result.tenant.name}</h1>
        <p className="text-sm text-muted-foreground">
          Usuários do hotel · portal /agendar/{result.tenant.slug}
        </p>
      </div>
      <HotelUsersList tenantId={result.tenant.id} users={result.tenant.users} />
    </div>
  );
}
