-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "RealmStage" (
    "id" TEXT NOT NULL,
    "realmMajor" INTEGER NOT NULL,
    "realmSub" INTEGER NOT NULL,
    "realmName" TEXT NOT NULL,
    "subStageName" TEXT NOT NULL,
    "linhKhiRequired" DOUBLE PRECISION NOT NULL,
    "cultivationRate" DOUBLE PRECISION NOT NULL,
    "baseSuccessRate" DOUBLE PRECISION NOT NULL,
    "pityIncrement" DOUBLE PRECISION NOT NULL,
    "maxSuccessRate" DOUBLE PRECISION NOT NULL,
    "punishmentSeconds" INTEGER NOT NULL,

    CONSTRAINT "RealmStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealmStage_realmMajor_realmSub_key" ON "RealmStage"("realmMajor", "realmSub");
