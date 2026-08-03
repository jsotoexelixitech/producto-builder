-- PostgreSQL nativo en srv001 (sin Docker).
-- El usuario postgres NO puede leer ~/jsoto — ejecutar SIEMPRE con pipe:
--   cd ~/producto-builder && cat deploy/setup-db-native.sql | sudo -u postgres psql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'producto_builder') THEN
    CREATE USER producto_builder WITH PASSWORD 'ProductoBuilder_2026!';
  ELSE
    ALTER USER producto_builder WITH PASSWORD 'ProductoBuilder_2026!';
  END IF;
END
$$;

SELECT 'CREATE DATABASE producto_builder OWNER producto_builder'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'producto_builder')\gexec

GRANT ALL PRIVILEGES ON DATABASE producto_builder TO producto_builder;

\c producto_builder
GRANT ALL ON SCHEMA public TO producto_builder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO producto_builder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO producto_builder;
