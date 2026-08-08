-- AlterTable
ALTER TABLE "AlchemyJob" ADD COLUMN     "critCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "successCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AlchemyRecipe" ADD COLUMN     "baseSuccessPct" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "minAlchemyRank" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Pill" ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "AlchemyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "danKhi" INTEGER NOT NULL DEFAULT 0,
    "furnaceLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlchemyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlchemyProfile_userId_key" ON "AlchemyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlchemyProfile_characterId_key" ON "AlchemyProfile"("characterId");

-- AddForeignKey
ALTER TABLE "AlchemyProfile" ADD CONSTRAINT "AlchemyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyProfile" ADD CONSTRAINT "AlchemyProfile_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
