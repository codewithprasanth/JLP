-- Addendum 1: email + OTP login replaces phone + OTP.
-- email: required, unique, lower-cased (the login identifier)
-- email_verified_at replaces phone_verified_at
-- phone: contact-only — no longer unique, nullable until profile setup collects it

-- Backfill so the NOT NULL + UNIQUE constraints can be applied to existing rows.
-- Rows without an email (pre-addendum phone-only accounts) get a reserved, undeliverable
-- address (RFC 2606 ".invalid"), so they can no longer log in; their orders are kept.
UPDATE "users" AS u
SET "email" = CASE
    WHEN u."email" IS NULL OR btrim(u."email") = '' OR d.rn > 1 THEN 'legacy-' || u."id" || '@users.invalid'
    ELSE lower(btrim(u."email"))
  END
FROM (
  SELECT "id", row_number() OVER (PARTITION BY lower(btrim("email")) ORDER BY "created_at") AS rn
  FROM "users"
) AS d
WHERE d."id" = u."id";

-- DropIndex
DROP INDEX "users_phone_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "phone_verified_at",
ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Defence in depth: the app always lower-cases emails; the DB enforces it too.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
