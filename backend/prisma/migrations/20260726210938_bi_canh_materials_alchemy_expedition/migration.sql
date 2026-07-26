-- AlterTable
ALTER TABLE "CongPhap" ADD COLUMN     "baseMaterialCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cooldownRounds" INTEGER,
ADD COLUMN     "materialCostGrowth" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "upgradeMaterialId" TEXT;

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glyph" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlchemyRecipe" (
    "id" TEXT NOT NULL,
    "pillId" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "linhThachCost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlchemyRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlchemyRecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "AlchemyRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlchemyJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "outputGrantedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',

    CONSTRAINT "AlchemyJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpeditionBranch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glyph" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePower" DOUBLE PRECISION NOT NULL,
    "alchemyMaterialId" TEXT NOT NULL,

    CONSTRAINT "ExpeditionBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpeditionDifficulty" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enemyMultiplier" DOUBLE PRECISION NOT NULL,
    "normalDropRate" DOUBLE PRECISION NOT NULL,
    "bossDropRate" DOUBLE PRECISION NOT NULL,
    "rewardMultiplier" DOUBLE PRECISION NOT NULL,
    "adaptiveCoefficient" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExpeditionDifficulty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpeditionUpgradeMaterialWeight" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExpeditionUpgradeMaterialWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpeditionDailyQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameDay" TEXT NOT NULL,
    "spentUnits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpeditionDailyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expedition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "difficultyId" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "ticketCostUnits" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "seed" TEXT NOT NULL,
    "combatSnapshot" JSONB NOT NULL,
    "combatResult" JSONB NOT NULL,
    "rewardResult" JSONB NOT NULL,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialInventory_userId_materialId_key" ON "MaterialInventory"("userId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "AlchemyRecipe_pillId_key" ON "AlchemyRecipe"("pillId");

-- CreateIndex
CREATE UNIQUE INDEX "AlchemyRecipeIngredient_recipeId_materialId_key" ON "AlchemyRecipeIngredient"("recipeId", "materialId");

-- CreateIndex
CREATE INDEX "AlchemyJob_userId_status_startsAt_idx" ON "AlchemyJob"("userId", "status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpeditionBranch_alchemyMaterialId_key" ON "ExpeditionBranch"("alchemyMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpeditionDifficulty_branchId_key_key" ON "ExpeditionDifficulty"("branchId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ExpeditionUpgradeMaterialWeight_branchId_materialId_key" ON "ExpeditionUpgradeMaterialWeight"("branchId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpeditionDailyQuota_userId_gameDay_key" ON "ExpeditionDailyQuota"("userId", "gameDay");

-- CreateIndex
CREATE INDEX "Expedition_userId_status_idx" ON "Expedition"("userId", "status");

-- AddForeignKey
ALTER TABLE "CongPhap" ADD CONSTRAINT "CongPhap_upgradeMaterialId_fkey" FOREIGN KEY ("upgradeMaterialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialInventory" ADD CONSTRAINT "MaterialInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialInventory" ADD CONSTRAINT "MaterialInventory_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyRecipe" ADD CONSTRAINT "AlchemyRecipe_pillId_fkey" FOREIGN KEY ("pillId") REFERENCES "Pill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyRecipeIngredient" ADD CONSTRAINT "AlchemyRecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "AlchemyRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyRecipeIngredient" ADD CONSTRAINT "AlchemyRecipeIngredient_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyJob" ADD CONSTRAINT "AlchemyJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyJob" ADD CONSTRAINT "AlchemyJob_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlchemyJob" ADD CONSTRAINT "AlchemyJob_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "AlchemyRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpeditionBranch" ADD CONSTRAINT "ExpeditionBranch_alchemyMaterialId_fkey" FOREIGN KEY ("alchemyMaterialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpeditionDifficulty" ADD CONSTRAINT "ExpeditionDifficulty_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ExpeditionBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpeditionUpgradeMaterialWeight" ADD CONSTRAINT "ExpeditionUpgradeMaterialWeight_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ExpeditionBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpeditionUpgradeMaterialWeight" ADD CONSTRAINT "ExpeditionUpgradeMaterialWeight_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpeditionDailyQuota" ADD CONSTRAINT "ExpeditionDailyQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ExpeditionBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_difficultyId_fkey" FOREIGN KEY ("difficultyId") REFERENCES "ExpeditionDifficulty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
