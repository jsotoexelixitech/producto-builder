-- Respaldo y versiones de lo que el configurador escribe en Sis2000 (copia en la Postgres del configurador, no en Sis2000).
-- Sis2000Respaldo: la copia original de cada entidad (una sola vez, nunca se sobreescribe).
-- Sis2000Version: cada escritura con lo que había antes, lo que quedó, quién, cuándo y por qué.

-- CreateEnum
CREATE TYPE "Sis2000EntidadRespaldo" AS ENUM ('PRODUCTO', 'COBERTURA', 'TARIFA', 'PLAN', 'PLAN_PROVEEDORES');

-- CreateEnum
CREATE TYPE "Sis2000TipoVersion" AS ENUM ('CREACION', 'CAMBIO', 'ELIMINACION', 'RESTAURACION');

-- CreateEnum
CREATE TYPE "Sis2000ResultadoVersion" AS ENUM ('PENDIENTE', 'APLICADA', 'FALLIDA');

-- CreateTable
CREATE TABLE "Sis2000Respaldo" (
    "id" TEXT NOT NULL,
    "entidad" "Sis2000EntidadRespaldo" NOT NULL,
    "clave" TEXT NOT NULL,
    "existia" BOOLEAN NOT NULL,
    "original" JSONB,
    "usuarioId" TEXT,
    "usuarioEmail" TEXT,
    "usuarioNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sis2000Respaldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sis2000Version" (
    "id" TEXT NOT NULL,
    "respaldoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "Sis2000TipoVersion" NOT NULL,
    "resultado" "Sis2000ResultadoVersion" NOT NULL DEFAULT 'PENDIENTE',
    "anterior" JSONB,
    "estado" JSONB,
    "payload" JSONB,
    "cambios" JSONB,
    "motivo" TEXT,
    "restauradaDesde" TEXT,
    "error" TEXT,
    "usuarioId" TEXT,
    "usuarioEmail" TEXT,
    "usuarioNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEn" TIMESTAMP(3),

    CONSTRAINT "Sis2000Version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sis2000Respaldo_entidad_clave_key" ON "Sis2000Respaldo"("entidad", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "Sis2000Version_respaldoId_numero_key" ON "Sis2000Version"("respaldoId", "numero");

-- CreateIndex
CREATE INDEX "Sis2000Version_respaldoId_createdAt_idx" ON "Sis2000Version"("respaldoId", "createdAt");

-- AddForeignKey
ALTER TABLE "Sis2000Version" ADD CONSTRAINT "Sis2000Version_respaldoId_fkey" FOREIGN KEY ("respaldoId") REFERENCES "Sis2000Respaldo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La copia original nunca se sobreescribe.
CREATE OR REPLACE FUNCTION "sis2000_respaldo_original_inmutable"() RETURNS trigger AS $$
BEGIN
    IF NEW."original" IS DISTINCT FROM OLD."original"
       OR NEW."existia" IS DISTINCT FROM OLD."existia"
       OR NEW."entidad" IS DISTINCT FROM OLD."entidad"
       OR NEW."clave" IS DISTINCT FROM OLD."clave" THEN
        RAISE EXCEPTION 'La copia original de % % no se puede modificar', OLD."entidad", OLD."clave";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Sis2000Respaldo_original_inmutable"
    BEFORE UPDATE ON "Sis2000Respaldo"
    FOR EACH ROW EXECUTE FUNCTION "sis2000_respaldo_original_inmutable"();

-- Lo que había antes de cada escritura no se modifica; una versión solo se cierra una vez (PENDIENTE → APLICADA/FALLIDA).
CREATE OR REPLACE FUNCTION "sis2000_version_solo_cierre"() RETURNS trigger AS $$
BEGIN
    IF OLD."resultado" <> 'PENDIENTE'
       OR NEW."anterior" IS DISTINCT FROM OLD."anterior"
       OR NEW."payload" IS DISTINCT FROM OLD."payload"
       OR NEW."respaldoId" IS DISTINCT FROM OLD."respaldoId"
       OR NEW."numero" IS DISTINCT FROM OLD."numero"
       OR NEW."tipo" IS DISTINCT FROM OLD."tipo" THEN
        RAISE EXCEPTION 'La versión % de % no se puede modificar', OLD."numero", OLD."respaldoId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Sis2000Version_solo_cierre"
    BEFORE UPDATE ON "Sis2000Version"
    FOR EACH ROW EXECUTE FUNCTION "sis2000_version_solo_cierre"();
