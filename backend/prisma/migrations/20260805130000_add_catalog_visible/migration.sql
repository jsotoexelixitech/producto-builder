-- Activar/desactivar productos en el catálogo de emisión sin borrarlos
ALTER TABLE "Product" ADD COLUMN "catalogVisible" BOOLEAN NOT NULL DEFAULT true;
