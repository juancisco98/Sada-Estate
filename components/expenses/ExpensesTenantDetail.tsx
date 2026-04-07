import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Tenant, Property, TenantPayment, ExpenseSheet, User, ParsedExpenseSheet } from '../../types';
import { MONTH_NAMES } from '../../constants';
import { parseExpenseSheet } from '../../utils/expenseSheetParser';
import { uploadFile } from '../../services/storage';
import {
    ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, Clock, RotateCcw,
    FileSpreadsheet, ExternalLink, Upload, X, AlertCircle, Trash2
} from 'lucide-react';

interface ExpensesTenantDetailProps {
    tenant: Tenant;
    property: Property | null;
    year: number;
    onYearChange: (year: number) => void;
    onBack: () => void;
    payments: TenantPayment[];
    expenseSheets: ExpenseSheet[];
    onApprove: (payment: TenantPayment) => Promise<void>;
    onReturn: (payment: TenantPayment, reason: string) => Promise<void>;
    onUploadSingleSheet: (tenantId: string, month: number, year: number, sheetData: any[][], sheetName: string, parsedData: ParsedExpenseSheet, sourceType: 'excel' | 'pdf', pdfUrl?: string) => Promise<void>;
    onDeleteSheet: (sheetId: string) => Promise<void>;
    currentUser: User;
}

