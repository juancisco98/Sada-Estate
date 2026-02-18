import { useState, useEffect } from 'react';
import { Tenant, TenantPayment } from '../types';
import { supabase } from '../services/supabaseClient';

// ========== MAPPERS ==========

const dbToTenant = (row: any): Tenant => ({
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    propertyId: row.property_id,
});

const tenantToDb = (t: Tenant): Record<string, any> => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    email: t.email,
    property_id: t.propertyId || null,
});

const dbToPayment = (row: any): TenantPayment => ({
    id: row.id,
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    amount: Number(row.amount),
    currency: row.currency,
    month: row.month,
    year: row.year,
    paidOnTime: row.paid_on_time,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method || 'CASH',
    proofOfPayment: row.proof_of_payment,
    notes: row.notes,
});

const paymentToDb = (p: TenantPayment): Record<string, any> => ({
    id: p.id,
    tenant_id: p.tenantId,
    property_id: p.propertyId || null,
    amount: p.amount,
    currency: p.currency,
    month: p.month,
    year: p.year,
    paid_on_time: p.paidOnTime,
    payment_date: p.paymentDate,
    payment_method: p.paymentMethod,
    proof_of_payment: p.proofOfPayment,
    notes: p.notes,
});

// ========== HOOK ==========

export const useTenantData = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [payments, setPayments] = useState<TenantPayment[]>([]);
    const [isLoadingTenants, setIsLoadingTenants] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoadingTenants(true);
            try {
                const { data: tData } = await supabase
                    .from('tenants')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (tData && tData.length > 0) {
                    setTenants(tData.map(dbToTenant));
                    console.log(`[Supabase] ✅ Loaded ${tData.length} tenants`);
                }

                const { data: pData } = await supabase
                    .from('tenant_payments')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (pData && pData.length > 0) {
                    setPayments(pData.map(dbToPayment));
                    console.log(`[Supabase] ✅ Loaded ${pData.length} tenant payments`);
                }
            } catch (error) {
                console.error('[Supabase] ❌ Error loading tenant data:', error);
            } finally {
                setIsLoadingTenants(false);
            }
        };
        load();
    }, []);

    // ========== TENANT CRUD ==========

    const handleSaveTenant = async (tenant: Tenant) => {
        setTenants(prev => {
            const exists = prev.find(t => t.id === tenant.id);
            if (exists) return prev.map(t => t.id === tenant.id ? tenant : t);
            return [...prev, tenant];
        });

        try {
            const { error } = await supabase
                .from('tenants')
                .upsert(tenantToDb(tenant), { onConflict: 'id' });
            if (error) console.error('[Supabase] ❌ Error saving tenant:', error);
            else console.log(`[Supabase] ✅ Tenant saved: ${tenant.name}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception saving tenant:', err);
        }
    };

    const handleDeleteTenant = async (tenantId: string) => {
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        setPayments(prev => prev.filter(p => p.tenantId !== tenantId));

        try {
            const { error } = await supabase
                .from('tenants')
                .delete()
                .eq('id', tenantId);
            if (error) console.error('[Supabase] ❌ Error deleting tenant:', error);
            else console.log(`[Supabase] ✅ Tenant deleted: ${tenantId}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception deleting tenant:', err);
        }
    };

    // ========== PAYMENT CRUD ==========

    const handleRegisterPayment = async (payment: TenantPayment) => {
        setPayments(prev => [...prev, payment]);

        try {
            const { error } = await supabase
                .from('tenant_payments')
                .insert(paymentToDb(payment));
            if (error) console.error('[Supabase] ❌ Error registering payment:', error);
            else console.log(`[Supabase] ✅ Payment registered for tenant: ${payment.tenantId}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception registering payment:', err);
        }
    };

    // ========== METRICS ==========

    const getTenantMetrics = (tenantId: string) => {
        const tenantPayments = payments.filter(p => p.tenantId === tenantId);
        const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPayments = tenantPayments.length;
        const onTimePayments = tenantPayments.filter(p => p.paidOnTime).length;
        const onTimeRate = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;

        // Monthly breakdown (current year)
        const currentYear = new Date().getFullYear();
        const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
            const monthPayments = tenantPayments.filter(p => p.month === i + 1 && p.year === currentYear);
            return {
                month: i + 1,
                amount: monthPayments.reduce((sum, p) => sum + p.amount, 0),
                paid: monthPayments.length > 0,
            };
        });

        return {
            totalPaid,
            totalPayments,
            onTimePayments,
            onTimeRate: Math.round(onTimeRate),
            monthlyBreakdown,
            currency: tenantPayments[0]?.currency || 'ARS',
        };
    };

    const handleUpdatePayment = async (payment: TenantPayment) => {
        setPayments(prev => prev.map(p => p.id === payment.id ? payment : p));

        try {
            const { error } = await supabase
                .from('tenant_payments')
                .update(paymentToDb(payment))
                .eq('id', payment.id);

            if (error) console.error('[Supabase] ❌ Error updating payment:', error);
            else console.log(`[Supabase] ✅ Payment updated: ${payment.id}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception updating payment:', err);
        }
    };

    return {
        tenants,
        payments,
        isLoadingTenants,
        handleSaveTenant,
        handleDeleteTenant,
        handleRegisterPayment,
        handleUpdatePayment,
        getTenantMetrics,
    };
};
