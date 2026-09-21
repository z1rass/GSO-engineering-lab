CREATE TYPE "public"."season_status" AS ENUM('DRAFT', 'UPCOMING', 'ACTIVE', 'FINISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "seasons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "season_status" DEFAULT 'DRAFT' NOT NULL,
	CONSTRAINT "seasons_number_unique" UNIQUE("number"),
	CONSTRAINT "season_dates_ordered" CHECK ("seasons"."ends_on" >= "seasons"."starts_on"),
	CONSTRAINT "season_number_nonnegative" CHECK ("seasons"."number" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_season" ON "seasons" USING btree ("status") WHERE "seasons"."status" = 'ACTIVE';