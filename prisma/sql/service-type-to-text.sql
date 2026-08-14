-- Converte o enum antigo (HOTEL/DAYCARE/GROOMING) para texto,
-- para o hotel poder cadastrar serviços com nome livre.
ALTER TABLE "Booking"
  ALTER COLUMN "serviceType" TYPE TEXT
  USING "serviceType"::text;

DROP TYPE IF EXISTS "ServiceType";
