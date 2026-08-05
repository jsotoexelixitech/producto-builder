-- priceFactor guarda prima total del plan; Decimal(8,4) desbordaba valores >= 10000.
ALTER TABLE "ProductPlan" ALTER COLUMN "priceFactor" TYPE DECIMAL(18,4);
