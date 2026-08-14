import { Loader2 } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium">Carregando...</span>
      </div>
    </div>
  );
}
