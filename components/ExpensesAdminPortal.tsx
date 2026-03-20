import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { User, Tenant, ExpenseSheet, TenantPayment } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { dbToExpenseSheet } from '../utils/mappers';
import { MONTH_NAMES } from '../constants';
import {
    LogOut, Bell, Upload, FileSpreadsheet, CheckCircle,
    AlertCircle, Users, Clock, ArrowLeftRight,
    ChevronLeft, ChevronRight, Home, Sun, Moon
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

const matchSheetToTenant = (identifier: string, tenants: Tenant[]): Tenant | undefined => {
    const normalized = normalizeStr(identifier);
    return tenants.find(t => {
        const tenantNorm = normalizeStr(t.name);
        const parts = tenantNorm.split(' ');
        const firstName = parts[0];
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
        if (lastName && normalized.includes(lastName)) {
            if (parts.length === 1) return true;
            if (firstName && normalized.includes(firstName)) return true;
        }
        if (normalized === tenantNorm) return true;
        if (normalized.includes(tenantNorm)) return true;
        return false;
    });
};

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
        tenants.filter(t => t.propertyId && velezPropertyIds.has(t.propertyId)),
        [tenants, velezPropertyIds]
    );
    const filteredPayments = useMemo(() =>
        payments.filter(p => p.propertyId && velezPropertyIds.has(p.propertyId)),
        [payments, velezPropertyIds]
    );

    // ── State ────────────────────────────────────────────────────────────────
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [showUploadSection, setShowUploadSection] = useState(false);
    const [viewYear, setViewYear] = useState(new Date().getFullYear());

    // Bell / notifications dropdown
    const [showNotif, setShowNotif] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    // Excel upload state
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedSheets, setParsedSheets] = useState<{ name: string; data: any[][]; tenant: Tenant | undefined; tenantIdentifier: string; expenseTotal: number }[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isUploading, setIsUploading] = useState(false);

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

    // Tenant monthly status for the grid cards
    const currentYear = new Date().getFullYear();
    const tenantMonthlyStatus = useMemo(() => {
        return filteredTenants.map(tenant => {
            const tenantPayments = filteredPayments.filter(p => p.tenantId === tenant.id && p.year === currentYear);
            const pendingCount = tenantPayments.filter(p => p.status === 'REVISION' && ((p.expenseAmount ?? 0) > 0 || !!p.proofOfExpenses)).length;
            const approvedExpenses = tenantPayments.filter(p => p.status === 'APPROVED' && (p.expenseAmount ?? 0) > 0);
            const totalExpenses = approvedExpenses.reduce((sum, p) => sum + (p.expenseAmount ?? 0), 0);
            const approvedCount = approvedExpenses.length;
            return { tenant, pendingCount, totalExpenses, approvedCount };
        });
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

    // ── Excel parse (bulk) ────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setParsedSheets([]);

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const sheets = workbook.SheetNames
                    .filter(name => name.toUpperCase().trim() !== 'ADMINISTRACION')
                    .map(name => {
                        const ws = workbook.Sheets[name];
                        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
                        while (rows.length > 0 && rows[rows.length - 1].every((c: any) => c === '' || c === null || c === undefined)) {
                            rows.pop();
                        }
                        const row7 = rows[7] || [];
                        const tenantIdentifier = row7
                            .map((c: any) => String(c ?? '').trim())
                            .filter(Boolean)
                            .join(' ');
                        const tenant = matchSheetToTenant(tenantIdentifier || name, filteredTenants);

                        const row8 = rows[8] || [];
                        const expenseTotal = row8
                            .map((c: any) => typeof c === 'number' ? c : parseFloat(String(c).replace(/[^0-9.,]/g, '').replace(',', '.')))
                            .find((n: number) => !isNaN(n) && n > 0) || 0;

                        return { name, data: rows, tenant, tenantIdentifier, expenseTotal };
                    });

                setParsedSheets(sheets);

                if (sheets.length > 0) {
                    const row0Text = (sheets[0].data[0] || [])
                        .map((c: any) => String(c ?? '')).join(' ').toUpperCase();
                    const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
                    const detectedMonth = monthNames.findIndex(m => row0Text.includes(m));
                    const yearMatch = row0Text.match(/20\d{2}/);
                    if (detectedMonth >= 0) setSelectedMonth(detectedMonth + 1);
                    if (yearMatch) setSelectedYear(parseInt(yearMatch[0]));
                }
            } catch {
                toast.error('No se pudo leer el archivo Excel. Asegurate que sea .xlsx o .xls.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // ── Upload bulk ───────────────────────────────────────────────────────────
    const handleUpload = async () => {
        const matched = parsedSheets.filter(s => s.tenant);
        if (matched.length === 0) {
            toast.error('Ninguna hoja pudo asociarse a un inquilino. Revisá los nombres de las hojas.');
            return;
        }
        setIsUploading(true);
        let successCount = 0;
        let errorCount = 0;

        for (const sheet of matched) {
            if (!sheet.tenant) continue;
            try {
                await upsertExpenseSheet(sheet.tenant.id, selectedMonth, selectedYear, sheet.data, sheet.name);
                successCount++;

                if (sheet.tenant?.email) {
                    const monthName = MONTH_NAMES[selectedMonth - 1];
                    await supabase.from('notifications').insert([{
                        recipient_email: sheet.tenant.email,
                        title: 'Expensas disponibles',
                        message: `Tu liquidación de expensas de ${monthName} ${selectedYear} está disponible.`,
                        type: 'PAYMENT_SUBMITTED',
                        read: false,
                    }]).then(({ error }) => {
                        if (error) console.error('Error sending notification:', error);
                    });
                }
            } catch (err: any) {
                console.error('Error uploading sheet for', sheet.tenant?.name, err);
                errorCount++;
            }
        }

        setIsUploading(false);
        if (successCount > 0) {
            toast.success(`${successCount} hoja${successCount > 1 ? 's' : ''} subida${successCount > 1 ? 's' : ''} correctamente.`);
            setParsedSheets([]);
            setFileName(null);
        }
        if (errorCount > 0) {
            toast.error(`${errorCount} hoja${errorCount > 1 ? 's' : ''} no se pudieron subir.`);
        }
    };

    // ── Shared upsert logic for expense sheets ────────────────────────────────
    const upsertExpenseSheet = async (tenantId: string, month: number, year: number, sheetData: any[][], sheetName: string) => {
        const payload = {
            tenant_id: tenantId,
            month,
            year,
            sheet_data: sheetData,
            sheet_name: sheetName,
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
    const handleUploadSingleSheet = async (tenantId: string, month: number, year: number, sheetData: any[][], sheetName: string, _expenseTotal: number) => {
        await upsertExpenseSheet(tenantId, month, year, sheetData, sheetName);

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

                {/* ── Upload Excel (collapsible) ─────────────────────────── */}
                <div>
                    <button
                        onClick={() => setShowUploadSection(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showUploadSection ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-none' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/40'}`}
                    >
                        <Upload className="w-4 h-4" />
                        Cargar Excel masivo
                        {showUploadSection ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4 rotate-90" />}
                    </button>

                    {showUploadSection && (
                        <section className="mt-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-6 shadow-sm">
                            <label className="flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                <div className="flex flex-col items-center gap-2 p-5 text-center">
                                    <FileSpreadsheet className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                    {fileName ? (
                                        <>
                                            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">{fileName}</p>
                                            <p className="text-xs text-slate-400">Seleccioná otro archivo para reemplazar</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Arrastrá o seleccioná el Excel</p>
                                            <p className="text-xs text-slate-400">.xlsx o .xls — cada hoja = un inquilino</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} />
                            </label>

                            {parsedSheets.length > 0 && (
                                <div className="mt-5 space-y-5">
                                    <div className="flex gap-3 flex-wrap">
                                        <div className="flex-1 min-w-[140px] space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mes</label>
                                            <select
                                                value={selectedMonth}
                                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                            >
                                                {MONTH_NAMES.map((m, i) => (
                                                    <option key={i} value={i + 1}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[100px] space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Año</label>
                                            <input
                                                type="number"
                                                value={selectedYear}
                                                onChange={e => setSelectedYear(Number(e.target.value))}
                                                min={2020}
                                                max={2099}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Hojas detectadas ({parsedSheets.length})
                                        </p>
                                        <div className="rounded-xl border border-slate-100 dark:border-white/10 overflow-hidden">
                                            {parsedSheets.map((sheet, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-center justify-between px-4 py-3 text-sm ${i < parsedSheets.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}
                                                >
                                                    <div className="min-w-0 mr-3">
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 block truncate">
                                                            {sheet.name}
                                                        </span>
                                                        {sheet.tenantIdentifier && (
                                                            <span className="text-xs text-slate-400 dark:text-slate-500 block truncate">
                                                                {sheet.tenantIdentifier}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {sheet.tenant ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0">
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            {sheet.tenant.name}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-amber-500 text-xs font-semibold shrink-0">
                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                            Sin match
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {parsedSheets.some(s => !s.tenant) && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                                Las hojas sin match no se subirán. Verificá que el nombre de la hoja contenga el apellido del inquilino.
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleUpload}
                                        disabled={isUploading || parsedSheets.filter(s => s.tenant).length === 0}
                                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white disabled:text-slate-400 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isUploading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Subiendo...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                Subir {parsedSheets.filter(s => s.tenant).length} hoja{parsedSheets.filter(s => s.tenant).length !== 1 ? 's' : ''} — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
                </div>

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
