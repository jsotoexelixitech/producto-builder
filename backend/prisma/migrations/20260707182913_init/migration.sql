-- CreateEnum
CREATE TYPE "ProductBranch" AS ENUM ('AUTOMOVIL', 'SALUD', 'VIDA', 'PATRIMONIAL', 'INCLUSIVO', 'RCV_OBLIGATORIO');

-- CreateEnum
CREATE TYPE "ContractCurrency" AS ENUM ('VES', 'USD', 'INDEXADO');

-- CreateEnum
CREATE TYPE "EmissionType" AS ENUM ('EMISION_GARANTIZADA', 'REQUIERE_DECLARACION_SALUD', 'REQUIERE_INSPECCION');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTUARIAL_REVIEW', 'SUBMITTED_TO_SUDEASEG', 'APPROVED_ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeductibleType" AS ENUM ('MONTO_FIJO', 'PORCENTAJE_SINIESTRO', 'PORCENTAJE_SUMA_ASEGURADA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONDICIONES_GENERALES', 'CONDICIONES_PARTICULARES', 'NOTA_TECNICA_ACTUARIAL', 'POLIZA', 'CUADRO_RECIBO');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'DATE', 'BOOLEAN');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "commercialName" TEXT NOT NULL,
    "internalCode" TEXT NOT NULL,
    "branch" "ProductBranch" NOT NULL,
    "currency" "ContractCurrency" NOT NULL,
    "emissionType" "EmissionType" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "simplifiedContract" BOOLEAN NOT NULL DEFAULT false,
    "uniformConditions" BOOLEAN NOT NULL DEFAULT false,
    "lockedGeneralConditions" BOOLEAN NOT NULL DEFAULT false,
    "numeroProvidenciaSudeaseg" TEXT,
    "fechaGacetaAprobacion" TIMESTAMP(3),
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coverage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isBasicMandatory" BOOLEAN NOT NULL DEFAULT false,
    "insuredSumMin" DECIMAL(18,2),
    "insuredSumMax" DECIMAL(18,2),
    "insuredSumFixed" DECIMAL(18,2),
    "deductibleType" "DeductibleType",
    "deductibleValue" DECIMAL(18,4),
    "waitingPeriodDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActuarialData" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purePremium" DECIMAL(18,4) NOT NULL,
    "administrativeExpenses" DECIMAL(8,4) NOT NULL,
    "commissions" DECIMAL(8,4) NOT NULL,
    "profitMargin" DECIMAL(8,4) NOT NULL,
    "commercialPremium" DECIMAL(18,4) NOT NULL,
    "actuaryName" TEXT NOT NULL,
    "actuaryCedula" TEXT NOT NULL,
    "actuarySudeasegNumber" TEXT NOT NULL,
    "technicalNoteUrl" TEXT,

    CONSTRAINT "ActuarialData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingVariable" (
    "id" TEXT NOT NULL,
    "actuarialDataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "variableType" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RatingVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exclusion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "typographyHighlight" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Exclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isSimplifiedTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialChannel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,

    CONSTRAINT "CommercialChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStateHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromStatus" "ProductStatus",
    "toStatus" "ProductStatus" NOT NULL,
    "comment" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_internalCode_key" ON "Product"("internalCode");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_branch_idx" ON "Product"("branch");

-- CreateIndex
CREATE INDEX "Coverage_productId_idx" ON "Coverage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ActuarialData_productId_key" ON "ActuarialData"("productId");

-- CreateIndex
CREATE INDEX "RatingVariable_actuarialDataId_idx" ON "RatingVariable"("actuarialDataId");

-- CreateIndex
CREATE INDEX "Exclusion_productId_idx" ON "Exclusion"("productId");

-- CreateIndex
CREATE INDEX "LegalDocument_productId_idx" ON "LegalDocument"("productId");

-- CreateIndex
CREATE INDEX "CommercialChannel_productId_idx" ON "CommercialChannel"("productId");

-- CreateIndex
CREATE INDEX "FormField_productId_idx" ON "FormField"("productId");

-- CreateIndex
CREATE INDEX "ProductStateHistory_productId_idx" ON "ProductStateHistory"("productId");

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActuarialData" ADD CONSTRAINT "ActuarialData_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingVariable" ADD CONSTRAINT "RatingVariable_actuarialDataId_fkey" FOREIGN KEY ("actuarialDataId") REFERENCES "ActuarialData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exclusion" ADD CONSTRAINT "Exclusion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialChannel" ADD CONSTRAINT "CommercialChannel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStateHistory" ADD CONSTRAINT "ProductStateHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
