-- PetFlow usa Prisma no servidor (role postgres), não a Data API.
-- Sem RLS, a chave publishable conseguiria ler/gravar tudo via REST.
-- Com RLS ligado e sem policies para anon/authenticated, a API fica bloqueada.
-- O Prisma continua com acesso total (owner do banco, bypass de RLS).

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tutor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vaccine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantBelonging" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantRequiredVaccine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantWeekday" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Tenant", "User", "Tutor", "Pet", "Vaccine", "Booking", "DailyLog", "ChecklistItem", "Lead", "SupportTicket", "SupportMessage", "PlatformSettings", "SubscriptionPayment", "TenantService", "TenantBelonging", "TenantRequiredVaccine", "TenantWeekday"
  FROM anon, authenticated;

GRANT ALL ON TABLE "Tenant", "User", "Tutor", "Pet", "Vaccine", "Booking", "DailyLog", "ChecklistItem", "Lead", "SupportTicket", "SupportMessage", "PlatformSettings", "SubscriptionPayment", "TenantService", "TenantBelonging", "TenantRequiredVaccine", "TenantWeekday"
  TO postgres, service_role;
