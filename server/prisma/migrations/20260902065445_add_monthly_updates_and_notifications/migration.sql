-- CreateEnum
CREATE TYPE "MonthlyUpdateStatus" AS ENUM ('ON_TIME', 'LATE', 'MISSING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PLAN_ASSIGNED', 'UPDATE_OVERDUE', 'UPDATE_REMINDER_SENT', 'REPORT_FLAGGED', 'METRIC_UPDATED', 'PERFORMANCE_RECORDED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "addedByUserId" TEXT;

-- AlterTable
ALTER TABLE "plan_assignments" ADD COLUMN     "assignedByUserId" TEXT;

-- CreateTable
CREATE TABLE "monthly_updates" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "planId" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "monthStartDate" TIMESTAMP(3) NOT NULL,
    "monthEndDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MonthlyUpdateStatus" NOT NULL DEFAULT 'ON_TIME',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "senderId" TEXT,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "relatedOfficeId" TEXT,
    "relatedPlanId" TEXT,
    "relatedReportId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_updates_officeId_idx" ON "monthly_updates"("officeId");

-- CreateIndex
CREATE INDEX "notifications_recipientId_idx" ON "notifications"("recipientId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_updates" ADD CONSTRAINT "monthly_updates_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_updates" ADD CONSTRAINT "monthly_updates_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_updates" ADD CONSTRAINT "monthly_updates_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
