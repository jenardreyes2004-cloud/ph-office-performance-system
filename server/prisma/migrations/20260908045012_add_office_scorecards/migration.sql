-- CreateEnum
CREATE TYPE "ScorecardPerspective" AS ENUM ('DELIGHTED_CLIENTS', 'EXCELLENT_PROCESS', 'SUSTAINABLE_FUND', 'STRONG_FOUNDATION');

-- CreateEnum
CREATE TYPE "ScorecardGrade" AS ENUM ('OUTSTANDING', 'VERY_SATISFACTORY', 'SATISFACTORY', 'UNSATISFACTORY', 'POOR');

-- CreateEnum
CREATE TYPE "OfficeScorecardStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "scorecard_periods" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_scorecards" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "OfficeScorecardStatus" NOT NULL DEFAULT 'DRAFT',
    "raterName" TEXT,
    "raterTitle" TEXT,
    "nextHigherSupervisorName" TEXT,
    "nextHigherSupervisorTitle" TEXT,
    "totalWeight" DECIMAL(6,2),
    "totalScore" DECIMAL(6,2),
    "officeRating" "ScorecardGrade",
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_entries" (
    "id" TEXT NOT NULL,
    "officeScorecardId" TEXT NOT NULL,
    "perspective" "ScorecardPerspective" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "strategicObjective" TEXT NOT NULL,
    "responsibleUnit" TEXT,
    "measure" TEXT NOT NULL,
    "performanceTarget" TEXT NOT NULL,
    "weightPct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_bands" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "grade" "ScorecardGrade" NOT NULL,
    "minPct" DECIMAL(6,2),
    "maxPct" DECIMAL(6,2),
    "rawLabel" TEXT NOT NULL,

    CONSTRAINT "scorecard_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_results" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "rawResult" TEXT NOT NULL,
    "resultPct" DECIMAL(6,2),
    "grade" "ScorecardGrade",
    "isAutoGraded" BOOLEAN NOT NULL DEFAULT false,
    "initialScore" DECIMAL(6,2),
    "finalScore" DECIMAL(6,2),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "office_scorecards_periodId_idx" ON "office_scorecards"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "office_scorecards_officeId_periodId_key" ON "office_scorecards"("officeId", "periodId");

-- CreateIndex
CREATE INDEX "scorecard_entries_officeScorecardId_idx" ON "scorecard_entries"("officeScorecardId");

-- CreateIndex
CREATE INDEX "scorecard_bands_entryId_idx" ON "scorecard_bands"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_results_entryId_key" ON "scorecard_results"("entryId");

-- AddForeignKey
ALTER TABLE "office_scorecards" ADD CONSTRAINT "office_scorecards_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_scorecards" ADD CONSTRAINT "office_scorecards_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "scorecard_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_scorecards" ADD CONSTRAINT "office_scorecards_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_entries" ADD CONSTRAINT "scorecard_entries_officeScorecardId_fkey" FOREIGN KEY ("officeScorecardId") REFERENCES "office_scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_bands" ADD CONSTRAINT "scorecard_bands_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "scorecard_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_results" ADD CONSTRAINT "scorecard_results_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "scorecard_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
