-- Limpia duplicados del catálogo product-builder (piloto Exélixi).
-- Conserva el producto más reciente por nombre comercial dentro de la allowlist.
--
--   psql "postgresql://USER:PASS@127.0.0.1:5432/DB" -f scripts/cleanup-catalog-duplicates.sql
--
-- Allowlist piloto (3 ramos):
--   Automovil Exelixi TEST
--   Gastos Funerarios Exelixi TEST
--   Accidentes Personales Exelixi TEST

BEGIN;

CREATE TEMP TABLE _catalog_keep AS
SELECT DISTINCT ON ("commercialName") id
FROM "Product"
WHERE "commercialName" IN (
  'Automovil Exelixi TEST',
  'Gastos Funerarios Exelixi TEST',
  'Accidentes Personales Exelixi TEST'
)
ORDER BY "commercialName", "updatedAt" DESC;

DELETE FROM "Product"
WHERE "commercialName" IN (
  'Automovil Exelixi TEST',
  'Gastos Funerarios Exelixi TEST',
  'Accidentes Personales Exelixi TEST'
)
AND id NOT IN (SELECT id FROM _catalog_keep);

-- Duplicados fuera de la allowlist (tests repetidos, demos viejos)
DELETE FROM "Product"
WHERE "commercialName" LIKE '% Exelixi TEST'
  AND "commercialName" NOT IN (
    'Automovil Exelixi TEST',
    'Gastos Funerarios Exelixi TEST',
    'Accidentes Personales Exelixi TEST'
  );

DELETE FROM "Product"
WHERE "commercialName" = 'RCV Obligatorio Demo';

COMMIT;

SELECT "commercialName", "branch", "status", "updatedAt"
FROM "Product"
WHERE "commercialName" IN (
  'Automovil Exelixi TEST',
  'Gastos Funerarios Exelixi TEST',
  'Accidentes Personales Exelixi TEST'
)
ORDER BY "commercialName";
