import { cepDigits } from "@/lib/utils";

export type CepAddress = {
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
};

export async function lookupCep(
  cep: string,
  signal?: AbortSignal,
): Promise<CepAddress | null> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    signal,
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };

  if (data.erro) return null;

  return {
    street: data.logradouro?.trim() ?? "",
    neighborhood: data.bairro?.trim() ?? "",
    city: data.localidade?.trim() ?? "",
    uf: data.uf?.trim() ?? "",
  };
}
