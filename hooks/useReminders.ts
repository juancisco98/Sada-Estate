import { useState, useMemo, useCallback } from 'react';
import { useDataContext } from '../context/DataContext';
import { ManualReminder, SmartReminder, SmartReminderType, Property, TenantPayment, MaintenanceTask, ReminderEntityType, TaskStatus } from '../types';
import { reminderToDb } from '../utils/mappers';
import { supabase } from '../services/supabaseClient';
import { generateAIReminders, AIReminderRequest, AIReminderResponse } from '../services/aiService';
import { logAdminAction } from '../services/actionLogger';
import { toast } from 'sonner';
import {
    CONTRACT_EXPIRY_WARNING_DAYS,
    MAINTENANCE_STALE_DAYS,
    PAYMENT_REVISION_STALE_DAYS,
    PAYMENT_OVERDUE_DAY
} from '../constants';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

// ── Urgency computation ──

function getUrgency(dueDate: string, completed: boolean): SmartReminder['urgency'] {
    if (completed) return 'done';
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'urgent';
    return 'upcoming';
}

// ── Rule-based smart reminders ──

function computeRuleBasedReminders(
    properties: Property[],
    payments: TenantPayment[],
    maintenanceTasks: MaintenanceTask[]
): SmartReminder[] {
    const now = new Date();
    const results: SmartReminder[] = [];

    // 1. CONTRACT EXPIRING within N days
    for (const prop of properties) {
        if (!prop.contractEnd || !prop.tenantName || prop.tenantName === 'Vacante') continue;
        const endDate = new Date(prop.contractEnd + 'T12:00:00');
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= CONTRACT_EXPIRY_WARNING_DAYS && diffDays > -CONTRACT_EXPIRY_WARNING_DAYS) {
            results.push({
                id: `auto-contract-${prop.id}`,
                title: `Contrato vence: ${prop.tenantName}`,
                description: `${prop.address} — Vence el ${endDate.toLocaleDateString('es-AR')}`,
                dueDate: prop.contractEnd,
                type: 'CONTRACT_EXPIRY',
                source: 'auto',
                entityType: 'property',
                entityId: prop.id,
                completed: false,
                urgency: getUrgency(prop.contractEnd, false),
            });
        }
    }

    // 2. RENT ADJUSTMENT DUE this month
    for (const prop of properties) {
        if (!prop.contractStart || !prop.adjustmentMonths || !prop.tenantName || prop.tenantName === 'Vacante') continue;
        const start = new Date(prop.contractStart + 'T12:00:00');
        const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        if (monthsSinceStart > 0 && monthsSinceStart % prop.adjustmentMonths === 0) {
            const adjustDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            results.push({
                id: `auto-adjustment-${prop.id}-${now.getFullYear()}-${now.getMonth()}`,
                title: `Ajuste de alquiler: ${prop.tenantName}`,
                description: `${prop.address} — Ajuste cada ${prop.adjustmentMonths} meses por IPC`,
                dueDate: adjustDate,
                type: 'RENT_ADJUSTMENT_DUE',
                source: 'auto',
                entityType: 'property',
                entityId: prop.id,
                completed: false,
                urgency: 'urgent',
            });
        }
    }

    // 3. MAINTENANCE STALE (>N days without completion)
    for (const task of maintenanceTasks) {
        if (task.status === TaskStatus.COMPLETED) continue;
        const startDate = new Date(task.startDate);
        const daysSinceStart = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceStart > MAINTENANCE_STALE_DAYS) {
            const prop = properties.find(p => p.id === task.propertyId);
            results.push({
                id: `auto-maintenance-${task.id}`,
                title: `Obra sin actualizar`,
                description: `${prop?.address || 'Propiedad'} — "${task.description}" — ${daysSinceStart} días desde inicio`,
                dueDate: task.startDate,
                type: 'MAINTENANCE_STALE',
                source: 'auto',
                entityType: 'maintenance_task',
                entityId: task.id,
                completed: false,
                urgency: 'overdue',
            });
        }
    }

    // 4. PAYMENT IN REVISION >N days
    for (const payment of payments) {
        if (payment.status !== 'REVISION') continue;
        const payDate = new Date(payment.paymentDate);
        const daysSince = Math.ceil((now.getTime() - payDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > PAYMENT_REVISION_STALE_DAYS) {
            results.push({
                id: `auto-revision-${payment.id}`,
                title: `Pago pendiente de revisión`,
                description: `Mes ${payment.month}/${payment.year} — ${daysSince} días esperando aprobación`,
                dueDate: payment.paymentDate,
                type: 'PAYMENT_REVISION_STALE',
                source: 'auto',
                entityType: 'tenant',
                entityId: payment.tenantId,
                completed: false,
                urgency: daysSince > 7 ? 'overdue' : 'urgent',
            });
        }
    }

    // 5. TENANT HASN'T PAID current month (after day N)
    if (now.getDate() >= PAYMENT_OVERDUE_DAY) {
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        for (const prop of properties) {
            if (!prop.tenantName || prop.tenantName === 'Vacante') continue;
            const hasPaid = payments.some(p =>
                p.propertyId === prop.id &&
                p.month === currentMonth &&
                p.year === currentYear
            );
            if (!hasPaid) {
                const dueDate = new Date(currentYear, now.getMonth(), PAYMENT_OVERDUE_DAY).toISOString();
                results.push({
                    id: `auto-overdue-${prop.id}-${currentYear}-${currentMonth}`,
                    title: `Pago pendiente: ${prop.tenantName}`,
                    description: `${prop.address} — Mes ${currentMonth}/${currentYear} sin pago registrado`,
                    dueDate,
                    type: 'PAYMENT_OVERDUE',
                    source: 'auto',
                    entityType: 'property',
                    entityId: prop.id,
                    completed: false,
                    urgency: now.getDate() > 20 ? 'overdue' : 'urgent',
                });
            }
        }
    }

    return results;
}

