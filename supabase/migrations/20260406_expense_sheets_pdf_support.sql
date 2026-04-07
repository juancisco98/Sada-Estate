-- Soporte de liquidaciones en formato PDF.
-- Nora puede subir Excel (parseado a items + total) o PDF (archivo crudo + total
-- ingresado manualmente). El inquilino ve la representación adecuada según el tipo.

ALTER TABLE expense_sheets
    ADD COLUMN IF NOT EXISTS pdf_url TEXT;

ALTER TABLE expense_sheets
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'excel'
        CHECK (source_type IN ('excel', 'pdf'));
