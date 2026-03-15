import { useMemo, useCallback, useState } from 'react';
import { useDataContext } from '../context/DataContext';
import { AutomationRule, AutomationHistoryEntry, AutomationStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { supabaseUpdate, supabaseInsert, supabaseDelete } from '../utils/supabaseHelpers';
import { automationRuleToDb, dbToAutomationHistory } from '../utils/mappers';
import { toast } from 'sonner';
import { ALLOWED_EMAILS } from '../constants';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

export interface AutomationStats {
    totalLogged: number;
    totalProposed: number;
    totalExecuted: number;
    totalUndone: number;
    totalRejected: number;
    pendingProposals: number;
}

export const useAutomation = () => {
    const {
        automationRules, setAutomationRules,
        automationHistory, setAutomationHistory,
        properties, payments, tenants, maintenanceTasks, professionals
    } = useDataContext();

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // ── Stats ──

    const stats: AutomationStats = useMemo(() => ({
        totalLogged: 0, // loaded on-demand from admin_action_logs count
        totalProposed: automationHistory.length,
        totalExecuted: automationHistory.filter(h => h.status === 'EXECUTED').length,
        totalUndone: automationHistory.filter(h => h.status === 'UNDONE').length,
        totalRejected: automationHistory.filter(h => h.status === 'REJECTED').length,
        pendingProposals: automationHistory.filter(h => h.status === 'PROPOSED').length,
    }), [automationHistory]);

    const pendingProposals = useMemo(
        () => automationHistory.filter(h => h.status === 'PROPOSED'),
        [automationHistory]
    );

    // ── Rule management ──

    const toggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
        setAutomationRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
        try {
            await supabaseUpdate('automation_rules', ruleId, { enabled, updated_at: new Date().toISOString() }, 'automation rule toggle');
            toast.success(enabled ? 'Regla activada' : 'Regla desactivada');
        } catch (error: any) {
            setAutomationRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !enabled } : r));
            toast.error(`Error: ${error?.message || 'Error desconocido'}`);
        }
    }, [setAutomationRules]);

    const toggleApprovalRequired = useCallback(async (ruleId: string, requiresApproval: boolean) => {
        setAutomationRules(prev => prev.map(r => r.id === ruleId ? { ...r, requiresApproval } : r));
        try {
            await supabaseUpdate('automation_rules', ruleId, { requires_approval: requiresApproval, updated_at: new Date().toISOString() }, 'automation rule approval toggle');
        } catch (error: any) {
            setAutomationRules(prev => prev.map(r => r.id === ruleId ? { ...r, requiresApproval: !requiresApproval } : r));
            toast.error(`Error: ${error?.message || 'Error desconocido'}`);
        }
    }, [setAutomationRules]);

    const updateConfidenceThreshold = useCallback(async (ruleId: string, threshold: number) => {
        const prev = automationRules.find(r => r.id === ruleId);
        setAutomationRules(rules => rules.map(r => r.id === ruleId ? { ...r, confidenceThreshold: threshold } : r));
        try {
            await supabaseUpdate('automation_rules', ruleId, { confidence_threshold: threshold, updated_at: new Date().toISOString() }, 'automation threshold');
        } catch (error: any) {
            if (prev) setAutomationRules(rules => rules.map(r => r.id === ruleId ? { ...r, confidenceThreshold: prev.confidenceThreshold } : r));
            toast.error(`Error: ${error?.message || 'Error desconocido'}`);
        }
    }, [automationRules, setAutomationRules]);

    // ── Proposal actions ──

    const approveProposal = useCallback(async (historyId: string) => {
        const proposal = automationHistory.find(h => h.id === historyId);
        if (!proposal || proposal.status !== 'PROPOSED') return;

        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData?.session?.user?.email || 'ADMIN';

        try {
            // Execute the proposed action
            const undoPayload = await executeProposedAction(proposal);

            // Update history status
            setAutomationHistory(prev => prev.map(h => h.id === historyId ? {
                ...h,
                status: 'EXECUTED' as AutomationStatus,
                executedAt: new Date().toISOString(),
                executedBy: email,
                undoPayload,
            } : h));

            await supabaseUpdate('automation_history', historyId, {
                status: 'EXECUTED',
                executed_at: new Date().toISOString(),
                executed_by: email,
                undo_payload: undoPayload,
            }, 'approve automation');

            // Create notification for all admins
            for (const adminEmail of ALLOWED_EMAILS) {
                await supabase.from('notifications').insert({
                    id: generateUUID(),
                    recipient_email: adminEmail,
                    title: 'Automatización ejecutada',
                    message: proposal.description || `Se ejecutó: ${proposal.actionType}`,
                    type: 'AUTOMATION_EXECUTED',
                    read: false,
                });
            }

            toast.success('Propuesta aprobada y ejecutada');
        } catch (error: any) {
            toast.error(`Error ejecutando propuesta: ${error?.message || 'Error desconocido'}`);
        }
    }, [automationHistory, setAutomationHistory]);

    const rejectProposal = useCallback(async (historyId: string) => {
        setAutomationHistory(prev => prev.map(h => h.id === historyId ? { ...h, status: 'REJECTED' as AutomationStatus } : h));
        try {
            await supabaseUpdate('automation_history', historyId, { status: 'REJECTED' }, 'reject automation');
            toast.success('Propuesta rechazada');
        } catch (error: any) {
            toast.error(`Error: ${error?.message || 'Error desconocido'}`);
        }
    }, [setAutomationHistory]);

    const undoExecution = useCallback(async (historyId: string) => {
        const entry = automationHistory.find(h => h.id === historyId);
        if (!entry || entry.status !== 'EXECUTED' || !entry.undoPayload) return;

        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData?.session?.user?.email || 'ADMIN';

        try {
            await executeUndo(entry.undoPayload);

            setAutomationHistory(prev => prev.map(h => h.id === historyId ? {
                ...h,
                status: 'UNDONE' as AutomationStatus,
                undoneAt: new Date().toISOString(),
                undoneBy: email,
            } : h));

            await supabaseUpdate('automation_history', historyId, {
                status: 'UNDONE',
                undone_at: new Date().toISOString(),
                undone_by: email,
            }, 'undo automation');

            toast.success('Acción deshecha correctamente');
        } catch (error: any) {
            toast.error(`Error deshaciendo: ${error?.message || 'Error desconocido'}`);
        }
    }, [automationHistory, setAutomationHistory]);

    // ── Trigger AI analysis (manual) ──

    const triggerAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;

            if (!supabaseUrl || !accessToken) {
                throw new Error('No se pudo obtener la sesión de Supabase');
            }

            const response = await fetch(`${supabaseUrl}/functions/v1/smart-automation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    properties: properties.map(p => ({
                        id: p.id, address: p.address, tenantName: p.tenantName,
                        monthlyRent: p.monthlyRent, currency: p.currency, status: p.status,
                        contractEnd: p.contractEnd, contractStart: p.contractStart,
                        adjustmentMonths: p.adjustmentMonths,
                    })),
                    payments: payments.map(p => ({
                        id: p.id, tenantId: p.tenantId, propertyId: p.propertyId,
                        amount: p.amount, month: p.month, year: p.year,
                        status: p.status, paymentDate: p.paymentDate,
                    })),
                    tenants: tenants.map(t => ({
                        id: t.id, name: t.name, propertyId: t.propertyId,
                    })),
                    maintenanceTasks: maintenanceTasks.map(t => ({
                        id: t.id, propertyId: t.propertyId, professionalId: t.professionalId,
                        description: t.description, status: t.status, startDate: t.startDate,
                    })),
                    professionals: professionals.map(p => ({
                        id: p.id, name: p.name, profession: p.profession,
                    })),
                    currentDate: new Date().toISOString().slice(0, 10),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Error ${response.status}`);
            }

            const result = await response.json();
            toast.success(`IA generó ${result.proposalsCreated || 0} propuestas de automatización`);
        } catch (error: any) {
            toast.error(`Error de análisis: ${error?.message || 'Error desconocido'}`);
        } finally {
            setIsAnalyzing(false);
        }
    }, [properties, payments, tenants, maintenanceTasks, professionals]);

    // ── Load action log count ──

    const loadActionLogCount = useCallback(async (): Promise<number> => {
        const { count, error } = await supabase
            .from('admin_action_logs')
            .select('*', { count: 'exact', head: true });
        if (error) return 0;
        return count || 0;
    }, []);

    return {
        automationRules,
        automationHistory,
        pendingProposals,
        stats,
        isAnalyzing,
        toggleRule,
        toggleApprovalRequired,
        updateConfidenceThreshold,
        approveProposal,
        rejectProposal,
        undoExecution,
        triggerAnalysis,
        loadActionLogCount,
    };
};