// ── Hook ──

export const useReminders = (currentUserId?: string) => {
    const { reminders, setReminders, properties, payments, maintenanceTasks, professionals, tenants } = useDataContext();

    // AI state
    const [aiReminders, setAiReminders] = useState<SmartReminder[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

    // ── CRUD ──

    const createReminder = useCallback(async (data: { title: string; description?: string; dueDate: string; entityType?: ReminderEntityType; entityId?: string }) => {
        const newReminder: ManualReminder = {
            ...data,
            id: generateUUID(),
            userId: currentUserId || '',
            completed: false,
            createdAt: new Date().toISOString(),
        };
        setReminders(prev => [...prev, newReminder]);
        const { error } = await supabase.from('reminders').upsert(reminderToDb(newReminder));
        if (error) {
            toast.error(`Error al crear recordatorio: ${error.message}`);
            setReminders(prev => prev.filter(r => r.id !== newReminder.id));
        }
    }, [currentUserId, setReminders]);

    const toggleComplete = useCallback(async (id: string) => {
        const reminder = reminders.find(r => r.id === id);
        if (!reminder) return;
        const newCompleted = !reminder.completed;
        setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: newCompleted } : r));
        const { error } = await supabase.from('reminders').update({ completed: newCompleted }).eq('id', id);
        if (error) {
            toast.error(`Error: ${error.message}`);
        } else if (newCompleted) {
            logAdminAction({
                actionType: 'REMINDER_COMPLETED',
                entityTable: 'reminders',
                entityId: id,
                actionPayload: { title: reminder.title, entityType: reminder.entityType, entityId: reminder.entityId },
            });
        }
    }, [reminders, setReminders]);

    const deleteReminder = useCallback(async (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id));
        const { error } = await supabase.from('reminders').delete().eq('id', id);
        if (error) toast.error(`Error: ${error.message}`);
    }, [setReminders]);

    // ── AI Analysis ──

    const analyzeWithAI = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            // Build compact snapshot
            const snapshot: AIReminderRequest = {
                properties: properties.map(p => ({
                    id: p.id,
                    address: p.address,
                    tenantName: p.tenantName || 'Vacante',
                    contractEnd: p.contractEnd,
                    contractStart: p.contractStart,
                    adjustmentMonths: p.adjustmentMonths,
                    monthlyRent: p.monthlyRent,
                    status: p.status,
                    currency: p.currency,
                })),
                pendingPayments: payments
                    .filter(p => p.status !== 'APPROVED')
                    .map(p => {
                        const prop = properties.find(pr => pr.id === p.propertyId);
                        return {
                            propertyId: p.propertyId || '',
                            tenantName: prop?.tenantName || '',
                            month: p.month,
                            year: p.year,
                            status: p.status,
                            paymentDate: p.paymentDate,
                            amount: p.amount,
                        };
                    }),
                activeTasks: maintenanceTasks
                    .filter(t => t.status !== TaskStatus.COMPLETED)
                    .map(t => {
                        const prop = properties.find(p => p.id === t.propertyId);
                        const pro = professionals.find(p => p.id === t.professionalId);
                        return {
                            id: t.id,
                            propertyId: t.propertyId,
                            address: prop?.address || '',
                            professionalName: pro?.name || '',
                            description: t.description,
                            startDate: t.startDate,
                            status: t.status,
                        };
                    }),
                professionals: professionals.map(p => ({
                    id: p.id,
                    name: p.name,
                    profession: p.profession,
                    phone: p.phone,
                })),
                currentDate: new Date().toISOString().slice(0, 10),
            };

            const aiResults = await generateAIReminders(snapshot);

            // Convert AI results to SmartReminder
            const newAiReminders: SmartReminder[] = aiResults.map((r, i) => ({
                id: generateUUID(),
                title: r.title,
                description: r.description,
                dueDate: r.suggestedDueDate || new Date().toISOString(),
                type: 'AI_GENERATED' as SmartReminderType,
                source: 'ai' as const,
                entityType: r.entityType as ReminderEntityType | undefined,
                entityId: r.entityId,
                completed: false,
                urgency: r.urgency,
            }));

            setAiReminders(newAiReminders);
            setLastAnalysis(new Date());
            toast.success(`IA generó ${newAiReminders.length} recordatorios`);
        } catch (error: any) {
            if (error?.message === 'EDGE_FUNCTION_NOT_CONFIGURED') {
                toast.error('La función de IA no está configurada. Configurá la Edge Function en Supabase.');
            } else {
                toast.error(`Error de IA: ${error?.message || 'Error desconocido'}`);
            }
        } finally {
            setIsAnalyzing(false);
        }
    }, [properties, payments, maintenanceTasks, professionals]);

    // ── Merge all reminders ──

    const ruleBasedReminders = useMemo(
        () => computeRuleBasedReminders(properties, payments, maintenanceTasks),
        [properties, payments, maintenanceTasks]
    );

    const manualSmartReminders: SmartReminder[] = useMemo(
        () => reminders.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description || '',
            dueDate: r.dueDate,
            type: 'MANUAL' as SmartReminderType,
            source: 'manual' as const,
            entityType: r.entityType,
            entityId: r.entityId,
            completed: r.completed,
            urgency: getUrgency(r.dueDate, r.completed),
            createdAt: r.createdAt,
        })),
        [reminders]
    );

    const allReminders = useMemo(() => {
        // Merge: AI reminders replace rule-based with same entityId
        const aiEntityIds = new Set(aiReminders.filter(r => r.entityId).map(r => `${r.entityType}-${r.entityId}`));
        const filteredRules = ruleBasedReminders.filter(r => !aiEntityIds.has(`${r.entityType}-${r.entityId}`));

        const merged = [...filteredRules, ...aiReminders, ...manualSmartReminders];

        // Sort: overdue → urgent → upcoming → done
        const urgencyOrder = { overdue: 0, urgent: 1, upcoming: 2, done: 3 };
        merged.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        return merged;
    }, [ruleBasedReminders, aiReminders, manualSmartReminders]);

    const activeCount = useMemo(
        () => allReminders.filter(r => r.urgency !== 'done').length,
        [allReminders]
    );

    return {
        allReminders,
        activeCount,
        createReminder,
        toggleComplete,
        deleteReminder,
        analyzeWithAI,
        isAnalyzing,
        lastAnalysis,
    };
};
