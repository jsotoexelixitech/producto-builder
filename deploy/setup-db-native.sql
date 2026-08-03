-- Ejecutar en srv001 (postgres no puede leer ~/jsoto — usar pipe):
--   cat deploy/setup-db-native.sql | sudo -u postgres psql

CREATE USER producto_builder WITH PASSWORD 'ProductoBuilder_2026!';

CREATE DATABASE producto_builder OWNER producto_builder;

GRANT ALL PRIVILEGES ON DATABASE producto_builder TO producto_builder;

\c producto_builder
GRANT ALL ON SCHEMA public TO producto_builder;
