CREATE TABLE "activity_interests" (
	"activity_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "activity_interests_activity_id_user_id_pk" PRIMARY KEY("activity_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "idea_interests" (
	"idea_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "idea_interests_idea_id_user_id_pk" PRIMARY KEY("idea_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "activity_interests" ADD CONSTRAINT "activity_interests_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_interests" ADD CONSTRAINT "activity_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_interests" ADD CONSTRAINT "idea_interests_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_interests" ADD CONSTRAINT "idea_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;