const ExpensesTenantDetail: React.FC<ExpensesTenantDetailProps> = ({
    tenant, property, year, onYearChange, onBack,
    payments, expenseSheets, onApprove, onReturn, onUploadSingleSheet, onDeleteSheet, currentUser,
}) => {
    // ── State ────────────────────────────────────────────────────────────────
    const [returningId, setReturningId] = useState<string | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Sheet viewer
    const [viewingSheet, setViewingSheet] = useState<ExpenseSheet | null>(null);

    // Single sheet upload
    const [uploadingMonth, setUploadingMonth] = useState<number | null>(null);
    const [uploadType, setUploadType] = useState<'excel' | 'pdf' | null>(null);
    const [uploadParsedData, setUploadParsedData] = useState<any[][] | null>(null);
    const [uploadSheetName, setUploadSheetName] = useState('');
    const [uploadParsed, setUploadParsed] = useState<ParsedExpenseSheet | null>(null);
    const [uploadFileName, setUploadFileName] = useState('');
    const [uploadPdfFile, setUploadPdfFile] = useState<File | null>(null);
    const [uploadPdfTotal, setUploadPdfTotal] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Derived data ─────────────────────────────────────────────────────────
    const yearPayments = useMemo(() =>
        payments.filter(p => p.year === year),
        [payments, year]
    );
    const yearSheets = useMemo(() =>
        expenseSheets.filter(s => s.year === year),
        [expenseSheets, year]
    );

    // Summary stats
    const stats = useMemo(() => {
        let approved = 0, revision = 0, returned = 0, pending = 0;
        let totalApproved = 0;

        MONTH_NAMES.forEach((_, i) => {
            const monthNum = i + 1;
            const payment = yearPayments.find(p => p.month === monthNum);
            const hasExpenseData = payment && ((payment.expenseAmount ?? 0) > 0 || !!payment.proofOfExpenses);
            const status = hasExpenseData ? (payment.status || 'PENDING') : 'PENDING';

            if (status === 'APPROVED') { approved++; totalApproved += payment?.expenseAmount ?? 0; }
            else if (status === 'REVISION') revision++;
            else if (status === 'RETURNED') returned++;
            else pending++;
        });

        return { approved, revision, returned, pending, totalApproved };
    }, [yearPayments]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleApprove = async (payment: TenantPayment) => {
        setActionLoading(payment.id);
        try {
            await onApprove(payment);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReturn = async (payment: TenantPayment) => {
        if (!returnReason.trim()) { toast.error('Ingresá el motivo de devolución.'); return; }
        setActionLoading(payment.id);
        try {
            await onReturn(payment, returnReason.trim());
            setReturningId(null);
            setReturnReason('');
        } finally {
            setActionLoading(null);
        }
    };

    // ── Single sheet upload ──────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadFileName(file.name);

        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

        if (isPdf) {
            // Flujo PDF: guardar el File, total se ingresa manualmente
            setUploadType('pdf');
            setUploadPdfFile(file);
            setUploadPdfTotal('');
            setUploadParsedData(null);
            setUploadParsed(null);
            setUploadSheetName(file.name);
            e.target.value = '';
            return;
        }

        // Flujo Excel
        setUploadType('excel');
        setUploadPdfFile(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const ws = workbook.Sheets[firstSheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

                // Trim trailing empty rows
                while (rows.length > 0 && rows[rows.length - 1].every((c: any) => c === '' || c === null || c === undefined)) {
                    rows.pop();
                }

                const parsed = parseExpenseSheet(rows);
                setUploadParsedData(rows);
                setUploadSheetName(firstSheetName);
                setUploadParsed(parsed);
            } catch {
                toast.error('No se pudo leer el archivo Excel.');
                resetUpload();
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleUploadConfirm = async () => {
        if (uploadingMonth === null) return;
        setIsUploading(true);
        try {
            if (uploadType === 'pdf') {
                if (!uploadPdfFile) { toast.error('Seleccioná un archivo PDF.'); return; }
                const totalNum = parseFloat(uploadPdfTotal.replace(',', '.'));
                if (!isFinite(totalNum) || totalNum <= 0) { toast.error('Ingresá un total válido.'); return; }
                const folder = `expense-sheets/${tenant.id}/${year}-${uploadingMonth}`;
                const url = await uploadFile(uploadPdfFile, folder);
                if (!url) throw new Error('No se pudo subir el PDF.');
                const parsed: ParsedExpenseSheet = {
                    period: `${MONTH_NAMES[uploadingMonth - 1].toUpperCase()} ${year}`,
                    items: [],
                    total: totalNum,
                    currency: 'ARS',
                };
                await onUploadSingleSheet(tenant.id, uploadingMonth, year, [], uploadFileName, parsed, 'pdf', url);
            } else {
                if (!uploadParsedData || !uploadParsed) { toast.error('Seleccioná un Excel.'); return; }
                await onUploadSingleSheet(tenant.id, uploadingMonth, year, uploadParsedData, uploadSheetName, uploadParsed, 'excel');
            }
            toast.success(`Liquidación de ${MONTH_NAMES[uploadingMonth - 1]} subida correctamente.`);
            resetUpload();
        } catch (err: any) {
            toast.error(`Error: ${err?.message || 'No se pudo subir la liquidación.'}`);
        } finally {
            setIsUploading(false);
        }
    };

    const resetUpload = () => {
        setUploadingMonth(null);
        setUploadType(null);
        setUploadParsedData(null);
        setUploadSheetName('');
        setUploadParsed(null);
        setUploadFileName('');
        setUploadPdfFile(null);
        setUploadPdfTotal('');
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
                            {tenant.name}
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            {property?.unitLabel && `${property.unitLabel} · `}Vélez Sársfield 134
                        </p>
                    </div>
                </div>

                {/* Year navigator */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-1 py-1 shrink-0">
                    <button
                        onClick={() => onYearChange(year - 1)}
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </button>
                    <span className="text-sm font-bold text-slate-700 dark:text-white min-w-[48px] text-center tabular-nums">
                        {year}
                    </span>
                    <button
                        onClick={() => onYearChange(year + 1)}
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </button>
                </div>
            </header>

            {/* ── Summary strip ───────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-4 sm:px-6 py-3 shrink-0">
                <div className="flex items-center gap-4 flex-wrap text-xs font-semibold max-w-4xl mx-auto">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle size={14} />
                        {stats.approved} aprobado{stats.approved !== 1 ? 's' : ''}
                    </span>
                    {stats.revision > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <Clock size={14} />
                            {stats.revision} en revisión
                        </span>
                    )}
                    {stats.returned > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                            <RotateCcw size={14} />
                            {stats.returned} devuelto{stats.returned !== 1 ? 's' : ''}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        {stats.pending} pendiente{stats.pending !== 1 ? 's' : ''}
                    </span>
                    {stats.totalApproved > 0 && (
                        <span className="ml-auto text-sm font-bold text-slate-700 dark:text-white tabular-nums">
                            Total aprobado: ${stats.totalApproved.toLocaleString('es-AR')}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Month cards ─────────────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="max-w-4xl mx-auto space-y-2">
                    {MONTH_NAMES.map((monthName, i) => {
                        const monthNum = i + 1;
                        const payment = yearPayments.find(p => p.month === monthNum);
                        const sheet = yearSheets.find(s => s.month === monthNum);
                        const hasExpenseData = payment && ((payment.expenseAmount ?? 0) > 0 || !!payment.proofOfExpenses);
                        const status = hasExpenseData ? (payment.status || 'PENDING') : 'PENDING';
                        const isReturning = returningId === payment?.id;
                        const isLoading = actionLoading === payment?.id;

                        return (
                            <div key={monthName} className={`rounded-xl border p-4 transition-all ${
                                status === 'APPROVED' ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' :
                                status === 'REVISION' ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' :
                                status === 'RETURNED' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-400/30' :
                                'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-white/5'
                            }`}>
                                {/* Row 1: Month + Status + Amount */}
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 w-24">
                                            {monthName}
                                        </span>
                                        {status === 'APPROVED' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
                                                <CheckCircle size={10} /> Aprobado
                                            </span>
                                        )}
                                        {status === 'REVISION' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">
                                                <Clock size={10} /> En revisión
                                            </span>
                                        )}
                                        {status === 'RETURNED' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">
                                                <RotateCcw size={10} /> Devuelto
                                            </span>
                                        )}
                                    </div>
                                    {payment?.expenseAmount && (
                                        <span className="text-sm font-bold text-slate-700 dark:text-white tabular-nums">
                                            ${payment.expenseAmount.toLocaleString('es-AR')}
                                        </span>
                                    )}
                                </div>

                                {/* Row 2: Liquidación + Comprobante expensas */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Admin's liquidación sheet */}
                                    {sheet ? (
                                        <button
                                            onClick={() => setViewingSheet(sheet)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                                        >
                                            <FileSpreadsheet size={12} />
                                            Ver liquidación
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setUploadingMonth(monthNum);
                                                setUploadParsedData(null);
                                                setUploadFileName('');
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-2.5 py-1.5 rounded-lg transition-colors border border-dashed border-violet-200 dark:border-violet-500/30"
                                        >
                                            <Upload size={12} />
                                            Cargar liquidación
                                        </button>
                                    )}

                                    {/* Tenant's expense proof — ONLY expense, never rent */}
                                    {payment?.proofOfExpenses ? (
                                        <a
                                            href={payment.proofOfExpenses}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                                        >
                                            <ExternalLink size={12} />
                                            Comprobante expensas
                                        </a>
                                    ) : status !== 'PENDING' ? (
                                        <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 px-2.5 py-1.5">
                                            <ExternalLink size={12} />
                                            Sin comprobante
                                        </span>
                                    ) : null}

                                    {/* Replace / Delete sheet buttons (when sheet already exists) */}
                                    {sheet && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setUploadingMonth(monthNum);
                                                    setUploadParsedData(null);
                                                    setUploadFileName('');
                                                }}
                                                className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 px-2 py-1 rounded transition-colors"
                                            >
                                                <Upload size={10} />
                                                Reemplazar
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`¿Eliminar la liquidación de ${monthName}?`)) return;
                                                    try {
                                                        await onDeleteSheet(sheet.id);
                                                        toast.success(`Liquidación de ${monthName} eliminada.`);
                                                    } catch (err: any) {
                                                        toast.error(`Error: ${err?.message || 'No se pudo eliminar.'}`);
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded transition-colors"
                                            >
                                                <Trash2 size={10} />
                                                Eliminar
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Row 3: Return notes */}
                                {status === 'RETURNED' && payment?.notes && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
                                        Motivo: {payment.notes}
                                    </p>
                                )}

                                {/* Row 4: Actions (only for REVISION) */}
                                {status === 'REVISION' && payment && !isReturning && (
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                        <button
                                            onClick={() => handleApprove(payment)}
                                            disabled={isLoading}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            {isLoading ? <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                            Aprobar
                                        </button>
                                        <button
                                            onClick={() => { setReturningId(payment.id); setReturnReason(''); }}
                                            disabled={isLoading}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" /> Devolver
                                        </button>
                                    </div>
                                )}

                                {/* Return reason form */}
                                {isReturning && payment && (
                                    <div className="mt-3 space-y-2">
                                        <textarea
                                            value={returnReason}
                                            onChange={e => setReturnReason(e.target.value)}
                                            placeholder="Motivo de devolución (ej: El comprobante está borroso, subí uno más claro)"
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-400/30 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => { setReturningId(null); setReturnReason(''); }}
                                                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={() => handleReturn(payment)}
                                                disabled={isLoading || !returnReason.trim()}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 px-3 py-1.5 rounded-xl transition-colors"
                                            >
                                                {isLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                                Confirmar devolución
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* ── Single sheet upload modal ────────────────────────────────── */}
            {uploadingMonth !== null && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={resetUpload}
                >
                    <div
                        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] border-t sm:border border-slate-100 dark:border-white/10"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                    Cargar liquidación
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {tenant.name} · {MONTH_NAMES[uploadingMonth - 1]} {year}
                                </p>
                            </div>
                            <button onClick={resetUpload} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            {/* File picker */}
                            <label className="flex flex-col items-center justify-center w-full min-h-[80px] border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                    <FileSpreadsheet className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                                    {uploadFileName ? (
                                        <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">{uploadFileName}</p>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Seleccioná el archivo</p>
                                            <p className="text-xs text-slate-400">Excel (.xlsx, .xls) o PDF</p>
                                        </>
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.pdf" onChange={handleFileSelect} />
                            </label>

                            {/* Preview PDF */}
                            {uploadType === 'pdf' && uploadPdfFile && (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                                            <FileSpreadsheet className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{uploadPdfFile.name}</p>
                                            <p className="text-xs text-slate-400">PDF · {(uploadPdfFile.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                            Total a pagar <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                value={uploadPdfTotal}
                                                onChange={(e) => setUploadPdfTotal(e.target.value)}
                                                placeholder="Ingresá el total de la liquidación"
                                                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-bold focus:ring-2 focus:ring-violet-500 outline-none"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">El inquilino verá este monto y podrá descargar el PDF.</p>
                                    </div>
                                </div>
                            )}

                            {/* Preview estructurado (Excel) */}
                            {uploadType === 'excel' && uploadParsed && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Vista previa{uploadParsed.period ? ` — ${uploadParsed.period}` : ''}
                                        </p>
                                        <span className="text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                                            Total: ${uploadParsed.total.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                    <div className="max-h-56 overflow-auto rounded-xl border border-slate-100 dark:border-white/10">
                                        <table className="w-full text-xs border-collapse">
                                            <thead className="bg-slate-50 dark:bg-white/5 sticky top-0">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Concepto</th>
                                                    <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uploadParsed.items.map((it, i) => (
                                                    <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                                                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{it.concept}</td>
                                                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">${it.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))}
                                                <tr className="border-t-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/60 dark:bg-violet-500/10 font-bold">
                                                    <td className="px-3 py-2 text-violet-800 dark:text-violet-200">TOTAL</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-violet-800 dark:text-violet-200">${uploadParsed.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    {uploadParsed.items.length === 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            No se detectaron conceptos. Verificá el formato del Excel — solo se subirá el total.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 shrink-0 flex items-center justify-end gap-2">
                            <button
                                onClick={resetUpload}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUploadConfirm}
                                disabled={isUploading || (uploadType === 'excel' ? !uploadParsedData : !(uploadPdfFile && parseFloat(uploadPdfTotal.replace(',', '.')) > 0))}
                                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors"
                            >
                                {isUploading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                )}
                                Subir liquidación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Sheet data viewer modal ──────────────────────────────────── */}
            {viewingSheet && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setViewingSheet(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-100 dark:border-white/10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                    Liquidación de {tenant.name}
                                </h3>
                                <p className="text-xs text-slate-400">{MONTH_NAMES[viewingSheet.month - 1]} {viewingSheet.year} · Hoja: {viewingSheet.sheetName}</p>
                            </div>
                            <button onClick={() => setViewingSheet(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="overflow-auto p-4">
                            {viewingSheet.sourceType === 'pdf' && viewingSheet.pdfUrl ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                            Total: <span className="text-violet-600 dark:text-violet-400 tabular-nums">${(viewingSheet.parsedData?.total ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </span>
                                        <a
                                            href={viewingSheet.pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" /> Abrir PDF
                                        </a>
                                    </div>
                                    <iframe
                                        src={`${viewingSheet.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                        title="Liquidación PDF"
                                        className="w-full h-[70vh] rounded-xl border border-slate-200 dark:border-white/10"
                                    />
                                </div>
                            ) : (() => {
                                const parsed = viewingSheet.parsedData ?? parseExpenseSheet(viewingSheet.sheetData);
                                if (!parsed || (parsed.items.length === 0 && parsed.total === 0)) {
                                    return <p className="text-sm text-slate-400 text-center py-8">Sin datos en esta hoja.</p>;
                                }
                                return (
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="bg-slate-50 dark:bg-white/5">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Concepto</th>
                                                <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsed.items.map((it, i) => (
                                                <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{it.concept}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">${it.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                            <tr className="border-t-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/60 dark:bg-violet-500/10 font-bold">
                                                <td className="px-3 py-2 text-violet-800 dark:text-violet-200">TOTAL</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-violet-800 dark:text-violet-200">${parsed.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesTenantDetail;
