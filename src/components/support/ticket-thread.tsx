import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function TicketThread({
  messages,
}: {
  messages: Array<{
    id: string;
    body: string;
    fromMaster: boolean;
    createdAt: Date | string;
    author: { name: string };
  }>;
}) {
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[85%] break-words rounded-xl border p-3",
            message.fromMaster
              ? "ml-auto bg-primary/5"
              : "mr-auto bg-card",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">
            {message.fromMaster ? "Suporte PetFlow" : message.author.name} ·{" "}
            {formatDateTime(message.createdAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
        </div>
      ))}
    </div>
  );
}
