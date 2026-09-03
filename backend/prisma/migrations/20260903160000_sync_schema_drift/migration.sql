-- Sincroniza tablas/columnas que existían en schema.prisma pero no tenían migración formal.
-- Usa IF NOT EXISTS para servidores que ya aplicaron parte vía db push.

-- Enums SISIP / renovación
DO $$ BEGIN
  CREATE TYPE "RenewalFrequency" AS ENUM ('ANUAL', 'SEMESTRAL', 'TRIMESTRAL', 'MENSUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RenewalType" AS ENUM ('NORMAL', 'TACITA', 'CON_AVISO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Product: campos plan SISIP
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "subPlanCode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vigenciaInicio" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vigenciaFin" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "allowsQuickEmission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "renewalFrequency" "RenewalFrequency";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "renewalType" "RenewalType";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "premiumGuaranteeDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "annualClosingMonth" INTEGER;

-- Coverage: tarifa / SISIP
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "tariffPremium" DECIMAL(18,4);
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "vigenciaDesde" TIMESTAMP(3);
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "vigenciaHasta" TIMESTAMP(3);
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "dependsOnCoverageName" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "coberturaInternaCode" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "tarifaInternaCode" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "treatmentType" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "calculationService" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "reinsuranceContractCode" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "reinsuranceContractName" TEXT;
ALTER TABLE "Coverage" ADD COLUMN IF NOT EXISTS "reinsuranceBranchCode" TEXT;

-- FormField: paso del wizard
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "stepKey" TEXT NOT NULL DEFAULT 'RISK_DATA';

-- ProductPlan
CREATE TABLE IF NOT EXISTS "ProductPlan" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "priceFactor" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "coverageIds" JSONB,
    "coverageLabels" JSONB,
    "assignedChannel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPlan_productId_idx" ON "ProductPlan"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductPlan" ADD CONSTRAINT "ProductPlan_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Asegurar precisión amplia de priceFactor (idempotente)
ALTER TABLE "ProductPlan" ALTER COLUMN "priceFactor" TYPE DECIMAL(18,4);

-- ProductSisipConfig
CREATE TABLE IF NOT EXISTS "ProductSisipConfig" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ramoInternoCode" TEXT,
    "ramoInternoName" TEXT,
    "branchAlias1" TEXT,
    "branchAlias2" TEXT,
    "producerCode" TEXT,
    "producerName" TEXT,
    "assignToAllProducers" BOOLEAN NOT NULL DEFAULT false,
    "counterCotizacion" TEXT NOT NULL DEFAULT 'COTIZACION',
    "counterPoliza" TEXT NOT NULL DEFAULT 'POLIZA',
    "counterRecibo" TEXT NOT NULL DEFAULT 'RECIBO',
    "counterSiniestro" TEXT NOT NULL DEFAULT 'SINIESTRO',
    "maskPoliza" TEXT,
    "maskRecibo" TEXT,
    "maskSiniestro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSisipConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductSisipConfig_productId_key" ON "ProductSisipConfig"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductSisipConfig" ADD CONSTRAINT "ProductSisipConfig_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- FlowStepConfig
CREATE TABLE IF NOT EXISTS "FlowStepConfig" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "formEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FlowStepConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlowStepConfig_productId_stepKey_key" ON "FlowStepConfig"("productId", "stepKey");
CREATE INDEX IF NOT EXISTS "FlowStepConfig_productId_idx" ON "FlowStepConfig"("productId");

DO $$ BEGIN
  ALTER TABLE "FlowStepConfig" ADD CONSTRAINT "FlowStepConfig_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RequiredDocument
CREATE TABLE IF NOT EXISTS "RequiredDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RequiredDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequiredDocument_productId_idx" ON "RequiredDocument"("productId");

DO $$ BEGIN
  ALTER TABLE "RequiredDocument" ADD CONSTRAINT "RequiredDocument_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
