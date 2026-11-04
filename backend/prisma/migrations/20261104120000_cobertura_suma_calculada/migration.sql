-- Suma asegurada calculada al emitir (unidades × valor por unidad) por cobertura de Sis2000 (cramo + ccobertura).
-- Sis2000 no tiene columnas para esto: se guarda en la Postgres propia del configurador.

-- CreateEnum
CREATE TYPE "TipoSumaAsegurada" AS ENUM ('FIJA', 'CALCULADA');

-- CreateTable
CREATE TABLE "CoberturaSumaConfig" (
    "id" TEXT NOT NULL,
    "cramo" INTEGER NOT NULL,
    "ccobertura" TEXT NOT NULL,
    "tipoSuma" "TipoSumaAsegurada" NOT NULL DEFAULT 'FIJA',
    "unidadCalculo" TEXT,
    "etiquetaCuadro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoberturaSumaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoberturaSumaConfig_cramo_ccobertura_key" ON "CoberturaSumaConfig"("cramo", "ccobertura");
