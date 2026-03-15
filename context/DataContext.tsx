import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Property, Professional, MaintenanceTask, Building, Tenant, TenantPayment, AppNotification, ExpenseSheet, ManualReminder, AutomationRule, AutomationHistoryEntry } from '../types';
import { DbTenantPaymentRow, DbExpenseSheetRow, DbReminderRow, DbAutomationRuleRow, DbAutomationHistoryRow } from '../types/dbRows';
import { supabase } from '../services/supabaseClient';
import {
    dbToBuilding, dbToProperty,
    dbToProfessional,
    dbToTask,
    dbToTenant,
    dbToPayment,
    dbToExpenseSheet,
    dbToReminder,
    dbToAutomationRule,
    dbToAutomationHistory,
    buildingToDb
} from '../utils/mappers';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { Upload, Bot } from 'lucide-react';

interface DataContextType {
    properties: Property[];
    setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
    professionals: Professional[];
    setProfessionals: React.Dispatch<React.SetStateAction<Professional[]>>;
    maintenanceTasks: MaintenanceTask[];
    setMaintenanceTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>;
    buildings: Building[];
    setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
    tenants: Tenant[];
    setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
    payments: TenantPayment[];
    setPayments: React.Dispatch<React.SetStateAction<TenantPayment[]>>;
    expenseSheets: ExpenseSheet[];
    setExpenseSheets: React.Dispatch<React.SetStateAction<ExpenseSheet[]>>;
    reminders: ManualReminder[];
    setReminders: React.Dispatch<React.SetStateAction<ManualReminder[]>>;
    automationRules: AutomationRule[];
    setAutomationRules: React.Dispatch<React.SetStateAction<AutomationRule[]>>;
    automationHistory: AutomationHistoryEntry[];
    setAutomationHistory: React.Dispatch<React.SetStateAction<AutomationHistoryEntry[]>>;
    notifications: AppNotification[];
    unreadCount: number;
    markNotificationRead: (id: string) => Promise<void>;
    markAllNotificationsRead: () => Promise<void>;
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const dbToNotification = (row: any): AppNotification => ({
    id: row.id,
    recipientEmail: row.recipient_email,
    title: row.title,
    message: row.message,
    type: row.type,
    paymentId: row.payment_id ?? undefined,
    read: row.read,
    createdAt: row.created_at,
});

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [properties, setProperties] = useState<Property[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [payments, setPayments] = useState<TenantPayment[]>([]);
    const [expenseSheets, setExpenseSheets] = useState<ExpenseSheet[]>([]);
    const [reminders, setReminders] = useState<ManualReminder[]>([]);
    const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
    const [automationHistory, setAutomationHistory] = useState<AutomationHistoryEntry[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markNotificationRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        await supabase.from('notifications').update({ read: true }).eq('id', id);
    }, []);

    const markAllNotificationsRead = useCallback(async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    }, [notifications]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [
                prosResult,
                propsResult,
                tasksResult,
                buildingsResult,
                tenantsResult,
                paymentsResult,
                notificationsResult,
                expenseSheetsResult,
                remindersResult,
                automationRulesResult,
                automationHistoryResult
            ] = await Promise.all([
                supabase.from('professionals').select('*').order('created_at', { ascending: true }),
                supabase.from('properties').select('*').order('created_at', { ascending: true }),
                supabase.from('maintenance_tasks').select('*').order('created_at', { ascending: true }),
                supabase.from('buildings').select('*').order('created_at', { ascending: true }),
                supabase.from('tenants').select('*').order('created_at', { ascending: true }),
                supabase.from('tenant_payments').select('*').order('created_at', { ascending: true }),
                supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('expense_sheets').select('*').order('uploaded_at', { ascending: false }),
                supabase.from('reminders').select('*').order('due_date', { ascending: true }),
                supabase.from('automation_rules').select('*').order('created_at', { ascending: true }),
                supabase.from('automation_history').select('*').order('proposed_at', { ascending: false }).limit(100)
            ]);

