-- Restores the database to its state before
-- 20260930050000_add_hierarchy_tags_transfers_teams_quotas_systemlog.
--
-- Only needed because that migration failed partway and Postgres kept the
-- statements that had already run. Everything dropped here is created by that
-- one migration file; nothing pre-existing is touched.
--
-- Safe to re-run: every DROP is guarded with IF EXISTS.

DROP TABLE IF EXISTS "quotas" CASCADE;
DROP TABLE IF EXISTS "project_team_leads" CASCADE;
DROP TABLE IF EXISTS "team_members" CASCADE;
DROP TABLE IF EXISTS "project_teams" CASCADE;
DROP TABLE IF EXISTS "transfer_requests" CASCADE;
DROP TABLE IF EXISTS "office_tags" CASCADE;
DROP TABLE IF EXISTS "tags" CASCADE;
DROP TABLE IF EXISTS "system_logs" CASCADE;

DROP INDEX IF EXISTS "audit_logs_createdAt_idx";
DROP INDEX IF EXISTS "offices_kind_idx";

-- Re-add the column this migration replaces, so the pre-migration schema is
-- genuinely restored rather than approximated.
ALTER TABLE "offices" ADD COLUMN IF NOT EXISTS "isHeadOffice" BOOLEAN NOT NULL DEFAULT false;

-- Backfill the four scored offices that seedOrganizationStructure.ts marked,
-- in case the values are wanted after the drop.
UPDATE "offices" SET "isHeadOffice" = true WHERE "code" IN ('OVP', 'NCR-N', 'NCR-C', 'NCR-S');

ALTER TABLE "offices" DROP COLUMN IF EXISTS "kind";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "accessLevel";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "headedOfficeId";

DROP TYPE IF EXISTS "OrgNodeKind";
DROP TYPE IF EXISTS "AccessLevel";
DROP TYPE IF EXISTS "TransferType";
DROP TYPE IF EXISTS "TransferStatus";
DROP TYPE IF EXISTS "QuotaStatus";
DROP TYPE IF EXISTS "SystemLogLevel";
