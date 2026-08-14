import { CreateHotelForm } from "@/components/admin/create-hotel-form";

export default function AdminCadastrarPage({
  searchParams,
}: {
  searchParams: { name?: string; email?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Cadastrar</h1>
        <p className="text-sm text-muted-foreground">
          Crie o hotel e o login do gestor. Ele configura PIX, logo e WhatsApp
          no painel dele.
        </p>
      </div>
      <CreateHotelForm
        defaults={{
          name: searchParams.name,
          adminEmail: searchParams.email,
        }}
      />
    </div>
  );
}
