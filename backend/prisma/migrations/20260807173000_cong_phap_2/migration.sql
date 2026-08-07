-- AlterTable
ALTER TABLE "CongPhap" ADD COLUMN     "biTichMaterialId" TEXT,
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "minRealmMajor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RedeemCodeReward" ADD COLUMN     "materialId" TEXT;

-- CreateIndex
CREATE INDEX "CongPhap_tier_branch_idx" ON "CongPhap"("tier", "branch");

-- AddForeignKey
ALTER TABLE "RedeemCodeReward" ADD CONSTRAINT "RedeemCodeReward_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CongPhap" ADD CONSTRAINT "CongPhap_biTichMaterialId_fkey" FOREIGN KEY ("biTichMaterialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 3 môn tiền kỳ vốn là môn chiến đấu → nhánh Chiến Đạo.
UPDATE "CongPhap" SET "branch" = 'chienDao' WHERE "id" IN ('thiet-cot-quyet', 'linh-tuc-quyet', 'liet-hoa-tam');