// ── Internal: execute a proposed action ──

async function executeProposedAction(proposal: AutomationHistoryEntry): Promise<Record<string, unknown>> {
    const { actionType, entityTable, entityId, actionPayload } = proposal;

    if (actionType === 'PAYMENT_APPROVED' && entityId) {
        // Get current state for undo
        const { data } = await supabase.from('tenant_payments').select('status').eq('id', entityId).single();
        const previousStatus = data?.status || 'REVISION';

        await supabaseUpdate('tenant_payments', entityId, { status: 'APPROVED' }, 'auto-approve payment');

        return { type: 'update', table: 'tenant_payments', id: entityId, previous: { status: previousStatus } };
    }

    if (actionType === 'PAYMENT_REGISTERED' && actionPayload) {
        const newId = generateUUID();
        const paymentData = {
            id: newId,
            tenant_id: actionPayload.tenantId as string,
            property_id: actionPayload.propertyId as string || null,
            amount: actionPayload.amount as number,
            currency: (actionPayload.currency as string) || 'ARS',
            month: actionPayload.month as number,
            year: actionPayload.year as number,
            paid_on_time: true,
            payment_date: new Date().toISOString(),
            status: 'PENDING',
        };
        await supabaseInsert('tenant_payments', paymentData, 'auto-register payment');

        return { type: 'delete', table: 'tenant_payments', id: newId };
    }

    if (actionType === 'RENT_UPDATED' && entityId && actionPayload) {
        const { data } = await supabase.from('properties').select('monthly_rent').eq('id', entityId).single();
        const oldRent = data?.monthly_rent;

        await supabaseUpdate('properties', entityId, { monthly_rent: actionPayload.newRent as number }, 'auto-update rent');

        return { type: 'update', table: 'properties', id: entityId, previous: { monthly_rent: oldRent } };
    }

    throw new Error(`Tipo de acción no soportado: ${actionType}`);
}

// ── Internal: undo an executed action ──

async function executeUndo(undoPayload: Record<string, unknown>): Promise<void> {
    const { type, table, id, previous } = undoPayload as {
        type: string; table: string; id: string; previous?: Record<string, unknown>;
    };

    if (type === 'delete' && table && id) {
        await supabaseDelete(table, id, 'undo: delete');
        return;
    }

    if (type === 'update' && table && id && previous) {
        await supabaseUpdate(table, id, previous, 'undo: revert');
        return;
    }

    throw new Error('Undo payload inválido');
}
