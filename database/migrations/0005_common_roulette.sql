CREATE TYPE "public"."activity_status" AS ENUM('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('PROJECT', 'EVENT');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "activity_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"owner_id" text NOT NULL,
	"idea_id" integer,
	"status" "activity_status" DEFAULT 'PLANNING' NOT NULL,
	"materials" text DEFAULT '' NOT NULL,
	"private_instructions" text DEFAULT '' NOT NULL,
	"discord_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_details" (
	"activity_id" integer PRIMARY KEY NOT NULL,
	"goal" text NOT NULL,
	"tech_stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"repository_url" text,
	"documentation_url" text
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_details" ADD CONSTRAINT "project_details_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;