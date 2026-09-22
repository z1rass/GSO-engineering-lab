CREATE TYPE "public"."ownership_transfer_status" AS ENUM('PENDING', 'ACCEPTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "ownership_transfers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ownership_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"activity_id" integer NOT NULL,
	"from_owner_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"status" "ownership_transfer_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_from_owner_id_users_id_fk" FOREIGN KEY ("from_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_ownership_transfer" ON "ownership_transfers" USING btree ("activity_id") WHERE "ownership_transfers"."status" = 'PENDING';