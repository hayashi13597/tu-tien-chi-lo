-- AlterTable
ALTER TABLE "ExpeditionBranch" ADD COLUMN     "minRealmMajor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recommendedPower" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Pill" ADD COLUMN     "combatAttribute" TEXT,
ADD COLUMN     "combatTrigger" TEXT;

-- DropTable

-- CreateTable
CREATE TABLE "ExpeditionBossDropWeight" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExpeditionBossDropWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpeditionBossDropWeight_branchId_materialId_key" ON "ExpeditionBossDropWeight"("branchId", "materialId");

-- AddForeignKey
ALTER TABLE "ExpeditionBossDropWeight" ADD CONSTRAINT "ExpeditionBossDropWeight_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ExpeditionBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpeditionBossDropWeight" ADD CONSTRAINT "ExpeditionBossDropWeight_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 3 backfill: gán tầng theo power ladder hiện có.
UPDATE "ExpeditionBranch" SET tier = 2, "minRealmMajor" = 3, "recommendedPower" = 600
  WHERE id IN ('thanh-lam', 'u-minh', 'van-hai');
UPDATE "ExpeditionBranch" SET tier = 3, "minRealmMajor" = 5, "recommendedPower" = 1200
  WHERE id IN ('long-mach', 'tinh-thien');
