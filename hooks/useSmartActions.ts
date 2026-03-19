import { useMemo, useCallback, useState } from 'react';
import { useDataContext } from '../context/DataContext';
import { TenantPayment, AutomationHistoryEntry, AutomationStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { supabaseUpdate } from '../utils/supabaseHelpers';
import { logAdminAction } from '../services/actionLogger';
import { toast } from 'sonner';
import { MONTH_NAMES, ALLOWED_EMAILS } from '../constants';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

export interface SmartAction {
    id: string;
    type: 'AUTO_APPROVE' | 'STALE_REVIEW';
    title: string;
    evidence: string;
    monthLabel: string;
    payment: TenantPayment;
}

const DISMISSED_KEY = 'sada_dismissed_smart_actions';

function getDismissed(): Set<string> {
    try {
        const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
        const now = new Date();
        // Reset dismissed monthly
        if (stored.month !== now.getMonth() || stored.year !== now.getFullYear()) {
            localStorage.removeItem(DISMISSED_KEY);
            return new Set();
        }
        return new Set<string>(stored.ids || []);
    } catch {
        return new Set();
    }
}

function setDismissed(ids: Set<string>) {
    const now = new Date();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify({
        month: now.getMonth(),
        year: now.getFullYear(),
        ids: Array.from(ids),
    }));
}

function countConsecutiveApproved(tenantId: string, beforeMonth: number, beforeYear: number, payments: TenantPayment[]): number {
    const tenantPayments = payments
        .filter(p => p.tenantId === tenantId && p.status === 'APPROVED')
        .map(p => ({ key: p.year * 12 + p.month, month: p.month, year: p.year }))
        .sort((a, b) => b.key - a.key);

    let count = 0;
    let expectedKey = beforeYear * 12 + beforeMonth - 1; // month before the current one

    for (const p of tenantPayments) {
        if (p.key === expectedKey) {
            count++;
            expectedKey--;
        } else if (p.key < expectedKey) {
            break;
        }
    }
    return count;
}

export const useSmartActions = () => {
    const { payments, setPayments, tenants, automationHistory, setAutomationHistory } = useDataContext();
    const [dismissed, setDismissedState] = useState<Set<string>>(getDismissed);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const smartActions: SmartAction[] = useMemo(() => {
        const actions: SmartAction[] = [];

        const revisionPayments = payments.filter(p =>
            p.status === 'REVISION' &&
            ((p.expenseAmount ?? 0) > 0 || !!p.proofOfExpenses)
        );

        for (const payment of revisionPayments) {
            const actionId = `auto-approve-${payment.id}`;
            if (dismissed.has(actionId)) continue;

            const consecutive = countConsecutiveApproved(payment.tenantId, payment.month, payment.year, payments);
            const tenant = tenants.find(t => t.id === payment.tenantId);
            const monthLabel = `${MONTH_NAMES[payment.month - 1]} ${payment.year}`;

            if (consecutive >= 6) {
                actions.push({
                    id: actionId,
                    type: 'AUTO_APPROVE',
                    title: `Aprobar pago de ${tenant?.name || 'inquilino'}`,
                    evidence: `${consecutive} meses consecutivos aprobados`,
                    monthLabel,
                    payment,
                });
            }

            // Stale review (>3 days in REVISION)
            if (payment.paymentDate) {
                const daysSince = Math.floor((Date.now() - new Date(payment.paymentDate).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince > 3) {
                    const staleId = `stale-review-${payment.id}`;
                    if (!dismissed.has(staleId)) {
                        actions.push({
                            id: staleId,
                            type: 'STALE_REVIEW',
                            title: `Revisión pendiente de ${tenant?.name || 'inquilino'}`,
                            evidence: `Hace ${daysSince} días en revisión`,
                            monthLabel,
                            payment,
                        });
                    }
                }
            }
        }

        return actions;
    }, [payments, tenants, dismissed]);

    const executeSmartAction = useCallback(async (action: SmartAction) => {
        setActionLoading(action.id);
        try {
            // Get current status for undo
            const { data: currentData } = await supabase
                .from('tenant_payments')
                .select('status')
                .eq('id', action.payment.id)
                .single();
            const previousStatus = currentData?.status || 'REVISION';

            // Approve the payment
            const { error } = await supabase
                .from('tenant_payments')
                .update({ status: 'APPROVED' })
                .eq('id', action.payment.id);
            if (error) throw error;

            setPayments(prev => prev.map(p =>
                p.id === action.payment.id ? { ...p, status: 'APPROVED' } : p
            ));

            // Log the action
            logAdminAction({
                actionType: 'PAYMENT_APPROVED',
                entityTable: 'tenant_payments',
                entityId: action.payment.id,
                actionPayload: { source: 'smart_action', type: action.type, evidence: action.evidence },
            });

            // Record in automation_history
            const historyId = generateUUID();
            const { data: sessionData } = await supabase.auth.getSession();
            const email = sessionData?.session?.user?.email || 'ADMIN';

            await supabase.from('automation_history').insert({
                id: historyId,
                action_type: 'PAYMENT_APPROVED',
                entity_table: 'tenant_payments',
                entity_id: action.payment.id,
                status: 'EXECUTED',
                action_payload: { amount: action.payment.expenseAmount, month: action.payment.month, year: action.payment.year },
                undo_payload: { type: 'update', table: 'tenant_payments', id: action.payment.id, previous: { status: previousStatus } },
                confidence: 1.0,
                description: `${action.title} — ${action.evidence}`,
                proposed_at: new Date().toISOString(),
                executed_at: new Date().toISOString(),
                executed_by: email,
            });

            // Notify tenant
            const tenant = tenants.find(t => t.id === action.payment.tenantId);
            if (tenant?.email) {
                await supabase.from('notifications').insert({
                    recipient_email: tenant.email,
                    title: 'Pago aprobado ✓',
                    message: `Tu pago de expensas de ${action.monthLabel} fue aprobado.`,
                    type: 'PAYMENT_APPROVED',
                    payment_id: action.payment.id,
                    read: false,
                });
            }

            toast.success(`Pago de ${action.monthLabel} aprobado`);
        } catch (error: any) {
            toast.error(`Error: ${error?.message || 'Error desconocido'}`);
        } finally {
            setActionLoading(null);
        }
    }, [setPayments, tenants]);

    const dismissSmartAction = useCallback((actionId: string) => {
        const next = new Set<string>(dismissed);
        next.add(actionId);
        setDismissedState(next);
        setDismissed(next);
    }, [dismissed]);

    const executedActions: AutomationHistoryEntry[] = useMemo(() =>
        automationHistory
            .filter(h => h.status === 'EXECUTED')
            .sort((a, b) => (b.executedAt || b.proposedAt).localeCompare(a.executedAt || a.proposedAt))
            .slice(0, 10),
        [automationHistory]
    );

    return {
        smartActions,
        executeSmartAction,
        dismissSmartAction,
        executedActions,
        actionLoading,
    };
};
