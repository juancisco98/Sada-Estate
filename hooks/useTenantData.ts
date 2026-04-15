import { useCallback, useMemo } from 'react';
import { useDataContext } from '../context/DataContext';
import { Tenant, TenantPayment, PropertyStatus } from '../types';
import { errorMessage } from '../utils/errorHandler';
import { tenantToDb, paymentToDb } from '../utils/mappers';
import { supabase } from '../services/supabaseClient';
import { supabaseUpsert, supabaseDelete, supabaseInsert, supabaseUpdate } from '../utils/supabaseHelpers';
import { logAdminAction } from '../services/actionLogger';
import { toast } from 'sonner';

export const useTenantData = (currentUserId?: string) => {
    const {
        tenants, setTenants,
        payments, setPayments,
        properties, setProperties,
        isLoading: isLoadingTenants,
        refreshData,
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
        const propertyUpdates: Promise<unknown>[] = [];

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
            logAdminAction({
                actionType: 'TENANT_CREATED',
                entityTable: 'tenants',
                entityId: tenant.id,
                actionPayload: { name: tenant.name, phone: tenant.phone, email: tenant.email, propertyId: tenant.propertyId },
            });
        } catch (error) {
            setTenants(prevTenants);
            setProperties(prevProperties);
            const errObj = error as { message?: string; code?: string } | null | undefined;
            const msg = String(errObj?.message || '');
            const code = String(errObj?.code || '');
            const isFkViolation = code === '23503' || /foreign key constraint/i.test(msg);
            if (isFkViolation && /property_id/i.test(msg)) {
                toast.error('La propiedad seleccionada ya no existe. Refrescamos los datos — volvé a intentar.');
                refreshData().catch(() => { /* silencioso: el toast ya avisó */ });
            } else {
                toast.error(`Error guardando inquilino: ${msg || 'Error desconocido'}`);
            }
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

        const propertyUpdates: Promise<unknown>[] = [];
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
        } catch (error) {
            setTenants(prevTenants);
            setPayments(prevPayments);
            setProperties(prevProperties);
            toast.error(`Error al eliminar inquilino: ${errorMessage(error) || 'Error desconocido'}`);
            throw error;
        }
    };

    const handleRegisterPayment = async (payment: TenantPayment) => {
        const paymentWithUser = { ...payment, userId: currentUserId };
        const prevPayments = [...payments];

        setPayments(prev => [...prev, paymentWithUser]);

        try {
            await supabaseInsert('tenant_payments', paymentToDb(paymentWithUser), `payment for tenant ${payment.tenantId}`);
            logAdminAction({
                actionType: 'PAYMENT_REGISTERED',
                entityTable: 'tenant_payments',
                entityId: payment.id,
                actionPayload: { tenantId: payment.tenantId, amount: payment.amount, month: payment.month, year: payment.year, status: payment.status },
            });
        } catch (error) {
            setPayments(prevPayments);
            toast.error(`Error registrando el pago: ${errorMessage(error) || 'Error desconocido'}`);
            throw error;
        }
    };

    const paymentsByTenant = useMemo(() => {
        const map = new Map<string, TenantPayment[]>();
        for (const p of payments) {
            if (!p.tenantId) continue;
            const arr = map.get(p.tenantId);
            if (arr) arr.push(p);
            else map.set(p.tenantId, [p]);
        }
        return map;
    }, [payments]);

    const tenantMetricsCache = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const cache = new Map<string, {
            totalPaid: number;
            totalExpenses: number;
            totalPayments: number;
            onTimePayments: number;
            onTimeRate: number;
            monthlyBreakdown: Array<{ month: number; amount: number; paid: boolean; status?: TenantPayment['status']; proofUrl?: string }>;
            expenseMonthlyBreakdown: Array<{ month: number; amount: number; paid: boolean; status?: TenantPayment['status']; proofUrl?: string }>;
            currency: string;
        }>();

        for (const [tenantId, tenantPayments] of paymentsByTenant) {
            const totalPayments = tenantPayments.length;
            let onTimePayments = 0;
            const uniqueByMonth = new Map<string, TenantPayment>();
            const byMonthCurrentYear: TenantPayment[][] = Array.from({ length: 12 }, () => []);

            for (const p of tenantPayments) {
                if (p.paidOnTime) onTimePayments++;
                const key = `${p.year}-${p.month}`;
                if (!uniqueByMonth.has(key)) uniqueByMonth.set(key, p);
                if (p.year === currentYear && p.month >= 1 && p.month <= 12) {
                    byMonthCurrentYear[p.month - 1].push(p);
                }
            }

            let totalPaid = 0;
            let totalExpenses = 0;
            for (const p of uniqueByMonth.values()) {
                if (p.status === 'APPROVED') {
                    totalPaid += p.amount;
                    totalExpenses += p.expenseAmount ?? 0;
                }
            }

            const monthlyBreakdown = byMonthCurrentYear.map((monthPayments, i) => {
                const latestPayment = monthPayments[0];
                let paid = false;
                for (const p of monthPayments) {
                    if (p.status === 'APPROVED') { paid = true; break; }
                }
                return {
                    month: i + 1,
                    amount: latestPayment?.amount || 0,
                    paid,
                    status: latestPayment?.status,
                    proofUrl: latestPayment?.proofOfPayment,
                };
            });

            const expenseMonthlyBreakdown = byMonthCurrentYear.map((monthPayments, i) => {
                let withExpenses: TenantPayment | undefined;
                let paid = false;
                for (const p of monthPayments) {
                    const has = !!p.proofOfExpenses || (p.expenseAmount ?? 0) > 0;
                    if (has) {
                        paid = true;
                        if (!withExpenses) withExpenses = p;
                    }
                }
                return {
                    month: i + 1,
                    amount: withExpenses?.expenseAmount || 0,
                    paid,
                    status: withExpenses?.status,
                    proofUrl: withExpenses?.proofOfExpenses,
                };
            });

            cache.set(tenantId, {
                totalPaid,
                totalExpenses,
                totalPayments,
                onTimePayments,
                onTimeRate: totalPayments > 0 ? Math.round((onTimePayments / totalPayments) * 100) : 0,
                monthlyBreakdown,
                expenseMonthlyBreakdown,
                currency: tenantPayments[0]?.currency || 'ARS',
            });
        }
        return cache;
    }, [paymentsByTenant]);

    const emptyMetrics = useMemo(() => ({
        totalPaid: 0,
        totalExpenses: 0,
        totalPayments: 0,
        onTimePayments: 0,
        onTimeRate: 0,
        monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0, paid: false })),
        expenseMonthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0, paid: false })),
        currency: 'ARS',
    }), []);

    const getTenantMetrics = useCallback((tenantId: string) => {
        return tenantMetricsCache.get(tenantId) ?? emptyMetrics;
    }, [tenantMetricsCache, emptyMetrics]);

    const handleDeletePayment = async (payment: TenantPayment): Promise<void> => {
        const prevPayments = [...payments];
        // Optimistic: sacar del state local primero
        setPayments(prev => prev.filter(p => p.id !== payment.id));

        const isNetworkError = (err: unknown) => {
            const msg = errorMessage(err);
            return err instanceof TypeError || /failed to fetch|network|load failed/i.test(msg);
        };

        const attemptDelete = async () => {
            const { error } = await supabase.from('tenant_payments').delete().eq('id', payment.id);
            if (error) throw error;
        };

        try {
            try {
                await attemptDelete();
            } catch (err) {
                if (!isNetworkError(err)) throw err;
                // Reintento único tras 1.2s (suele cubrir cortes momentáneos de red / service worker)
                await new Promise(r => setTimeout(r, 1200));
                await attemptDelete();
            }
            logAdminAction({
                actionType: 'PAYMENT_DELETED',
                entityTable: 'tenant_payments',
                entityId: payment.id,
                actionPayload: { tenantId: payment.tenantId, month: payment.month, year: payment.year, amount: payment.amount },
            });
        } catch (error) {
            setPayments(prevPayments);
            const friendly = isNetworkError(error)
                ? 'No se pudo conectar al servidor. Revisá tu conexión y volvé a intentar.'
                : `Error al eliminar el pago: ${errorMessage(error) || 'Error desconocido'}`;
            toast.error(friendly);
            throw error;
        }
    };

    const handleUpdatePayment = async (payment: TenantPayment) => {
        const prevPayments = [...payments];
        const oldPayment = payments.find(p => p.id === payment.id);
        setPayments(prev => prev.map(p => p.id === payment.id ? payment : p));

        try {
            await supabaseUpdate('tenant_payments', payment.id, paymentToDb(payment), `payment ${payment.id}`);
            if (payment.status === 'APPROVED' && oldPayment?.status !== 'APPROVED') {
                logAdminAction({
                    actionType: 'PAYMENT_APPROVED',
                    entityTable: 'tenant_payments',
                    entityId: payment.id,
                    actionPayload: { tenantId: payment.tenantId, amount: payment.amount, month: payment.month, year: payment.year, previousStatus: oldPayment?.status },
                });
            }
        } catch (error) {
            setPayments(prevPayments);
            toast.error(`Error actualizando el pago: ${errorMessage(error) || 'Error desconocido'}`);
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
        handleDeletePayment,
        getTenantMetrics,
    };
};
