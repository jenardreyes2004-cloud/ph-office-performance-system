-- Hierarchy levels, tagging, transfers, teams, quotas, and the operational
-- system log.
--
-- Replaces Office.isHeadOffice with Office.kind, because a boolean cannot
-- distinguish a department from an office, and the six access levels are
-- derived from which node a person heads rather than from a role.

-- CreateEnum
CREATE TYPE "OrgNodeKind" AS ENUM ('DEPARTMENT', 'OFFICE', 'SUB_UNIT');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('HIERARCHY_HEAD', 'DEPARTMENT_HEAD', 'OFFICE_HEAD', 'SUB_UNIT_HEAD', 'TEAM_LEAD', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('EMPLOYEE', 'OFFICE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'CPS_VERIFIED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuotaStatus" AS ENUM ('DRAFT', 'ON_TRACK', 'AT_RISK', 'MET', 'MISSED');

-- CreateEnum
CREATE TYPE "SystemLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL');

-- AlterTable
-- kind defaults to OFFICE so the existing rows stay valid while the data
-- migration below classifies them.
ALTER TABLE "offices" ADD COLUMN "kind" "OrgNodeKind" NOT NULL DEFAULT 'OFFICE';

-- Data migration: classify the seeded PhilHealth structure.
-- Departments are the three the org chart groups under the OVP; offices are
-- the section-level units that carry a Balanced Scorecard or sit under no
-- department; everything else is a sub-unit.
UPDATE "offices" SET "kind" = 'DEPARTMENT' WHERE "code" IN ('MSD', 'HCDMD', 'SBAC');
UPDATE "offices" SET "kind" = 'OFFICE' WHERE "code" IN (
  'OVP', 'AS', 'FMS', 'LEGAL', 'PAU', 'PMMO', 'BEN-TAMO', 'ITMS',
  'NCR-N', 'NCR-C', 'NCR-S'
);
UPDATE "offices" SET "kind" = 'SUB_UNIT' WHERE "kind" = 'OFFICE' AND "code" NOT IN (
  'OVP', 'AS', 'FMS', 'LEGAL', 'PAU', 'PMMO', 'BEN-TAMO', 'ITMS',
  'NCR-N', 'NCR-C', 'NCR-S'
);

-- AlterTable
ALTER TABLE "offices" DROP COLUMN "isHeadOffice";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "accessLevel" "AccessLevel" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN "headedOfficeId" TEXT;

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "SystemLogLevel" NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status" INTEGER,
    "durationMs" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_tags" (
    "officeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "taggedById" TEXT,
    "taggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "office_tags_pkey" PRIMARY KEY ("officeId", "tagId")
);

-- CreateTable
CREATE TABLE "transfer_requests" (
    "id" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "employeeId" TEXT,
    "fromOfficeId" TEXT NOT NULL,
    "toOfficeId" TEXT NOT NULL,
    "officeId" TEXT,
    "reason" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "cpsVerifiedByUserId" TEXT,
    "cpsVerifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_teams" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadEmployeeId" TEXT,
    "appointedByUserId" TEXT NOT NULL,
    "appointedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_team_leads" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "appointedByUserId" TEXT NOT NULL,
    "appointedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "project_team_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotas" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "teamId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "actualValue" DOUBLE PRECISION,
    "status" "QuotaStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_label_category_key" ON "tags"("label", "category");
CREATE INDEX "system_logs_level_idx" ON "system_logs"("level");
CREATE INDEX "system_logs_category_idx" ON "system_logs"("category");
CREATE INDEX "system_logs_createdAt_idx" ON "system_logs"("createdAt");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "offices_kind_idx" ON "offices"("kind");
CREATE INDEX "transfer_requests_status_idx" ON "transfer_requests"("status");
CREATE INDEX "transfer_requests_employeeId_idx" ON "transfer_requests"("employeeId");
CREATE INDEX "project_teams_planId_idx" ON "project_teams"("planId");
CREATE INDEX "project_teams_leadEmployeeId_idx" ON "project_teams"("leadEmployeeId");
CREATE UNIQUE INDEX "team_members_teamId_employeeId_key" ON "team_members"("teamId", "employeeId");
CREATE UNIQUE INDEX "project_team_leads_planId_employeeId_key" ON "project_team_leads"("planId", "employeeId");
CREATE INDEX "project_team_leads_planId_idx" ON "project_team_leads"("planId");
CREATE UNIQUE INDEX "quotas_planId_employeeId_periodStart_key" ON "quotas"("planId", "employeeId", "periodStart");
CREATE INDEX "quotas_employeeId_idx" ON "quotas"("employeeId");
CREATE INDEX "quotas_teamId_idx" ON "quotas"("teamId");

-- AddForeignKey
-- offices_parentId_fkey already exists from 20260929074712_add_office_hierarchy.
ALTER TABLE "employees" ADD CONSTRAINT "employees_headedOfficeId_fkey" FOREIGN KEY ("headedOfficeId") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "office_tags" ADD CONSTRAINT "office_tags_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "office_tags" ADD CONSTRAINT "office_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "office_tags" ADD CONSTRAINT "office_tags_taggedById_fkey" FOREIGN KEY ("taggedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_fromOfficeId_fkey" FOREIGN KEY ("fromOfficeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_toOfficeId_fkey" FOREIGN KEY ("toOfficeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_cpsVerifiedByUserId_fkey" FOREIGN KEY ("cpsVerifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_leadEmployeeId_fkey" FOREIGN KEY ("leadEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_appointedByUserId_fkey" FOREIGN KEY ("appointedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "project_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_team_leads" ADD CONSTRAINT "project_team_leads_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_team_leads" ADD CONSTRAINT "project_team_leads_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_team_leads" ADD CONSTRAINT "project_team_leads_appointedByUserId_fkey" FOREIGN KEY ("appointedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "project_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
