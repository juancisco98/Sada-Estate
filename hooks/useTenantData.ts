import { useDataContext } from '../context/DataContext';
import { Tenant, TenantPayment } from '../types';
import { supabase } from '../services/supabaseClient';
import { tenantToDb, paymentToDb } from '../utils/mappers';

// ========== HOOK ==========

export const useTenantData = (currentUserId?: string) => {
    const {
        tenants, setTenants,
        payments, setPayments,
        isLoading: isLoadingTenants
    } = useDataContext();

    // ========== TENANT CRUD ==========

    const handleSaveTenant = async (tenant: Tenant) => {
        const tenantWithUser = { ...tenant, userId: currentUserId };
        setTenants(prev => {
            const exists = prev.find(t => t.id === tenant.id);
            if (exists) return prev.map(t => t.id === tenant.id ? tenantWithUser : t);
            return [...prev, tenantWithUser];
        });

        try {
            const { error } = await supabase
                .from('tenants')
                .upsert(tenantToDb(tenantWithUser), { onConflict: 'id' });
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
        const paymentWithUser = { ...payment, userId: currentUserId };
        setPayments(prev => [...prev, paymentWithUser]);

        try {
            const { error } = await supabase
                .from('tenant_payments')
                .insert(paymentToDb(paymentWithUser));
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
