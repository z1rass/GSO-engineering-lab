ALTER TABLE "ownership_transfers" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "ownership_transfers" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "ownership_transfers" SET "status"='CANCELLED',"resolved_at"=NOW() WHERE "status"='PENDING';
