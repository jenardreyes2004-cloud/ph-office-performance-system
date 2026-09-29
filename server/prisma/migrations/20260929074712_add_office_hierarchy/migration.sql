-- AlterTable
ALTER TABLE "offices" ADD COLUMN     "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "offices_parentId_idx" ON "offices"("parentId");

-- AddForeignKey
ALTER TABLE "offices" ADD CONSTRAINT "offices_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
