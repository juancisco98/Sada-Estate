import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { User, TenantPayment, ParsedExpenseSheet } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { dbToExpenseSheet } from '../utils/mappers';
import { parseExpenseSheet } from '../utils/expenseSheetParser';
import { MONTH_NAMES } from '../constants';
import {
    LogOut, Bell, FileSpreadsheet,
    AlertCircle, Users, Clock, ArrowLeftRight,
    Home, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ExpensesTenantDetail from './expenses/ExpensesTenantDetail';

interface ExpensesAdminPortalProps {
    currentUser: User;
    onLogout: () => void;
    onSwitchMode?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const normalizeStr = (s: string) =>
    s.toLowerCase().trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

// ── Component ──────────────────────────────────────────────────────────────

const ExpensesAdminPortal: React.FC<ExpensesAdminPortalProps> = ({ currentUser, onLogout, onSwitchMode }) => {
    const { tenants, payments, setPayments, properties, buildings, expenseSheets, setExpenseSheets, notifications, markNotificationRead, markAllNotificationsRead } = useDataContext();
    const { theme, toggleTheme } = useTheme();

    // Filtro: solo inquilinos del edificio Vélez Sársfield 134
    const velezBuilding = useMemo(() =>
        buildings.find(b => {
            const addr = normalizeStr(b.address);
            return addr.includes('velez sarsfield') && addr.includes('134');
        }),
        [buildings]
    );

    // Properties that belong to Vélez Sársfield 134 (by buildingId OR by address match)
    const velezPropertyIds = useMemo(() => {
        const ids = new Set<string>();
        // Match by buildingId
        if (velezBuilding) {
            properties.filter(p => p.buildingId === velezBuilding.id).forEach(p => ids.add(p.id));
        }
        // Fallback: also match by address — must include "velez sarsfield" AND "134"
        properties.filter(p => {
            const addr = normalizeStr(p.address);
            return addr.includes('velez sarsfield') && addr.includes('134');
        }).forEach(p => ids.add(p.id));
        return ids;
    }, [properties, velezBuilding]);

    const filteredTenants = useMemo(() =>
        tenants
            .filter(t => t.propertyId && velezPropertyIds.has(t.propertyId))
            .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
        [tenants, velezPropertyIds]
    );
    const filteredPayments = useMemo(() =>
        payments.filter(p => p.propertyId && velezPropertyIds.has(p.propertyId)),
        [payments, velezPropertyIds]
    );

    // ── State ────────────────────────────────────────────────────────────────
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [viewYear, setViewYear] = useState(new Date().getFullYear());

    // Bell / notifications dropdown
    const [showNotif, setShowNotif] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    // Close notif dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotif(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Filter notifications relevant to this expenses admin
    const myNotifications = useMemo(() =>
        notifications.filter(n => n.type === 'PAYMENT_SUBMITTED' || n.type === 'PAYMENT_REVISION'),
        [notifications]
    );
    const myUnreadCount = myNotifications.filter(n => !n.read).length;

    // Payments in REVISION — solo del edificio Vélez
    const pendingReviews = useMemo(() =>
        filteredPayments.filter(p => p.status === 'REVISION' && (p.proofOfExpenses || (p.expenseAmount ?? 0) > 0))
            .sort((a, b) => b.year - a.year || b.month - a.month),
        [filteredPayments]
    );

    // Tenant monthly status for the grid cards.
    // Una sola pasada sobre filteredPayments: O(payments + tenants) en vez de O(tenants × payments × 3).
    const currentYear = new Date().getFullYear();
    const tenantMonthlyStatus = useMemo(() => {
        const statsById = new Map<string, { pendingCount: number; totalExpenses: number; approvedCount: number }>();
        for (const t of filteredTenants) {
            statsById.set(t.id, { pendingCount: 0, totalExpenses: 0, approvedCount: 0 });
        }
        for (const p of filteredPayments) {
            if (p.year !== currentYear || !p.tenantId) continue;
            const s = statsById.get(p.tenantId);
            if (!s) continue;
            const hasExpense = (p.expenseAmount ?? 0) > 0 || !!p.proofOfExpenses;
            if (p.status === 'REVISION' && hasExpense) {
                s.pendingCount++;
            } else if (p.status === 'APPROVED' && (p.expenseAmount ?? 0) > 0) {
                s.approvedCount++;
                s.totalExpenses += p.expenseAmount ?? 0;
            }
        }
        return filteredTenants.map(tenant => ({
            tenant,
            ...statsById.get(tenant.id)!,
        }));
    }, [filteredTenants, filteredPayments, currentYear]);

    // Selected tenant data for full-screen detail
    const selectedTenant = useMemo(() =>
        selectedTenantId ? filteredTenants.find(t => t.id === selectedTenantId) : null,
        [selectedTenantId, filteredTenants]
    );
    const selectedProperty = useMemo(() =>
        selectedTenant ? properties.find(p => p.id === selectedTenant.propertyId) : null,
        [selectedTenant, properties]
    );

    // ── Shared upsert logic for expense sheets ────────────────────────────────
    const upsertExpenseSheet = async (tenantId: string, month: number, year: number, sheetData: unknown[][], sheetName: string, parsedData: ParsedExpenseSheet | undefined, sourceType: 'excel' | 'pdf' = 'excel', pdfUrl?: string) => {
        const payload = {
            tenant_id: tenantId,
            month,
            year,
            sheet_data: sheetData,
            sheet_name: sheetName,
            parsed_data: parsedData ?? (sourceType === 'excel' ? parseExpenseSheet(sheetData) : { items: [], total: 0, currency: 'ARS' }),
            source_type: sourceType,
            pdf_url: pdfUrl ?? null,
            uploaded_by: currentUser.email,
            uploaded_at: new Date().toISOString(),
        };

        const existing = expenseSheets.find(
            s => s.tenantId === tenantId && s.month === month && s.year === year
        );

        if (existing) {
            const { error } = await supabase
                .from('expense_sheets')
                .update(payload)
                .eq('id', existing.id);
            if (error) throw error;
            setExpenseSheets(prev => prev.map(s =>
                s.id === existing.id ? dbToExpenseSheet({ id: existing.id, ...payload }) : s
            ));
        } else {
            const { data, error } = await supabase
                .from('expense_sheets')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            if (data) {
                setExpenseSheets(prev => {
                    if (prev.some(s => s.id === data.id)) return prev;
                    return [dbToExpenseSheet(data), ...prev];
                });
            }
        }
    };

    // ── Upload single sheet (from detail view) ────────────────────────────────
    const handleUploadSingleSheet = async (tenantId: string, month: number, year: number, sheetData: unknown[][], sheetName: string, parsedData: ParsedExpenseSheet, sourceType: 'excel' | 'pdf', pdfUrl?: string) => {
        await upsertExpenseSheet(tenantId, month, year, sheetData, sheetName, parsedData, sourceType, pdfUrl);

        // Notify tenant
        const tenant = tenants.find(t => t.id === tenantId);
        if (tenant?.email) {
            const monthName = MONTH_NAMES[month - 1];
            await supabase.from('notifications').insert([{
                recipient_email: tenant.email,
                title: 'Expensas disponibles',
                message: `Tu liquidación de expensas de ${monthName} ${year} está disponible.`,
                type: 'PAYMENT_SUBMITTED',
                read: false,
            }]).then(({ error }) => {
                if (error) console.error('Error sending notification:', error);
            });
        }
    };

    // ── Delete sheet handler ──────────────────────────────────────────────────
    const handleDeleteSheet = async (sheetId: string) => {
        const { error } = await supabase
            .from('expense_sheets')
            .delete()
            .eq('id', sheetId);
        if (error) throw error;
        setExpenseSheets(prev => prev.filter(s => s.id !== sheetId));
    };

    // ── Review handlers ───────────────────────────────────────────────────────
    const handleApprove = async (payment: TenantPayment) => {
        const { error } = await supabase
            .from('tenant_payments')
            .update({ status: 'APPROVED' })
            .eq('id', payment.id);
        if (error) { toast.error('Error al aprobar.'); throw error; }
        setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: 'APPROVED' } : p));
        const tenant = tenants.find(t => t.id === payment.tenantId);
        if (tenant?.email) {
            await supabase.from('notifications').insert({
                recipient_email: tenant.email,
                title: 'Pago aprobado ✓',
                message: `Tu pago de expensas de ${MONTH_NAMES[payment.month - 1]} ${payment.year} fue aprobado.`,
                type: 'PAYMENT_APPROVED',
                payment_id: payment.id,
                read: false,
            });
        }
        toast.success(`Pago de ${MONTH_NAMES[payment.month - 1]} aprobado.`);
    };

    const handleReturn = async (payment: TenantPayment, reason: string) => {
        const { error } = await supabase
            .from('tenant_payments')
            .update({ status: 'RETURNED', notes: reason })
            .eq('id', payment.id);
        if (error) { toast.error('Error al devolver.'); throw error; }
        setPayments(prev => prev.map(p =>
            p.id === payment.id ? { ...p, status: 'RETURNED', notes: reason } : p
        ));
        const tenant = tenants.find(t => t.id === payment.tenantId);
        if (tenant?.email) {
            await supabase.from('notifications').insert({
                recipient_email: tenant.email,
                title: 'Pago devuelto para corrección',
                message: `Tu pago de ${MONTH_NAMES[payment.month - 1]} ${payment.year} requiere correcciones: ${reason}`,
                type: 'PAYMENT_RETURNED',
                payment_id: payment.id,
                read: false,
            });
        }
        toast.warning(`Pago de ${MONTH_NAMES[payment.month - 1]} devuelto.`);
    };

    // ── Early return if no Vélez properties found at all ──────────────────
    if (!velezBuilding && velezPropertyIds.size === 0) {
        return (
            <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                            <FileSpreadsheet className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight">Admin de Expensas</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.name}</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10">
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Salir</span>
                    </button>
                </header>
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center space-y-4">
                        <AlertCircle className="w-16 h-16 text-amber-400 mx-auto" />
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Edificio no encontrado</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                            {buildings.length === 0
                                ? 'Los datos están cargando. Esperá un momento y recargá la página.'
                                : `No se encontró el edificio Vélez Sársfield. Buildings disponibles: ${buildings.map(b => b.address).join(', ')}`
                            }
                        </p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
                            Recargar página
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Full-screen detail view ───────────────────────────────────────────────
    if (selectedTenant) {
        return (
            <ExpensesTenantDetail
                tenant={selectedTenant}
                property={selectedProperty || null}
                year={viewYear}
                onYearChange={setViewYear}
                onBack={() => setSelectedTenantId(null)}
                payments={filteredPayments.filter(p => p.tenantId === selectedTenant.id)}
                expenseSheets={expenseSheets.filter(s => s.tenantId === selectedTenant.id)}
                onApprove={handleApprove}
                onReturn={handleReturn}
                onUploadSingleSheet={handleUploadSingleSheet}
                onDeleteSheet={handleDeleteSheet}
                currentUser={currentUser}
            />
        );
    }

    // ── Grid view ─────────────────────────────────────────────────────────────
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight">Admin de Expensas</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Bell */}
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotif(v => !v)}
                            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            {myUnreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                    {myUnreadCount > 9 ? '9+' : myUnreadCount}
                                </span>
                            )}
                        </button>

                        {showNotif && (
                            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">Notificaciones</span>
                                    {myUnreadCount > 0 && (
                                        <button onClick={markAllNotificationsRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                            Marcar todo leído
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {myNotifications.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-8">Sin notificaciones</p>
                                    ) : (
                                        myNotifications.slice(0, 20).map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => markNotificationRead(n.id)}
                                                className={`px-4 py-3 border-b border-slate-50 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${!n.read ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}
                                            >
                                                <p className={`text-sm font-semibold ${!n.read ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{n.title}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">{new Date(n.createdAt).toLocaleDateString('es-AR')}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                    </button>

                    {onSwitchMode && (
                        <button
                            onClick={onSwitchMode}
                            className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors px-3 py-2 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-500/10"
                        >
                            <ArrowLeftRight className="w-4 h-4" />
                            <span className="hidden sm:inline">Cambiar modo</span>
                        </button>
                    )}

                    <button
                        onClick={onLogout}
                        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Salir</span>
                    </button>
                </div>
            </header>

            {/* ── Main content ─────────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

                {/* ── Pending reviews banner ──────────────────────────────── */}
                {pendingReviews.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                            {pendingReviews.length} pago{pendingReviews.length !== 1 ? 's' : ''} pendiente{pendingReviews.length !== 1 ? 's' : ''} de revisión
                        </p>
                    </div>
                )}

                {/* ── Tenant Grid ─────────────────────────────────────────── */}
                <section>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 px-1">
                        <Users className="w-5 h-5 text-violet-500" />
                        Inquilinos — Vélez Sársfield 134
                    </h2>

                    {filteredTenants.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-sm text-slate-400">Sin inquilinos registrados en este edificio.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {tenantMonthlyStatus.map(({ tenant, pendingCount, totalExpenses, approvedCount }) => {
                                const property = properties.find(p => p.id === tenant.propertyId);
                                return (
                                    <button
                                        key={tenant.id}
                                        onClick={() => { setSelectedTenantId(tenant.id); setViewYear(currentYear); }}
                                        className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-4 shadow-sm hover:shadow-lg hover:shadow-violet-500/10 dark:hover:border-violet-500/40 hover:scale-[1.02] transition-all duration-200 group"
                                    >
                                        <div className="flex items-start gap-2.5 mb-2">
                                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${pendingCount > 0 ? 'bg-amber-400' : approvedCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
                                                    {tenant.name}
                                                </h3>
                                                {property?.unitLabel && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate flex items-center gap-1">
                                                        <Home size={10} />
                                                        {property.unitLabel}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {pendingCount > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/30">
                                                    {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {totalExpenses > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/30">
                                                    ${totalExpenses.toLocaleString('es-AR')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default ExpensesAdminPortal;
