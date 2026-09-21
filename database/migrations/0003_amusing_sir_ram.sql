CREATE TYPE "public"."global_role" AS ENUM('MEMBER', 'OPS');--> statement-breakpoint
CREATE TABLE "role_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "role_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_id" text,
	"actor_id" text,
	"previous_role" "global_role" NOT NULL,
	"new_role" "global_role" NOT NULL,
	"source" text NOT NULL,
	"operator" text,
	"confirmed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "global_role" DEFAULT 'MEMBER' NOT NULL;--> statement-breakpoint
ALTER TABLE "role_changes" ADD CONSTRAINT "role_changes_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_changes" ADD CONSTRAINT "role_changes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;