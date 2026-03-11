import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Property, Professional, MaintenanceTask, Building, Tenant, TenantPayment, AppNotification, ExpenseSheet } from '../types';
import { DbTenantPaymentRow, DbExpenseSheetRow } from '../types/dbRows';
import { supabase } from '../services/supabaseClient';
import {
    dbToBuilding, dbToProperty,
    dbToProfessional,
    dbToTask,
    dbToTenant,
    dbToPayment,
    dbToExpenseSheet
} from '../utils/mappers';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

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
                expenseSheetsResult
            ] = await Promise.all([
                supabase.from('professionals').select('*').order('created_at', { ascending: true }),
                supabase.from('properties').select('*').order('created_at', { ascending: true }),
                supabase.from('maintenance_tasks').select('*').order('created_at', { ascending: true }),
                supabase.from('buildings').select('*').order('created_at', { ascending: true }),
                supabase.from('tenants').select('*').order('created_at', { ascending: true }),
                supabase.from('tenant_payments').select('*').order('created_at', { ascending: true }),
                supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('expense_sheets').select('*').order('uploaded_at', { ascending: false })
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

        return () => {
            supabase.removeChannel(paymentsChannel);
            supabase.removeChannel(notificationsChannel);
            supabase.removeChannel(expenseSheetsChannel);
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