            if (prosResult.error) throw prosResult.error;
            if (propsResult.error) throw propsResult.error;
            if (tasksResult.error) throw tasksResult.error;
            if (buildingsResult.error) throw buildingsResult.error;
            if (tenantsResult.error) throw tenantsResult.error;
            if (paymentsResult.error) throw paymentsResult.error;

            if (prosResult.data) setProfessionals(prosResult.data.map(dbToProfessional));
            if (propsResult.data) setProperties(propsResult.data.map(dbToProperty));
            if (tasksResult.data) setMaintenanceTasks(tasksResult.data.map(dbToTask));
            if (buildingsResult.data) setBuildings(buildingsResult.data.map(dbToBuilding));
            if (tenantsResult.data) setTenants(tenantsResult.data.map(dbToTenant));
            if (paymentsResult.data) setPayments(paymentsResult.data.map(dbToPayment));
            if (notificationsResult.data) setNotifications(notificationsResult.data.map(dbToNotification));
            if (expenseSheetsResult.data) setExpenseSheets(expenseSheetsResult.data.map(dbToExpenseSheet));
            if (remindersResult.data) setReminders(remindersResult.data.map(dbToReminder));
            if (automationRulesResult.data) setAutomationRules(automationRulesResult.data.map(dbToAutomationRule));
            if (automationHistoryResult.data) setAutomationHistory(automationHistoryResult.data.map(dbToAutomationHistory));

            // Auto-repair: create missing building records for orphaned buildingIds
            const propertiesData = propsResult.data ? propsResult.data.map(dbToProperty) : [];
            const buildingsData = buildingsResult.data ? buildingsResult.data.map(dbToBuilding) : [];
            const loadedBuildingIds = new Set(buildingsData.map(b => b.id));
            const orphanedBuildingIds = new Map<string, typeof propertiesData[0]>();
            for (const prop of propertiesData) {
                if (prop.buildingId && !loadedBuildingIds.has(prop.buildingId) && !orphanedBuildingIds.has(prop.buildingId)) {
                    orphanedBuildingIds.set(prop.buildingId, prop);
                }
            }

            if (orphanedBuildingIds.size > 0) {
                const newBuildings: Building[] = [];
                for (const [bid, firstProp] of orphanedBuildingIds) {
                    newBuildings.push({
                        id: bid,
                        address: firstProp.address,
                        coordinates: firstProp.coordinates,
                        country: firstProp.country,
                        currency: firstProp.currency,
                        imageUrl: firstProp.imageUrl,
                    });
                }
                const { error: repairError } = await supabase.from('buildings').upsert(
                    newBuildings.map(buildingToDb)
                );
                if (repairError) {
                    logger.error('[DataContext] Error auto-creating missing buildings:', repairError);
                } else {
                    logger.log(`[DataContext] Auto-created ${newBuildings.length} missing building records`);
                    setBuildings(prev => [...prev, ...newBuildings]);
                }
            }

