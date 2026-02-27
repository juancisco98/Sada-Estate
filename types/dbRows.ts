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
    notes?: string | null;
    user_id?: string | null;
    created_at?: string;
}
