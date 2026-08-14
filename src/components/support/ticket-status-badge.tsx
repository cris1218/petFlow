import { SupportTicketStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { SUPPORT_STATUS_LABELS } from "@/lib/constants";

const VARIANT: Record<
  SupportTicketStatus,
  "default" | "secondary" | "warning" | "success"
> = {
  OPEN: "default",
  WAITING_MASTER: "warning",
  WAITING_HOTEL: "secondary",
  CLOSED: "success",
};

export function TicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  return (
    <Badge variant={VARIANT[status]}>{SUPPORT_STATUS_LABELS[status]}</Badge>
  );
}
