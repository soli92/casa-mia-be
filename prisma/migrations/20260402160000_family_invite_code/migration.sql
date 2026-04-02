-- Codice invito per unirsi alla stessa famiglia (scope dati = familyId, non il nome).

ALTER TABLE "Family" ADD COLUMN "inviteCode" TEXT;

UPDATE "Family"
SET "inviteCode" = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10));

CREATE UNIQUE INDEX "Family_inviteCode_key" ON "Family"("inviteCode");

ALTER TABLE "Family" ALTER COLUMN "inviteCode" SET NOT NULL;
