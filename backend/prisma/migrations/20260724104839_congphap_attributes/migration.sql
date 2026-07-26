-- DropForeignKey
ALTER TABLE "RedeemCodeReward" DROP CONSTRAINT "RedeemCodeReward_pillId_fkey";

-- DropIndex
DROP INDEX "RedeemCodeReward_codeId_pillId_key";

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "linhThach" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RealmStage" ADD COLUMN     "baseChanNguyen" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "baseCongPhep" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "baseCongVatLy" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "baseKhiHuyet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "basePhongThu" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "baseTocDo" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RedeemCodeReward" ADD COLUMN     "congPhapId" TEXT,
ADD COLUMN     "linhThach" INTEGER,
ALTER COLUMN "pillId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CongPhap" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glyph" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxLevel" INTEGER NOT NULL,
    "baseCost" INTEGER NOT NULL,
    "costGrowth" DOUBLE PRECISION NOT NULL,
    "effects" JSONB,
    "powerPerLevel" DOUBLE PRECISION,
    "chanNguyenCost" DOUBLE PRECISION,
    "dupRefundLinhThach" INTEGER,

    CONSTRAINT "CongPhap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnedCongPhap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "congPhapId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "equippedSlot" INTEGER,

    CONSTRAINT "OwnedCongPhap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnedCongPhap_userId_congPhapId_key" ON "OwnedCongPhap"("userId", "congPhapId");

-- AddForeignKey
ALTER TABLE "RedeemCodeReward" ADD CONSTRAINT "RedeemCodeReward_pillId_fkey" FOREIGN KEY ("pillId") REFERENCES "Pill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedeemCodeReward" ADD CONSTRAINT "RedeemCodeReward_congPhapId_fkey" FOREIGN KEY ("congPhapId") REFERENCES "CongPhap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedCongPhap" ADD CONSTRAINT "OwnedCongPhap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedCongPhap" ADD CONSTRAINT "OwnedCongPhap_congPhapId_fkey" FOREIGN KEY ("congPhapId") REFERENCES "CongPhap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

