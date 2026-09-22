CREATE TYPE "public"."room_request_status" AS ENUM('PENDING', 'ALTERNATIVE', 'CONFIRMED');--> statement-breakpoint
CREATE TABLE "room_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "room_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"activity_id" integer NOT NULL,
	"note" text NOT NULL,
	"status" "room_request_status" DEFAULT 'PENDING' NOT NULL,
	"date" date,
	"end_date" date,
	"start_time" text,
	"end_time" text,
	"room" text,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_requests_activity_id_unique" UNIQUE("activity_id")
);
--> statement-breakpoint
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;