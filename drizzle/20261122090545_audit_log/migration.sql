CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY,
	"seq" integer NOT NULL,
	"at" timestamp(3) with time zone NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"changed_fields" text[] NOT NULL,
	"ip" text,
	"result" text NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_seq_idx" ON "audit_log" ("seq");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_prev_hash_idx" ON "audit_log" ("prev_hash");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" ("at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" ("actor_id");--> statement-breakpoint
-- Hand-written (not generated): the log is append-only. Any UPDATE, DELETE or
-- TRUNCATE of audit_log fails, whoever runs it (issue #70).
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
		USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_log_no_update_delete" BEFORE UPDATE OR DELETE ON "audit_log"
	FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();
--> statement-breakpoint
CREATE TRIGGER "audit_log_no_truncate" BEFORE TRUNCATE ON "audit_log"
	FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_append_only"();
