-- Minuta reunión: EUR, subramos, prima/tasa, catálogo CORE, sync productos

-- CreateEnum
CREATE TYPE "PremiumCalculationType" AS ENUM ('PRIMA_FIJA', 'TASA_PORCENTUAL');
CREATE TYPE "CoreSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- AlterEnum ContractCurrency
ALTER TYPE "ContractCurrency" ADD VALUE 'EUR';

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "subBranchCode" TEXT;
ALTER TABLE "Product" ADD COLUMN "subBranchName" TEXT;
ALTER TABLE "Product" ADD COLUMN "coreProductCode" TEXT;
ALTER TABLE "Product" ADD COLUMN "coreSyncedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "coreSyncStatus" "CoreSyncStatus";
ALTER TABLE "Product" ADD COLUMN "coreSyncError" TEXT;

-- AlterTable Coverage
ALTER TABLE "Coverage" ADD COLUMN "premiumCalculationType" "PremiumCalculationType" NOT NULL DEFAULT 'PRIMA_FIJA';
ALTER TABLE "Coverage" ADD COLUMN "tariffRate" DECIMAL(8,4);
ALTER TABLE "Coverage" ADD COLUMN "subLimitPercent" DECIMAL(8,4);
ALTER TABLE "Coverage" ADD COLUMN "accountingCode" TEXT;

-- CreateTable CoreSubBranch
CREATE TABLE "CoreSubBranch" (
    "id" TEXT NOT NULL,
    "branch" "ProductBranch" NOT NULL,
    "coreRamoCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoreSubBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable CoreCoverageCatalog
CREATE TABLE "CoreCoverageCatalog" (
    "id" TEXT NOT NULL,
    "branch" "ProductBranch" NOT NULL,
    "subBranchCode" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountingCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'CORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoreCoverageCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable CoreProductRegistry
CREATE TABLE "CoreProductRegistry" (
    "id" TEXT NOT NULL,
    "coreCode" TEXT NOT NULL,
    "productId" TEXT,
    "branch" "ProductBranch" NOT NULL,
    "subBranchCode" TEXT,
    "commercialName" TEXT NOT NULL,
    "internalCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'LOCAL',

    CONSTRAINT "CoreProductRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoreSubBranch_branch_code_key" ON "CoreSubBranch"("branch", "code");
CREATE INDEX "CoreSubBranch_branch_idx" ON "CoreSubBranch"("branch");
CREATE INDEX "CoreSubBranch_coreRamoCode_idx" ON "CoreSubBranch"("coreRamoCode");

CREATE UNIQUE INDEX "CoreCoverageCatalog_branch_code_key" ON "CoreCoverageCatalog"("branch", "code");
CREATE INDEX "CoreCoverageCatalog_branch_subBranchCode_idx" ON "CoreCoverageCatalog"("branch", "subBranchCode");

CREATE UNIQUE INDEX "CoreProductRegistry_coreCode_key" ON "CoreProductRegistry"("coreCode");
CREATE INDEX "CoreProductRegistry_branch_idx" ON "CoreProductRegistry"("branch");
CREATE INDEX "CoreProductRegistry_productId_idx" ON "CoreProductRegistry"("productId");

-- AddForeignKey
ALTER TABLE "CoreCoverageCatalog" ADD CONSTRAINT "CoreCoverageCatalog_branch_subBranchCode_fkey" FOREIGN KEY ("branch", "subBranchCode") REFERENCES "CoreSubBranch"("branch", "code") ON DELETE SET NULL ON UPDATE CASCADE;
