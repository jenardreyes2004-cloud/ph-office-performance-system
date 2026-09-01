/*
  Warnings:

  - The values [ADMIN,SUPERVISOR,STAFF] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `weight` on the `performance_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `taskSummary` on the `plan_assignments` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `plan_assignments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlanStatus" ADD VALUE 'ONGOING';
ALTER TYPE "PlanStatus" ADD VALUE 'DELAYED';

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('MAIN_ADMIN', 'OFFICE_ADMIN', 'IT_ADMIN', 'EMPLOYEE');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- AlterTable
ALTER TABLE "offices" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "performance_metrics" DROP COLUMN "weight",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "weightPct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "plan_assignments" DROP COLUMN "taskSummary",
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "progressPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "responsibility" TEXT,
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
