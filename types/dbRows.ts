/**
 * Database row types matching Supabase snake_case schema.
 * Used to replace `any` in mapper functions.
 */

export interface DbBuildingRow {
    id: string;
    address: string;
    coordinates: [number, number];
    country: string;
    currency: string;
    image_url?: string | null;
    notes?: string | null;
    user_id?: string | null;
    created_at?: string;
}

export interface DbPropertyRow {
    id: string;
    address: string;
    tenant_name: string;
    tenant_phone?: string | null;
    image_url?: string | null;
    status: string;
    monthly_rent: number | string;
    coordinates: [number, number];
    contract_end: string;
    last_payment_date: string;
    assigned_professional_id?: string | null;
    professional_assigned_date?: string | null;
    maintenance_task_description?: string | null;
    notes?: string | null;
    last_modified_by?: string | null;
    rooms?: number | null;
    square_meters?: number | string | null;
    country: string;
    currency: string;
    exchange_rate?: number | string | null;
    building_id?: string | null;
    unit_label?: string | null;
    property_type?: string | null;
    user_id?: string | null;
    created_at?: string;
    contract_start?: string | null;
    adjustment_months?: number | null;
}

export interface DbProfessionalRow {
    id: string;
    name: string;
    profession: string;
    rating: number | string;
    speed_rating: number | string;
    zone: string;
    phone: string;
    reviews?: { rating: number; comment: string; date: string }[] | null;
    user_id?: string | null;
    created_at?: string;
}

export interface DbMaintenanceTaskRow {
    id: string;
    property_id: string;
    professional_id: string;
    description: string;
    status: string;
    start_date: string;
    estimated_cost: number | string;
    cost?: number | string | null;
    end_date?: string | null;
    partial_expenses?: { id: string; description: string; amount: number; date: string; by: string }[] | null;
    user_id?: string | null;
    created_at?: string;
}

export interface DbTenantRow {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    property_id?: string | null;
    user_id?: string | null;
    created_at?: string;
}

export interface DbExpenseSheetRow {
    id: string;
    tenant_id: string;
    month: number;
    year: number;
    sheet_data: any[][];
    sheet_name?: string | null;
    uploaded_at?: string;
    uploaded_by?: string | null;
}

export interface DbTenantPaymentRow {
    id: string;
    tenant_id: string;
    property_id?: string | null;
    amount: number | string;
    currency: string;
    month: number;
    year: number;
    paid_on_time: boolean;
    payment_date: string;
    payment_method?: string | null;
    proof_of_payment?: string | null;
    proof_of_expenses?: string | null;
    expense_amount?: number | null;
    status?: string | null;
    notes?: string | null;
    user_id?: string | null;
    created_at?: string;
}

export interface DbReminderRow {
    id: string;
    user_id: string;
    title: string;
    description?: string | null;
    due_date: string;
    entity_type?: string | null;
    entity_id?: string | null;
    completed: boolean;
    created_at?: string;
}

// ========== AUTOMATION TABLES ==========

export interface DbAdminActionLogRow {
    id: string;
    user_email: string;
    action_type: string;
    entity_table: string;
    entity_id?: string | null;
    action_payload: Record<string, unknown>;
    context?: Record<string, unknown> | null;
    created_at?: string;
}

export interface DbAutomationRuleRow {
    id: string;
    name: string;
    description?: string | null;
    rule_type: string;
    conditions: Record<string, unknown>;
    enabled: boolean;
    requires_approval: boolean;
    confidence_threshold: number | string;
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface DbAutomationHistoryRow {
    id: string;
    rule_id?: string | null;
    action_type: string;
    entity_table: string;
    entity_id?: string | null;
    status: string;
    action_payload: Record<string, unknown>;
    undo_payload?: Record<string, unknown> | null;
    confidence?: number | string | null;
    description?: string | null;
    proposed_at?: string;
    executed_at?: string | null;
    executed_by?: string | null;
    undone_at?: string | null;
    undone_by?: string | null;
}
