import React, { useState, useMemo, useEffect } from 'react';
import { User, TenantPayment, Tenant } from '../types';
import { useDataContext } from '../context/DataContext';
import { MONTH_NAMES } from '../constants';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import UploadReceiptModal from './UploadReceiptModal';
import { LogOut, Calendar, Clock, CheckCircle, AlertCircle, Home, ExternalLink, Bell, RotateCcw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    payment_id: string | null;
    read: boolean;
    created_at: string;
}

interface TenantPortalProps {
    currentUser: User;
    onLogout: () => void;
}

const TenantPortal: React.FC<TenantPortalProps> = ({ currentUser, onLogout }) => {
    const { tenants, payments, properties, setPayments, expenseSheets } = useDataContext();
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const currentYear = new Date().getFullYear();

    // Find the tenant record corresponding to the current user
    const tenantRecord = useMemo(() => {
        return tenants.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
    }, [tenants, currentUser]);

    const tenantProperty = useMemo(() => {
        if (!tenantRecord?.propertyId) return null;
        return properties.find(p => p.id === tenantRecord.propertyId) || null;
    }, [tenantRecord, properties]);

    const tenantPaymentsThisYear = useMemo(() => {
        if (!tenantRecord) return [];
        return payments.filter(p => p.tenantId === tenantRecord.id && p.year === currentYear);
    }, [payments, tenantRecord, currentYear]);

    // Expense sheets for this tenant (current year)
    const tenantExpenseSheetsThisYear = useMemo(() => {
        if (!tenantRecord) return [];
        return expenseSheets.filter(s => s.tenantId === tenantRecord.id && s.year === currentYear);
    }, [expenseSheets, tenantRecord, currentYear]);

    // Load unread notifications for this tenant
    useEffect(() => {
        if (!currentUser?.email) return;
        const load = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_email', currentUser.email)
                .eq('read', false)
                .order('created_at', { ascending: false });
            if (data) setNotifications(data as Notification[]);
        };
        load();

        // Real-time: new notifications arrive
        const channel = supabase
            .channel('tenant_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${currentUser.email}` },
                (payload) => setNotifications(prev => [payload.new as Notification, ...prev])
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentUser?.email]);

    const revisionNotifications = notifications.filter(n => n.type === 'PAYMENT_REVISION');

    const markNotificationsRead = async (paymentId: string | null) => {
        const toMark = notifications.filter(n => n.type === 'PAYMENT_REVISION' && (paymentId === null || n.payment_id === paymentId));
        if (toMark.length === 0) return;
        const ids = toMark.map(n => n.id);
        await supabase.from('notifications').update({ read: true }).in('id', ids);
        setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    };

    const markAllNotificationsRead = async () => {
        if (notifications.length === 0) return;
        const ids = notifications.map(n => n.id);
        await supabase.from('notifications').update({ read: true }).in('id', ids);
        setNotifications([]);
        setShowNotifDropdown(false);
    };

    const getNotifIcon = (type: string) => {
        if (type === 'PAYMENT_APPROVED') return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
        if (type === 'PAYMENT_REVISION') return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
        return <Bell className="w-4 h-4 text-indigo-500 shrink-0" />;
    };

    const handleNotifClick = (n: Notification) => {
        const payment = tenantPaymentsThisYear.find(p => p.id === n.payment_id);
        if (payment) setSelectedMonth(payment.month);
        markNotificationsRead(n.payment_id);
        setShowNotifDropdown(false);
    };

    // If no tenant record is found (shouldn't happen due to login check, but fallback)
    if (!tenantRecord) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
                <div className="bg-white dark:bg-slate-900 border border-white/40 dark:border-white/10 p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">No se encontró tu perfil</h2>
                    <p className="text-gray-600 dark:text-slate-400 mb-6">Contactate con la administración para que vinculen tu cuenta de correo.</p>
                    <button
                        onClick={onLogout}
                        className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    const handleUploadComplete = (newPayment: TenantPayment) => {
        setPayments(prev => {
            const exists = prev.find(p => p.id === newPayment.id);
            if (exists) return prev.map(p => p.id === newPayment.id ? newPayment : p);
            return [...prev, newPayment];
        });
        markNotificationsRead(newPayment.id);
        setSelectedMonth(null);
    };

    const getMonthStatus = (monthIndex: number) => {
        const payment = tenantPaymentsThisYear.find(p => p.month === monthIndex + 1);
        if (!payment) return 'PENDING';
        if (payment.status === 'APPROVED') return 'PAID';
        if (payment.status === 'RETURNED') return 'RETURNED';
        if (payment.status === 'REVISION') return 'REVISION';
        if (payment.proofOfPayment || payment.proofOfExpenses) return 'REVISION';
        return 'PENDING';
    };

    return (
        <div className="h-screen bg-gray-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
            {/* HEADER */}
            <header className="bg-gradient-to-r from-indigo-600 to-violet-700 dark:from-indigo-900 dark:to-violet-900 text-white px-5 sm:px-8 py-5 sm:py-6 flex items-center justify-between sticky top-0 z-10 shadow-lg shadow-indigo-900/20 shrink-0">
                <div className="flex items-center gap-4">
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white/20 shadow-md bg-white/10" />
                    ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl sm:text-2xl border-2 border-white/20 shadow-md">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold leading-tight">Hola, {currentUser.name.split(' ')[0]}</h1>
                        <p className="text-indigo-100/90 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                            <Home className="w-3.5 h-3.5" /> {tenantProperty ? tenantProperty.address : 'Miembro Inquilino'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* NOTIFICATION BELL */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifDropdown(v => !v)}
                            className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all flex items-center justify-center relative"
                            title="Notificaciones"
                        >
                            <Bell className="w-6 h-6" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                                    {notifications.length > 9 ? '9+' : notifications.length}
                                </span>
                            )}
                        </button>
                        {/* Dropdown */}
                        {showNotifDropdown && (
                            <div className="absolute right-0 top-14 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
                                    <span className="font-bold text-slate-800 dark:text-white text-sm">Notificaciones</span>
                                    {notifications.length > 0 && (
                                        <button onClick={markAllNotificationsRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                            Marcar todas leídas
                                        </button>
                                    )}
                                </div>
                                {notifications.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-6">Sin notificaciones</p>
                                ) : (
                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                                        {notifications.map(n => (
                                            <button
                                                key={n.id}
                                                onClick={() => handleNotifClick(n)}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                            >
                                                {getNotifIcon(n.type)}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{n.title}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onLogout}
                        className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all group flex items-center justify-center"
                        title="Cerrar sesión"
                    >
                        <LogOut className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </header>

            {/* BODY */}
            <main className="flex-1 overflow-y-auto min-h-0 max-w-3xl w-full mx-auto p-4 sm:p-6 pb-20">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Panel de Pagos {currentYear}</h2>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
                        Seleccioná el mes correspondiente para subir tus comprobantes de alquiler y expensas.
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 ml-1">Los comprobantes son revisados por la administración. Si hay algún error, serás notificado.</span>
                    </p>
                </div>

                {/* REVISION NOTIFICATIONS BANNER */}
                {revisionNotifications.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">
                                La administración requiere correcciones en tus comprobantes
                            </p>
                            {revisionNotifications.map(n => {
                                const payment = tenantPaymentsThisYear.find(p => p.id === n.payment_id);
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => { if (payment) setSelectedMonth(payment.month); }}
                                        className="block text-xs text-amber-700 dark:text-amber-300 mt-1 hover:underline text-left"
                                    >
                                        → {n.message}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* CALENDAR GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {MONTH_NAMES.map((monthName, index) => {
                        const status = getMonthStatus(index);
                        const payment = tenantPaymentsThisYear.find(p => p.month === index + 1);

                        return (
                            <button
                                key={monthName}
                                onClick={() => setSelectedMonth(index + 1)}
                                className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl cursor-pointer shadow-sm
                  ${status === 'PAID' ? 'border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-500/10 dark:to-emerald-500/5 shadow-emerald-100 dark:shadow-none' : ''}
                  ${status === 'REVISION' ? 'border-amber-200 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-500/10 dark:to-amber-500/5 shadow-amber-100 dark:shadow-none' : ''}
                  ${status === 'RETURNED' ? 'border-amber-300 dark:border-amber-400/40 bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-500/15 dark:to-amber-500/5 shadow-amber-100 dark:shadow-none' : ''}
                  ${status === 'INCOMPLETE' ? 'border-orange-200 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 to-orange-100/40 dark:from-orange-500/10 dark:to-orange-500/5 shadow-orange-100 dark:shadow-none' : ''}
                  ${status === 'PENDING' ? 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-indigo-100 dark:hover:shadow-none' : ''}
                `}
                            >
                                <span className={`text-base sm:text-lg font-bold mb-1.5 transition-colors
                  ${status === 'PAID' ? 'text-emerald-800 dark:text-emerald-400' : ''}
                  ${status === 'REVISION' ? 'text-amber-800 dark:text-amber-400' : ''}
                  ${status === 'RETURNED' ? 'text-amber-900 dark:text-amber-300' : ''}
                  ${status === 'INCOMPLETE' ? 'text-orange-800 dark:text-orange-400' : ''}
                  ${status === 'PENDING' ? 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-900 dark:group-hover:text-white' : ''}
                `}>
                                    {monthName}
                                </span>

                                <div className="flex flex-col items-center gap-1 mt-1">
                                    {status === 'PAID' && (
                                        <>
                                            <CheckCircle className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mt-0.5">Aprobado</span>
                                        </>
                                    )}
                                    {status === 'REVISION' && (
                                        <>
                                            <Clock className="text-amber-600 dark:text-amber-400 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mt-0.5">En Revisión</span>
                                        </>
                                    )}
                                    {status === 'RETURNED' && (
                                        <>
                                            <RotateCcw className="text-amber-600 dark:text-amber-300 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-0.5">Corregir</span>
                                        </>
                                    )}
                                    {status === 'INCOMPLETE' && (
                                        <>
                                            <AlertCircle className="text-orange-500 dark:text-orange-400 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mt-0.5">Incompleto</span>
                                        </>
                                    )}
                                    {status === 'PENDING' && (
                                        <>
                                            <Calendar className="text-slate-300 dark:text-slate-600 w-6 h-6 group-hover:text-indigo-400 dark:group-hover:text-indigo-400 transition-colors" />
                                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Pendiente</span>
                                        </>
                                    )}
                                </div>
                                {payment && payment.amount > 0 && status !== 'PENDING' && (
                                    <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 w-full text-center">
                                        <span className="text-[13px] font-extrabold text-slate-700 dark:text-slate-200 tabular-nums">${payment.amount.toLocaleString('es-AR')}</span>
                                    </div>
                                )}
                                {status === 'RETURNED' && payment?.notes && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-400/20 w-full text-center">
                                        <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight line-clamp-2">{payment.notes}</p>
                                    </div>
                                )}
                                {(status === 'PAID' || status === 'REVISION' || status === 'RETURNED') && (
                                    <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-black/5 dark:border-white/10 w-full">
                                        {payment?.proofOfPayment && (
                                            <a
                                                href={payment.proofOfPayment}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                                                title="Ver comprobante de alquiler"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3 h-3" /> Alquiler
                                            </a>
                                        )}
                                        {payment?.proofOfExpenses && (
                                            <a
                                                href={payment.proofOfExpenses}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                                                title="Ver comprobante de expensas"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3 h-3" /> Expensas
                                            </a>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Detalle de Expensas — tabla cargada por Nora */}
                {tenantExpenseSheetsThisYear.length > 0 && (
                    <div className="mt-8 space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Detalle de Expensas {currentYear}
                        </h3>
                        {tenantExpenseSheetsThisYear
                            .sort((a, b) => a.month - b.month)
                            .map(sheet => {
                                const rows = sheet.sheetData || [];
                                // Extraer info clave del Excel
                                const row7 = (rows[7] || []).map((c: any) => String(c ?? '').trim()).filter(Boolean).join(' ');
                                const row8 = rows[8] || [];
                                const totalAmount = row8
                                    .map((c: any) => typeof c === 'number' ? c : parseFloat(String(c).replace(/[^0-9.,]/g, '').replace(',', '.')))
                                    .find((n: number) => !isNaN(n) && n > 0) || 0;

                                // Filas de conceptos: desde fila 8 en adelante, filtrar filas vacías
                                const conceptRows = rows.slice(8).filter((row: any[]) =>
                                    row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined)
                                );

                                return (
                                    <div key={sheet.id} className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden shadow-sm">
                                        {/* Header */}
                                        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                {MONTH_NAMES[sheet.month - 1]} {sheet.year}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-400">Actualizado: {sheet.uploadedAt ? new Date(sheet.uploadedAt).toLocaleDateString('es-AR') : '—'}</span>
                                                <button
                                                    onClick={() => {
                                                        const ws = XLSX.utils.aoa_to_sheet(sheet.sheetData || []);
                                                        const wb = XLSX.utils.book_new();
                                                        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName || 'Expensas');
                                                        XLSX.writeFile(wb, `Expensas_${MONTH_NAMES[sheet.month - 1]}_${sheet.year}.xlsx`);
                                                    }}
                                                    className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 bg-violet-50 dark:bg-violet-500/10 px-2.5 py-1.5 rounded-lg border border-violet-200 dark:border-violet-500/20 transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5" /> Descargar
                                                </button>
                                            </div>
                                        </div>

                                        {rows.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-6">Sin datos</p>
                                        ) : (
                                            <div className="p-4 space-y-3">
                                                {/* Inquilino + unidad */}
                                                {row7 && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{row7}</p>
                                                )}

                                                {/* Monto total prominente */}
                                                {totalAmount > 0 && (
                                                    <div className="bg-violet-50 dark:bg-violet-500/10 rounded-xl px-4 py-3 flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">Total a pagar</span>
                                                        <span className="text-lg font-black text-violet-900 dark:text-violet-200">
                                                            ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Conceptos */}
                                                {conceptRows.length > 0 && (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs">
                                                            <tbody>
                                                                {conceptRows.map((row: any[], ri: number) => {
                                                                    const cells = (row as any[]).filter((c: any) => c !== '' && c !== null && c !== undefined);
                                                                    if (cells.length === 0) return null;
                                                                    const isTotal = cells.some((c: any) => String(c).toUpperCase().includes('TOTAL'));
                                                                    return (
                                                                        <tr
                                                                            key={ri}
                                                                            className={isTotal
                                                                                ? 'bg-slate-100 dark:bg-white/5 font-bold'
                                                                                : ri % 2 === 0
                                                                                    ? 'bg-slate-50/50 dark:bg-white/[0.02]'
                                                                                    : ''
                                                                            }
                                                                        >
                                                                            {(row as any[]).map((cell, ci) => (
                                                                                <td
                                                                                    key={ci}
                                                                                    className="border border-slate-100 dark:border-white/10 px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                                                                                >
                                                                                    {cell !== null && cell !== undefined ? String(cell) : ''}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        }
                    </div>
                )}
            </main>

            {/* MODAL Carga de comprobantes */}
            {selectedMonth && (
                <UploadReceiptModal
                    month={selectedMonth}
                    year={currentYear}
                    tenant={tenantRecord}
                    property={tenantProperty}
                    existingPayment={tenantPaymentsThisYear.find(p => p.month === selectedMonth)}
                    onClose={() => setSelectedMonth(null)}
                    onSuccess={handleUploadComplete}
                />
            )}
        </div>
    );
};

export default TenantPortal;
