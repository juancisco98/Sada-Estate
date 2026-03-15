-- ============================================
-- Sistema de Automatizacion Inteligente
-- Tablas: admin_action_logs, automation_rules, automation_history
-- ============================================

-- 1. Tabla de logs de acciones de admin
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id UUID,
    action_payload JSONB NOT NULL DEFAULT '{}',
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_type ON admin_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_created ON admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_user ON admin_action_logs(user_email);

-- RLS: solo admins
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read action logs"
    ON admin_action_logs FOR SELECT
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Admins can insert action logs"
    ON admin_action_logs FOR INSERT
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- 2. Tabla de reglas de automatizacion
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT true,
    confidence_threshold NUMERIC DEFAULT 0.8,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: solo admins
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation rules"
    ON automation_rules FOR ALL
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- 3. Tabla de historial de automatizacion
CREATE TABLE IF NOT EXISTS automation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id UUID,
    status TEXT NOT NULL DEFAULT 'PROPOSED'
        CHECK (status IN ('PROPOSED', 'APPROVED', 'EXECUTED', 'UNDONE', 'REJECTED')),
    action_payload JSONB NOT NULL DEFAULT '{}',
    undo_payload JSONB DEFAULT '{}',
    confidence NUMERIC,
    description TEXT,
    proposed_at TIMESTAMPTZ DEFAULT now(),
    executed_at TIMESTAMPTZ,
    executed_by TEXT,
    undone_at TIMESTAMPTZ,
    undone_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_auto_history_status ON automation_history(status);
CREATE INDEX IF NOT EXISTS idx_auto_history_proposed ON automation_history(proposed_at DESC);

-- RLS: solo admins
ALTER TABLE automation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation history"
    ON automation_history FOR ALL
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- 4. Insertar reglas predeterminadas
INSERT INTO automation_rules (id, name, description, rule_type, conditions, enabled, requires_approval, confidence_threshold, created_by)
VALUES
    (gen_random_uuid(), 'Auto-aprobar pagos confiables',
     'Aprueba automaticamente pagos de inquilinos con 6+ meses consecutivos aprobados',
     'AUTO_APPROVE_PAYMENT',
     '{"min_consecutive_approved": 6, "max_hours_to_approve": 24}',
     false, true, 0.85, 'SYSTEM'),

    (gen_random_uuid(), 'Pre-registrar pagos mensuales',
     'Crea registros de pago pendientes al inicio de cada mes basado en contratos activos',
     'AUTO_REGISTER_PAYMENT',
     '{"day_of_month_range": [1, 5]}',
     false, true, 0.7, 'SYSTEM'),

    (gen_random_uuid(), 'Ajuste automatico por IPC',
     'Propone actualizacion de alquiler cuando el indice IPC esta disponible y la propiedad tiene ajuste programado',
     'AUTO_UPDATE_RENT',
     '{"use_ipc_index": true}',
     false, true, 0.9, 'SYSTEM'),

    (gen_random_uuid(), 'Alerta de mantenimiento estancado',
     'Sugiere completar o escalar tareas de mantenimiento abiertas por mas de 30 dias',
     'AUTO_REMIND',
     '{"stale_days": 30}',
     false, true, 0.6, 'SYSTEM');
