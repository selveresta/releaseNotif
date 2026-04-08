CREATE TYPE "public"."subscription_status" AS ENUM('pending_confirmation', 'active', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"last_seen_tag" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_full_name_unique" UNIQUE("full_name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"repository_id" integer NOT NULL,
	"status" "subscription_status" NOT NULL,
	"confirm_token" text NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_confirm_token_unique" UNIQUE("confirm_token"),
	CONSTRAINT "subscriptions_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_repository_id_idx" ON "subscriptions" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
-- Hand-written partial unique index: keep in sync with the schema policy documented in README.
CREATE UNIQUE INDEX "subscriptions_email_repository_active_pending_idx" ON "subscriptions" USING btree ("email","repository_id") WHERE "status" IN ('pending_confirmation', 'active');--> statement-breakpoint
