import { useDataContext } from '../context/DataContext';
import { Tenant, TenantPayment } from '../types';
import { tenantToDb, paymentToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseDelete, supabaseInsert, supabaseUpdate } from '../utils/supabaseHelpers';

export const useTenantData = (currentUserId?: string) => {
    const {
        tenants, setTenants,
        payments, setPayments,
        isLoading: isLoadingTenants
    } = useDataContext();

    const handleSaveTenant = async (tenant: Tenant) => {
        const tenantWithUser = { ...tenant, userId: currentUserId };
        setTenants(prev => {
            const exists = prev.find(t => t.id === tenant.id);
            if (exists) return prev.map(t => t.id === tenant.id ? tenantWithUser : t);
            return [...prev, tenantWithUser];
        });

        await supabaseUpsert('tenants', tenantToDb(tenantWithUser), `tenant ${tenant.name}`);
    };

    const handleDeleteTenant = async (tenantId: string) => {
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        setPayments(prev => prev.filter(p => p.tenantId !== tenantId));
        await supabaseDelete('tenants', tenantId, 'tenant');
    };

    const handleRegisterPayment = async (payment: TenantPayment) => {
        const paymentWithUser = { ...payment, userId: currentUserId };
        setPayments(prev => [...prev, paymentWithUser]);
        await supabaseInsert('tenant_payments', paymentToDb(paymentWithUser), `payment for tenant ${payment.tenantId}`);
    };

    const getTenantMetrics = (tenantId: string) => {
        const tenantPayments = payments.filter(p => p.tenantId === tenantId);
        const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPayments = tenantPayments.length;
        const onTimePayments = tenantPayments.filter(p => p.paidOnTime).length;
        const onTimeRate = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;

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
        await supabaseUpdate('tenant_payments', payment.id, paymentToDb(payment), `payment ${payment.id}`);
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
