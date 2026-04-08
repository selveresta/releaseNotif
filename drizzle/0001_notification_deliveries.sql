CREATE TYPE "public"."notification_delivery_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"repository_id" integer NOT NULL,
	"subscription_id" integer NOT NULL,
	"tag" text NOT NULL,
	"status" "notification_delivery_status" NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_subscription_id_tag_unique" ON "notification_deliveries" USING btree ("subscription_id","tag");--> statement-breakpoint
CREATE INDEX "notification_deliveries_repository_id_idx" ON "notification_deliveries" USING btree ("repository_id");--> statement-breakpoint
