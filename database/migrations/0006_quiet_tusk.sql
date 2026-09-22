CREATE TYPE "public"."event_category" AS ENUM('TALK', 'WORKSHOP', 'BUILD_NIGHT', 'STUDY_SESSION', 'HACKATHON', 'SOCIAL', 'OTHER');--> statement-breakpoint
CREATE TABLE "event_details" (
	"activity_id" integer PRIMARY KEY NOT NULL,
	"category" "event_category" NOT NULL,
	"planned_date" date,
	"end_date" date,
	"start_time" text,
	"end_time" text,
	"general_location" text DEFAULT '' NOT NULL,
	"exact_room" text DEFAULT '' NOT NULL,
	"repository_url" text
);
--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;