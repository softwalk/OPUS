-- Migration 017: Add token and updated_at columns to sesiones_cliente
-- The loginCliente function stores a session token for later validation,
-- but the original schema was missing these columns.

ALTER TABLE sesiones_cliente ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE sesiones_cliente ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
