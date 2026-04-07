-- Agrega columna parsed_data a expense_sheets para guardar el desglose estructurado
-- (conceptos + montos + total) que se le muestra al inquilino sin depender del
-- formato exacto del Excel original. Nullable: las filas viejas se siguen
-- parseando al vuelo desde sheet_data en el cliente.

ALTER TABLE expense_sheets
    ADD COLUMN IF NOT EXISTS parsed_data JSONB;
