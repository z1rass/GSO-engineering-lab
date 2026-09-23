CREATE TYPE "public"."event_place_type" AS ENUM('SCHOOL', 'ONLINE', 'OTHER');--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "place_type" "event_place_type" DEFAULT 'OTHER' NOT NULL;--> statement-breakpoint
UPDATE event_details p SET place_type=CASE WHEN p.school_room_required OR EXISTS (SELECT 1 FROM room_requests r WHERE r.activity_id=p.activity_id) THEN 'SCHOOL'::event_place_type WHEN lower(trim(p.general_location))='online' THEN 'ONLINE'::event_place_type ELSE 'OTHER'::event_place_type END;--> statement-breakpoint
UPDATE event_details SET exact_room='';--> statement-breakpoint
UPDATE event_details p SET exact_room=r.room FROM room_requests r WHERE r.activity_id=p.activity_id AND r.status='CONFIRMED' AND r.room IS NOT NULL;--> statement-breakpoint
UPDATE activities SET description=description || E'\n\nMaterials / Materialien\n' || materials, materials='' WHERE materials<>'';
