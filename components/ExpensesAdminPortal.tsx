import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { User, Tenant, ExpenseSheet } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { dbToExpenseSheet } from '../utils/mappers';
import { MONTH_NAMES } from '../constants';
import {
    LogOut, Bell, Upload, FileSpreadsheet, CheckCircle,
    AlertCircle, X, Eye, Users, Clock, ArrowLeftRight
} from 'lucide-react';

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

// identifier: puede ser el Row 7 de la hoja ("MOYANO ETELVINA PB F") o el sheet name como fallback
const matchSheetToTenant = (identifier: string, tenants: Tenant[]): Tenant | undefined => {
    const normalized = normalizeStr(identifier);
    return tenants.find(t => {
        const tenantNorm = normalizeStr(t.name);
        const parts = tenantNorm.split(' ');
        // t.name en DB: "Nombre Apellido" → parts[0]=Nombre, parts[1+]=Apellido
        const firstName = parts[0];
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
        // El identifier del Excel es "APELLIDO NOMBRE UNIDAD" (ej: "MOYANO ETELVINA PB F")
        // Buscar apellido en el identifier
        if (lastName && normalized.includes(lastName)) {
            if (parts.length === 1) return true; // nombre único
            if (firstName && normalized.includes(firstName)) return true; // apellido + nombre ambos presentes
        }
        // Fallback: coincidencia exacta o contenida
        if (normalized === tenantNorm) return true;
        if (normalized.includes(tenantNorm)) return true;
        return false;
    });
};

// ── Component ──────────────────────────────────────────────────────────────

const ExpensesAdminPortal: React.FC<ExpensesAdminPortalProps> = ({ currentUser, onLogout, onSwitchMode }) => {
    const { tenants, expenseSheets, setExpenseSheets, notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useDataContext();

    // Bell / notifications dropdown
    const [showNotif, setShowNotif] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    // Excel upload state
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedSheets, setParsedSheets] = useState<{ name: string; data: any[][]; tenant: Tenant | undefined; tenantIdentifier: string }[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isUploading, setIsUploading] = useState(false);

    // History modal
    const [viewingSheet, setViewingSheet] = useState<ExpenseSheet | null>(null);

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

    // Filter notifications relevant to this expenses admin (all PAYMENT_SUBMITTED)
    const myNotifications = useMemo(() =>
        notifications.filter(n => n.type === 'PAYMENT_SUBMITTED' || n.type === 'PAYMENT_REVISION'),
        [notifications]
    );
    const myUnreadCount = myNotifications.filter(n => !n.read).length;

    // History sorted by uploaded_at desc
    const history = useMemo(() =>
        [...expenseSheets].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
        [expenseSheets]
    );

    // ── Excel parse ─────────────────────────────────────────────────────────
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
                    // Saltar la hoja ADMINISTRACION (resumen general, no es un inquilino)
                    .filter(name => name.toUpperCase().trim() !== 'ADMINISTRACION')
                    .map(name => {
                        const ws = workbook.Sheets[name];
                        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
                        // Remove fully empty rows at the end
                        while (rows.length > 0 && rows[rows.length - 1].every((c: any) => c === '' || c === null || c === undefined)) {
                            rows.pop();
                        }
                        // Row 7 (índice 7) contiene el identificador completo: "MOYANO ETELVINA PB F"
                        const tenantIdentifier = rows[7]?.[0] ? String(rows[7][0]).trim() : '';
                        const tenant = matchSheetToTenant(tenantIdentifier || name, tenants);
                        return { name, data: rows, tenant, tenantIdentifier };
                    });

                setParsedSheets(sheets);
            } catch {
                toast.error('No se pudo leer el archivo Excel. Asegurate que sea .xlsx o .xls.');
            }
        };
        reader.readAsArrayBuffer(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    // ── Upload ──────────────────────────────────────────────────────────────
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
                const payload = {
                    tenant_id: sheet.tenant.id,
                    month: selectedMonth,
                    year: selectedYear,
                    sheet_data: sheet.data,
                    sheet_name: sheet.name,
                    uploaded_by: currentUser.email,
                    uploaded_at: new Date().toISOString(),
                };

                // Upsert: replace existing sheet for same tenant+month+year
                const existing = expenseSheets.find(
                    s => s.tenantId === sheet.tenant!.id && s.month === selectedMonth && s.year === selectedYear
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
                successCount++;
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

    // ── Get tenant name for a sheet ─────────────────────────────────────────
    const getTenantName = (tenantId: string) =>
        tenants.find(t => t.id === tenantId)?.name || 'Inquilino desconocido';

    // ──────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
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

                    {/* Switch mode (solo para admins que vienen del modo selector) */}
                    {onSwitchMode && (
                        <button
                            onClick={onSwitchMode}
                            className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors px-3 py-2 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-500/10"
                        >
                            <ArrowLeftRight className="w-4 h-4" />
                            <span className="hidden sm:inline">Cambiar modo</span>
                        </button>
                    )}

                    {/* Logout */}
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
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">

                {/* ── Upload section ────────────────────────────────────── */}
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-6 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-violet-500" />
                        Cargar Excel de Expensas
                    </h2>

                    {/* File picker */}
                    <label className="flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                        <div className="flex flex-col items-center gap-2 p-6 text-center">
                            <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-600" />
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

                    {/* Month / Year selector */}
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

                            {/* Sheet match preview */}
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

                {/* ── History section ───────────────────────────────────── */}
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-6 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-violet-500" />
                        Historial de Expensas
                    </h2>

                    {history.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-sm text-slate-400">Todavía no subiste ningún Excel.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inquilino</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Período</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subido</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((sheet, i) => (
                                        <tr
                                            key={sheet.id}
                                            className={`${i < history.length - 1 ? 'border-b border-slate-50 dark:border-white/5' : ''} hover:bg-slate-50 dark:hover:bg-white/5 transition-colors`}
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{getTenantName(sheet.tenantId)}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{MONTH_NAMES[sheet.month - 1]} {sheet.year}</td>
                                            <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                                                {sheet.uploadedAt ? new Date(sheet.uploadedAt).toLocaleDateString('es-AR') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setViewingSheet(sheet)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Ver datos
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {/* ── Sheet data modal ─────────────────────────────────────── */}
            {viewingSheet && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setViewingSheet(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-100 dark:border-white/10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                    {getTenantName(viewingSheet.tenantId)}
                                </h3>
                                <p className="text-xs text-slate-400">{MONTH_NAMES[viewingSheet.month - 1]} {viewingSheet.year} · Hoja: {viewingSheet.sheetName}</p>
                            </div>
                            <button onClick={() => setViewingSheet(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="overflow-auto p-4">
                            {viewingSheet.sheetData.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8">Sin datos en esta hoja.</p>
                            ) : (
                                <table className="w-full text-xs border-collapse">
                                    <tbody>
                                        {viewingSheet.sheetData.map((row, ri) => (
                                            <tr key={ri} className={ri === 0 ? 'bg-violet-50 dark:bg-violet-500/10 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-white/5'}>
                                                {(row as any[]).map((cell, ci) => (
                                                    <td
                                                        key={ci}
                                                        className="border border-slate-100 dark:border-white/10 px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                                                    >
                                                        {cell !== null && cell !== undefined ? String(cell) : ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesAdminPortal;
