-- Ejecutar como superusuario PostgreSQL en srv001 (sin Docker):
--   sudo -u postgres psql -f deploy/setup-db-native.sql

CREATE USER producto_builder WITH PASSWORD 'ProductoBuilder_2026!';

CREATE DATABASE producto_builder OWNER producto_builder;

GRANT ALL PRIVILEGES ON DATABASE producto_builder TO producto_builder;

\c producto_builder
GRANT ALL ON SCHEMA public TO producto_builder;
