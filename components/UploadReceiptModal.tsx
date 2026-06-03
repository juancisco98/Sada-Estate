import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { X, UploadCloud, FileText, AlertTriangle, Loader2, CheckCircle, Clock, Download, FileSpreadsheet, Info } from 'lucide-react';
import { Tenant, TenantPayment, Property, ExpenseSheet } from '../types';
import { uploadFile } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { paymentToDb } from '../utils/mappers';
import { parseExpenseSheet } from '../utils/expenseSheetParser';
import { toast } from 'sonner';
import { MONTH_NAMES, ALLOWED_EMAILS } from '../constants';
import { useDataContext } from '../context/DataContext';

// UUID v4 generator that works on HTTP (crypto.randomUUID requires HTTPS)
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Detecta si la URL del comprobante apunta a una imagen (ignora query string de Storage).
const isImageUrl = (url: string): boolean => {
    const clean = url.split('?')[0].toLowerCase();
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/.test(clean);
};

interface UploadReceiptModalProps {
    month: number;
    year: number;
    tenant: Tenant;
    property: Property | null;
    existingPayment?: TenantPayment;
    expenseSheet?: ExpenseSheet;
    onClose: () => void;
    onSuccess: (updatedPayment: TenantPayment) => void;
}

const UploadReceiptModal: React.FC<UploadReceiptModalProps> = ({
    month,
    year,
    tenant,
    property,
    existingPayment,
    expenseSheet,
    onClose,
    onSuccess
}) => {
    // ── Expense sheet data ──────────────────────────────────────────────────
    // Usa parsedData si existe; si no, parsea on-the-fly desde sheetData (legacy).
    const parsed = useMemo(() => {
        if (expenseSheet?.parsedData) return expenseSheet.parsedData;
        if (expenseSheet?.sheetData?.length) return parseExpenseSheet(expenseSheet.sheetData);
        return null;
    }, [expenseSheet]);
    const sheetTotal = parsed?.total ?? 0;
    const isPdfSheet = expenseSheet?.sourceType === 'pdf' && !!expenseSheet?.pdfUrl;

    // ── Form state ──────────────────────────────────────────────────────────
    const [expensesFile, setExpensesFile] = useState<File | null>(null);
    const [deletedExpenses, setDeletedExpenses] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState(
        existingPayment?.expenseAmount?.toString() || (sheetTotal > 0 ? sheetTotal.toString() : '')
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

    // Only locked when APPROVED — tenant can re-upload when REVISION
    const isLocked = existingPayment?.status === 'APPROVED';
    const isRevision = existingPayment?.status === 'REVISION';
    const isReturned = existingPayment?.status === 'RETURNED';

    const hasExpensesProof = expensesFile || (!deletedExpenses && existingPayment?.proofOfExpenses);

    // Comprobante a mostrar cuando el pago ya fue aprobado (expensas o, en su defecto, alquiler).
    const approvedProof = existingPayment?.proofOfExpenses || existingPayment?.proofOfPayment || '';

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setExpensesFile(e.target.files[0]);
        }
    };

    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        try {
            let expensesUrl = deletedExpenses ? '' : (existingPayment?.proofOfExpenses || '');

            const baseFolder = `tenants/${tenant.id}/${year}-${month}`;

            if (expensesFile) {
                const url = await uploadFile(expensesFile, `${baseFolder}/expenses`);
                if (!url) throw new Error('Error al subir el comprobante de expensas.');
                expensesUrl = url;
            }

            const todayString = new Date().toISOString().split('T')[0];

            const paymentRecord: TenantPayment = {
                id: existingPayment?.id || generateUUID(),
                tenantId: tenant.id,
                propertyId: property?.id || null,
                amount: existingPayment?.amount || 0,
                expenseAmount: expenseAmount ? (parseFloat(expenseAmount) || undefined) : existingPayment?.expenseAmount,
                currency: property?.currency || 'ARS',
                month,
                year,
                paidOnTime: true,
                paymentDate: existingPayment?.paymentDate || todayString,
                paymentMethod: existingPayment?.paymentMethod || 'TRANSFER',
                proofOfPayment: existingPayment?.proofOfPayment || '',
                proofOfExpenses: expensesUrl,
                status: 'REVISION',
                userId: tenant.userId,
                notes: existingPayment?.notes || 'Cargado por inquilino'
            };

            const { error } = await supabase
                .from('tenant_payments')
                .upsert(paymentToDb(paymentRecord));

            if (error) {
                console.error('Supabase error:', error);
                throw new Error(error.message || 'Error al guardar el pago en la base de datos.');
            }

            // Notify all admins (non-blocking)
            try {
                const notifInserts = ALLOWED_EMAILS.map(adminEmail => ({
                    recipient_email: adminEmail,
                    title: 'Nuevo comprobante recibido',
                    message: `${tenant.name} subió comprobantes de ${MONTH_NAMES[month - 1]} ${year}`,
                    type: 'PAYMENT_SUBMITTED',
                    payment_id: paymentRecord.id,
                }));
                await supabase.from('notifications').insert(notifInserts);
            } catch (notifError: any) {
                console.error('Notifications insert failed (non-blocking):', notifError);
            }

            toast.success('Comprobantes enviados correctamente.');
            onSuccess(paymentRecord);
        } catch (error: any) {
            console.error('Upload receipt error:', error);
            toast.error(error?.message || 'Ocurrió un error al guardar los comprobantes.');
            setShowConfirm(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInitiateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseAmount || isNaN(parseFloat(expenseAmount)) || parseFloat(expenseAmount) <= 0) {
            toast.error('Ingresá el monto de las expensas.');
            return;
        }
        if (!hasExpensesProof) {
            toast.error('Debés subir el comprobante de expensas.');
            return;
        }
        setShowConfirm(true);
    };

    const { loadExpenseSheetData } = useDataContext();

    const handleDownloadExcel = async () => {
        if (!expenseSheet || isDownloadingExcel) return;
        setIsDownloadingExcel(true);
        try {
            let data = expenseSheet.sheetData;
            if (!data || data.length === 0) {
                const loaded = await loadExpenseSheetData(expenseSheet.id);
                if (!loaded || loaded.length === 0) {
                    toast.error('No hay datos de Excel para descargar.');
                    return;
                }
                data = loaded;
            }
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, expenseSheet.sheetName || 'Expensas');
            XLSX.writeFile(wb, `Expensas_${MONTH_NAMES[month - 1]}_${year}.xlsx`);
        } catch (error: any) {
            toast.error(error?.message || 'No se pudo descargar el Excel.');
        } finally {
            setIsDownloadingExcel(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!parsed) return;
        const monthName = MONTH_NAMES[month - 1];
        const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
        const itemsHtml = parsed.items.map(it => `
            <tr>
                <td style="border:1px solid #ddd;padding:8px 12px;">${escapeHtml(it.concept)}</td>
                <td style="border:1px solid #ddd;padding:8px 12px;text-align:right;font-variant-numeric:tabular-nums;">$${it.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liquidación ${monthName} ${year}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#222}
h1{font-size:20px;margin-bottom:4px;color:#5b21b6}
p{font-size:13px;color:#666;margin-bottom:20px}
table{border-collapse:collapse;width:100%;font-size:13px}
th{background:#f5f3ff;color:#5b21b6;text-align:left;padding:8px 12px;border:1px solid #ddd;font-weight:600}
th.right{text-align:right}
tr.total td{background:#ede9fe;color:#4c1d95;font-weight:700;font-size:14px;padding:10px 12px}
@media print{body{margin:10px}}</style></head>
<body><h1>Liquidación de Expensas — ${monthName} ${year}</h1>
<p>${escapeHtml(tenant.name)}${property?.address ? ` · ${escapeHtml(property.address)}` : ''}</p>
<table>
    <thead><tr><th>Concepto</th><th class="right">Monto</th></tr></thead>
    <tbody>${itemsHtml}
        <tr class="total"><td>TOTAL</td><td style="text-align:right;font-variant-numeric:tabular-nums;">$${parsed.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </tbody>
</table>
</body></html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            setTimeout(() => win.print(), 400);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity"></div>
            <div
                className="bg-white border border-white/40 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[95vh] sm:max-h-[90vh] relative animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 rounded-t-3xl sm:rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {MONTH_NAMES[month - 1]} {year}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {expenseSheet ? 'Liquidación y carga de comprobante' : 'Carga de comprobante'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Cerrar"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-95"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1">
                    {showConfirm ? (
                        <div className="p-5">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5 text-center">
                                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-amber-800 mb-2">Atención</h3>
                                <p className="text-sm text-amber-700 font-medium">
                                    Revisá bien lo que subiste antes de confirmar.<br /><br />
                                    Una vez entregado, el mes quedará en estado de <b>Revisión</b> para la administración.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 border border-slate-200 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 bg-slate-600 rounded-2xl text-white font-bold hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center justify-center active:scale-95"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        "Confirmar Envío"
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleInitiateSubmit} className="p-5 space-y-4">

                            {isLocked ? (
                                /* APPROVED — locked */
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-emerald-800 mb-1">Pago aprobado</h3>
                                    <p className="text-sm text-emerald-700">
                                        La administración aprobó tu pago de {MONTH_NAMES[month - 1]} {year}.
                                    </p>
                                    {approvedProof ? (
                                        <div className="mt-4 pt-4 border-t border-emerald-200 text-left">
                                            <p className="text-xs font-bold text-emerald-700 mb-2 text-center uppercase tracking-wider">Tu comprobante</p>
                                            {isImageUrl(approvedProof) ? (
                                                <a href={approvedProof} target="_blank" rel="noopener noreferrer" className="block group relative rounded-xl overflow-hidden border border-emerald-200">
                                                    <img src={approvedProof} alt="Comprobante enviado" className="w-full max-h-[50vh] object-contain bg-white" />
                                                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/60 px-2.5 py-1 rounded-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                                        <FileText className="w-3 h-3" /> Ampliar
                                                    </span>
                                                </a>
                                            ) : (
                                                <a href={approvedProof} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl border border-emerald-200 bg-white text-sm font-bold text-slate-600 hover:underline">
                                                    <FileText className="w-4 h-4" /> Ver comprobante
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-xs text-emerald-600/80 italic">No hay un comprobante adjunto a este pago.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Status banners */}
                                    {isRevision && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                                            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-amber-800">En revisión</p>
                                                <p className="text-xs text-amber-700 mt-0.5">
                                                    Tu comprobante está siendo revisado por la administración.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {isReturned && (
                                        <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-red-800">Comprobante devuelto</p>
                                                <p className="text-xs text-red-700 mt-0.5">
                                                    La administración requiere que subas un nuevo comprobante.
                                                </p>
                                                {existingPayment?.notes && (
                                                    <p className="text-xs text-red-600 mt-1.5 italic font-medium">
                                                        Motivo: {existingPayment.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── LIQUIDACIÓN (hoja de Nora) ──────────────────────── */}
                                    {expenseSheet ? (
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                            {/* Sheet header */}
                                            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                                                    <span className="text-sm font-bold text-slate-800">Liquidación de expensas</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {isPdfSheet ? (
                                                        <a
                                                            href={expenseSheet!.pdfUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
                                                        >
                                                            <Download className="w-3 h-3" /> Descargar PDF
                                                        </a>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={handleDownloadPDF}
                                                                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
                                                            >
                                                                <Download className="w-3 h-3" /> PDF
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleDownloadExcel}
                                                                disabled={isDownloadingExcel}
                                                                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isDownloadingExcel ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />} Excel
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Total prominente */}
                                            {sheetTotal > 0 && (
                                                <div className="bg-slate-100/60 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                                                    <span className="text-sm font-semibold text-slate-700">Total a pagar</span>
                                                    <span className="text-lg font-black text-slate-900 tabular-nums">
                                                        ${sheetTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            )}

                                            {/* PDF embed: oculta toolbar de Chrome, ajusta al ancho */}
                                            {isPdfSheet && (
                                                <iframe
                                                    src={`${expenseSheet!.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                                    title="Liquidación PDF"
                                                    className="w-full h-[70vh] bg-white"
                                                />
                                            )}

                                            {/* Desglose estructurado (Excel) */}
                                            {!isPdfSheet && parsed && parsed.items.length > 0 && (
                                                <div className="max-h-72 overflow-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 sticky top-0">
                                                            <tr>
                                                                <th className="text-left px-3 py-2 font-semibold text-slate-500">Concepto</th>
                                                                <th className="text-right px-3 py-2 font-semibold text-slate-500">Monto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {parsed.items.map((it, i) => (
                                                                <tr key={i} className="border-t border-slate-100">
                                                                    <td className="px-3 py-2 text-slate-700">{it.concept}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                                                        ${it.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                                            <Info className="w-5 h-5 text-slate-400 shrink-0" />
                                            <p className="text-sm text-slate-500">
                                                La liquidación de este mes aún no fue cargada por la administración.
                                            </p>
                                        </div>
                                    )}

                                    {/* ── COMPROBANTE DE PAGO ─────────────────────────────── */}
                                    <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-700">
                                                Comprobante de pago <span className="text-xs font-normal text-red-400">*obligatorio</span>
                                            </h3>
                                            {hasExpensesProof && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Cargado</span>}
                                        </div>

                                        {/* Monto */}
                                        <div>
                                            <label htmlFor="expense-amount" className="block text-xs font-semibold text-slate-500 mb-1">Monto abonado</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-3 text-slate-500 font-bold">$</span>
                                                <input
                                                    id="expense-amount"
                                                    type="number"
                                                    value={expenseAmount}
                                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                                    placeholder="Ingresá el monto abonado"
                                                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-hidden transition-all text-slate-800 font-bold bg-white"
                                                />
                                            </div>
                                        </div>

                                        {/* File upload */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Comprobante</label>
                                            {existingPayment?.proofOfExpenses && !deletedExpenses && (
                                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2">
                                                    <span className="text-sm text-slate-600 flex items-center gap-2">
                                                        <FileText className="w-4 h-4" />
                                                        {expensesFile ? 'Reemplazando archivo...' : 'Comprobante subido'}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <a href={existingPayment.proofOfExpenses} target="_blank" rel="noopener noreferrer" className="text-slate-600 text-sm font-bold hover:underline">Ver</a>
                                                        <button type="button" onClick={() => { setDeletedExpenses(true); setExpensesFile(null); }} className="text-red-400 hover:text-red-600 transition-colors" title="Eliminar archivo">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all">
                                                <div className="flex items-center gap-2 py-3">
                                                    {expensesFile ? (
                                                        <>
                                                            <FileText className="w-4 h-4 text-slate-500" />
                                                            <p className="text-xs font-medium text-slate-800 truncate max-w-[220px]">{expensesFile.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UploadCloud className="w-4 h-4 text-slate-400" />
                                                            <p className="text-xs text-slate-500 font-medium">
                                                                {existingPayment?.proofOfExpenses ? 'Subir nuevo comprobante' : 'Adjuntar comprobante de pago'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <div className="pt-1">
                                        <button
                                            type="submit"
                                            className="w-full py-3 bg-slate-600 rounded-2xl text-white font-bold hover:bg-slate-700 transition-all active:scale-95"
                                        >
                                            Enviar Comprobante
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadReceiptModal;
