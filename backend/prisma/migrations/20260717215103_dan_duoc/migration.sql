-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "breakthroughBonusPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cultivationBuffMultiplier" DOUBLE PRECISION,
ADD COLUMN     "cultivationBuffUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Pill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glyph" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "effectKind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "multiplier" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "bonusPct" DOUBLE PRECISION,
    "desc" TEXT NOT NULL,

    CONSTRAINT "Pill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pillId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userId_pillId_key" ON "InventoryItem"("userId", "pillId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_pillId_fkey" FOREIGN KEY ("pillId") REFERENCES "Pill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
