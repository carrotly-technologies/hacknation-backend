CREATE TABLE "journal_notes" (
	"id" text PRIMARY KEY,
	"person_id" text NOT NULL,
	"author_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_observations" (
	"id" text PRIMARY KEY,
	"person_id" text NOT NULL,
	"author_id" text NOT NULL,
	"date" date NOT NULL,
	"criterion_id" text NOT NULL,
	"indicator_id" text,
	"kind" text NOT NULL,
	"situation" text NOT NULL,
	"action" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "journal_notes_person_author_idx" ON "journal_notes" ("person_id","author_id");--> statement-breakpoint
CREATE INDEX "journal_observations_person_author_idx" ON "journal_observations" ("person_id","author_id");