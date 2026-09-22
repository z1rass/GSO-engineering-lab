CREATE TABLE "activity_seasons" (
	"activity_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	CONSTRAINT "activity_seasons_activity_id_season_id_pk" PRIMARY KEY("activity_id","season_id")
);
--> statement-breakpoint
ALTER TABLE "activity_seasons" ADD CONSTRAINT "activity_seasons_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_seasons" ADD CONSTRAINT "activity_seasons_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;