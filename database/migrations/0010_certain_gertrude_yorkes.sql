CREATE TABLE "event_going" (
	"event_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "event_going_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_going" ADD CONSTRAINT "event_going_event_id_event_details_activity_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_details"("activity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_going" ADD CONSTRAINT "event_going_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;