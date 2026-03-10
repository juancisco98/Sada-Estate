import { useDataContext } from '../context/DataContext';
import { Tenant, TenantPayment, PropertyStatus } from '../types';
import { tenantToDb, paymentToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseDelete, supabaseInsert, supabaseUpdate } from '../utils/supabaseHelpers';
import { toast } from 'sonner';

export const useTenantData = (currentUserId?: string) => {
    const {
        tenants, setTenants,
        payments, setPayments,
        properties, setProperties,
        isLoading: isLoadingTenants
    } = useDataContext();

    const handleSaveTenant = async (tenant: Tenant) => {
        const tenantWithUser = { ...tenant, userId: currentUserId || tenant.userId };
        const prevTenants = [...tenants];
        const prevProperties = [...properties];
        const oldTenant = tenants.find(t => t.id === tenant.id);

        // Update local state for tenants
        setTenants(prev => {
            const exists = prev.find(t => t.id === tenant.id);
            if (exists) return prev.map(t => t.id === tenant.id ? tenantWithUser : t);
            return [...prev, tenantWithUser];
        });

        // Sync with properties table
        const propertyUpdates: Promise<any>[] = [];

        // 1. If property changed, clear the old one
        if (oldTenant && oldTenant.propertyId && oldTenant.propertyId !== tenant.propertyId) {
            const oldProp = properties.find(p => p.id === oldTenant.propertyId);
            if (oldProp) {
                setProperties(prev => prev.map(p => p.id === oldProp.id ? {
                    ...p,
                    tenantName: 'Vacante',
                    tenantPhone: '',
                    status: PropertyStatus.WARNING
                } : p));
                propertyUpdates.push(supabaseUpdate('properties', oldProp.id, {
                    tenant_name: 'Vacante',
                    tenant_phone: '',
                    status: 'WARNING'
                }, `clearing old property ${oldProp.id}`));
            }
        }

        // 2. Update the new/current property
        if (tenant.propertyId) {
            const newProp = properties.find(p => p.id === tenant.propertyId);
            if (newProp) {
                setProperties(prev => prev.map(p => p.id === newProp.id ? {
                    ...p,
                    tenantName: tenant.name,
                    tenantPhone: tenant.phone,
                    status: PropertyStatus.CURRENT
                } : p));
                propertyUpdates.push(supabaseUpdate('properties', newProp.id, {
                    tenant_name: tenant.name,
                    tenant_phone: tenant.phone,
                    status: 'CURRENT'
                }, `syncing property ${newProp.id} with tenant ${tenant.name}`));
            }
        }

        try {
            await Promise.all([
                supabaseUpsert('tenants', tenantToDb(tenantWithUser), `tenant ${tenant.name}`),
                ...propertyUpdates
            ]);
        } catch (error: any) {
            setTenants(prevTenants);
            setProperties(prevProperties);
            toast.error(`Error guardando inquilino: ${error?.message || 'Error desconocido'}`);
            throw error;
        }
    };

    const handleDeleteTenant = async (tenantId: string) => {
        const prevTenants = [...tenants];
        const prevPayments = [...payments];
        const prevProperties = [...properties];
        const tenant = tenants.find(t => t.id === tenantId);

        setTenants(prev => prev.filter(t => t.id !== tenantId));
        setPayments(prev => prev.filter(p => p.tenantId !== tenantId));

        const propertyUpdates: Promise<any>[] = [];
        if (tenant?.propertyId) {
            setProperties(prev => prev.map(p => p.id === tenant.propertyId ? {
                ...p,
                tenantName: 'Vacante',
                tenantPhone: '',
                status: PropertyStatus.WARNING
            } : p));
            propertyUpdates.push(supabaseUpdate('properties', tenant.propertyId, {
                tenant_name: 'Vacante',
                tenant_phone: '',
                status: 'WARNING'
            }, `clearing property ${tenant.propertyId} on tenant deletion`));
        }

        try {
            await Promise.all([
                supabaseDelete('tenants', tenantId, 'tenant'),
                ...propertyUpdates
            ]);
        } catch (error: any) {
            setTenants(prevTenants);
            setPayments(prevPayments);
            setProperties(prevProperties);
            toast.error(`Error al eliminar inquilino: ${error?.message || 'Error desconocido'}`);
            throw error;
        }
    };

    const handleRegisterPayment = async (payment: TenantPayment) => {
        const paymentWithUser = { ...payment, userId: currentUserId };
        const prevPayments = [...payments];

        setPayments(prev => [...prev, paymentWithUser]);

        try {
            await supabaseInsert('tenant_payments', paymentToDb(paymentWithUser), `payment for tenant ${payment.tenantId}`);
        } catch (error: any) {
            setPayments(prevPayments);
            toast.error(`Error registrando el pago: ${error?.message || 'Error desconocido'}`);
            throw error;
        }
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
            const latestPayment = monthPayments[0];
            return {
                month: i + 1,
                amount: monthPayments.reduce((sum, p) => sum + p.amount, 0),
                paid: monthPayments.length > 0,
                status: latestPayment?.status,
                proofUrl: latestPayment?.proofOfPayment,
            };
        });

        const expenseMonthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
            const monthPayments = tenantPayments.filter(p => p.month === i + 1 && p.year === currentYear);
            const withExpenses = monthPayments.find(p => p.proofOfExpenses || (p.expenseAmount ?? 0) > 0);
            return {
                month: i + 1,
                amount: monthPayments.reduce((sum, p) => sum + (p.expenseAmount ?? 0), 0),
                paid: monthPayments.some(p => p.proofOfExpenses || (p.expenseAmount ?? 0) > 0),
                status: withExpenses?.status,
                proofUrl: withExpenses?.proofOfExpenses,
            };
        });

        return {
            totalPaid,
            totalPayments,
            onTimePayments,
            onTimeRate: Math.round(onTimeRate),
            monthlyBreakdown,
            expenseMonthlyBreakdown,
            currency: tenantPayments[0]?.currency || 'ARS',
        };
    };

    const handleUpdatePayment = async (payment: TenantPayment) => {
        const prevPayments = [...payments];
        setPayments(prev => prev.map(p => p.id === payment.id ? payment : p));

        try {
            await supabaseUpdate('tenant_payments', payment.id, paymentToDb(payment), `payment ${payment.id}`);
        } catch (error: any) {
            setPayments(prevPayments);
            toast.error(`Error actualizando el pago: ${error?.message || 'Error desconocido'}`);
            throw error;
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