            logger.log('[Supabase] All data loaded.');

        } catch (error) {
            handleError(error, 'Error al cargar los datos. Por favor recargue la página.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const paymentsChannel = supabase
            .channel('tenant_payments_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tenant_payments' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setPayments(prev => {
                            if (prev.some(p => p.id === payload.new.id)) return prev;
                            return [...prev, dbToPayment(payload.new as DbTenantPaymentRow)];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setPayments(prev => prev.map(p =>
                            p.id === payload.new.id ? dbToPayment(payload.new as DbTenantPaymentRow) : p
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setPayments(prev => prev.filter(p => p.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const notificationsChannel = supabase
            .channel('notifications_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const notif = dbToNotification(payload.new);
                    setNotifications(prev => [notif, ...prev]);

                    // Show toast based on notification type
                    if (notif.type === 'PAYMENT_SUBMITTED') {
                        toast(notif.title, {
                            description: notif.message,
                            icon: React.createElement(Upload, { className: 'w-4 h-4 text-indigo-500' }),
                            duration: 6000,
                        });
                    } else if (notif.type === 'PAYMENT_APPROVED') {
                        toast.success(notif.title, {
                            description: notif.message,
                            duration: 6000,
                        });
                    } else if (notif.type === 'PAYMENT_REVISION' || notif.type === 'PAYMENT_RETURNED') {
                        toast.warning(notif.title, {
                            description: notif.message,
                            duration: 8000,
                        });
                    } else if (notif.type === 'AUTOMATION_PROPOSED') {
                        toast(notif.title, {
                            description: notif.message,
                            icon: React.createElement(Bot, { className: 'w-4 h-4 text-violet-500' }),
                            duration: 8000,
                        });
                    } else if (notif.type === 'AUTOMATION_EXECUTED') {
                        toast.success(notif.title, {
                            description: notif.message,
                            icon: React.createElement(Bot, { className: 'w-4 h-4 text-emerald-500' }),
                            duration: 6000,
                        });
                    } else if (notif.type === 'AUTOMATION_UNDONE') {
                        toast.warning(notif.title, {
                            description: notif.message,
                            icon: React.createElement(Bot, { className: 'w-4 h-4 text-amber-500' }),
                            duration: 6000,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                (payload) => {
                    setNotifications(prev => prev.map(n =>
                        n.id === payload.new.id ? dbToNotification(payload.new) : n
                    ));
                }
            )
            .subscribe();

        const expenseSheetsChannel = supabase
            .channel('expense_sheets_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'expense_sheets' },
                (payload) => {
                    setExpenseSheets(prev => {
                        if (prev.some(s => s.id === payload.new.id)) return prev;
                        return [dbToExpenseSheet(payload.new as DbExpenseSheetRow), ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'expense_sheets' },
                (payload) => {
                    setExpenseSheets(prev => prev.map(s =>
                        s.id === payload.new.id ? dbToExpenseSheet(payload.new as DbExpenseSheetRow) : s
                    ));
                }
            )
            .subscribe();

        const remindersChannel = supabase
            .channel('reminders_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reminders' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setReminders(prev => {
                            if (prev.some(r => r.id === payload.new.id)) return prev;
                            return [...prev, dbToReminder(payload.new as DbReminderRow)];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setReminders(prev => prev.map(r =>
                            r.id === payload.new.id ? dbToReminder(payload.new as DbReminderRow) : r
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setReminders(prev => prev.filter(r => r.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const automationHistoryChannel = supabase
            .channel('automation_history_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'automation_history' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setAutomationHistory(prev => {
                            if (prev.some(h => h.id === payload.new.id)) return prev;
                            return [dbToAutomationHistory(payload.new as DbAutomationHistoryRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setAutomationHistory(prev => prev.map(h =>
                            h.id === payload.new.id ? dbToAutomationHistory(payload.new as DbAutomationHistoryRow) : h
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setAutomationHistory(prev => prev.filter(h => h.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const automationRulesChannel = supabase
            .channel('automation_rules_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'automation_rules' },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        setAutomationRules(prev => prev.map(r =>
                            r.id === payload.new.id ? dbToAutomationRule(payload.new as DbAutomationRuleRow) : r
                        ));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(paymentsChannel);
            supabase.removeChannel(notificationsChannel);
            supabase.removeChannel(expenseSheetsChannel);
            supabase.removeChannel(remindersChannel);
            supabase.removeChannel(automationHistoryChannel);
            supabase.removeChannel(automationRulesChannel);
        };
    }, []);

    return (
        <DataContext.Provider value={{
            properties, setProperties,
            professionals, setProfessionals,
            maintenanceTasks, setMaintenanceTasks,
            buildings, setBuildings,
            tenants, setTenants,
            payments, setPayments,
            expenseSheets, setExpenseSheets,
            reminders, setReminders,
            automationRules, setAutomationRules,
            automationHistory, setAutomationHistory,
            notifications,
            unreadCount,
            markNotificationRead,
            markAllNotificationsRead,
            isLoading,
            refreshData: loadData
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useDataContext = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useDataContext must be used within a DataProvider');
    }
    return context;
};
