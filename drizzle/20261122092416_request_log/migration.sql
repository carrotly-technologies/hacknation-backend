CREATE TABLE "request_log" (
	"id" text PRIMARY KEY,
	"at" timestamp with time zone NOT NULL,
	"session_id" text,
	"kind" text NOT NULL,
	"method" text,
	"path" text NOT NULL,
	"status" integer,
	"duration_ms" integer,
	"ip" text,
	"user_agent" text,
	"user_id" text,
	"user_name" text
);
--> statement-breakpoint
CREATE INDEX "request_log_at_idx" ON "request_log" ("at");--> statement-breakpoint
CREATE INDEX "request_log_session_idx" ON "request_log" ("session_id","at");