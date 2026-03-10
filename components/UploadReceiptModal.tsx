import React, { useState } from 'react';
import { X, UploadCloud, FileText, AlertTriangle, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Tenant, TenantPayment, Property } from '../types';
import { uploadFile } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { paymentToDb } from '../utils/mappers';
import { toast } from 'sonner';
import { MONTH_NAMES, ALLOWED_EMAILS } from '../constants';

// UUID v4 generator that works on HTTP (crypto.randomUUID requires HTTPS)
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface UploadReceiptModalProps {
    month: number;
    year: number;
    tenant: Tenant;
    property: Property | null;
    existingPayment?: TenantPayment;
    onClose: () => void;
    onSuccess: (updatedPayment: TenantPayment) => void;
}

const UploadReceiptModal: React.FC<UploadReceiptModalProps> = ({
    month,
    year,
    tenant,
    property,
    existingPayment,
    onClose,
    onSuccess
}) => {
    const [rentFile, setRentFile] = useState<File | null>(null);
    const [expensesFile, setExpensesFile] = useState<File | null>(null);
    const [deletedRent, setDeletedRent] = useState(false);
    const [deletedExpenses, setDeletedExpenses] = useState(false);
    const [rentAmount, setRentAmount] = useState(existingPayment?.amount?.toString() || property?.monthlyRent?.toString() || '');
    const [expenseAmount, setExpenseAmount] = useState(existingPayment?.expenseAmount?.toString() || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Only locked when APPROVED — tenant can re-upload when REVISION
    const isLocked = existingPayment?.status === 'APPROVED';
    const isRevision = existingPayment?.status === 'REVISION';

    const hasRentProof = rentFile || (!deletedRent && existingPayment?.proofOfPayment);
    const hasExpensesProof = expensesFile || (!deletedExpenses && existingPayment?.proofOfExpenses);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'rent' | 'expenses') => {
        if (e.target.files && e.target.files.length > 0) {
            if (type === 'rent') setRentFile(e.target.files[0]);
            if (type === 'expenses') setExpensesFile(e.target.files[0]);
        }
    };

    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        try {
            let rentUrl = deletedRent ? '' : (existingPayment?.proofOfPayment || '');
            let expensesUrl = deletedExpenses ? '' : (existingPayment?.proofOfExpenses || '');

            const baseFolder = `tenants/${tenant.id}/${year}-${month}`;

            if (rentFile) {
                const url = await uploadFile(rentFile, `${baseFolder}/rent`);
                if (!url) throw new Error('Error al subir el comprobante de alquiler.');
                rentUrl = url;
            }

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
                amount: parseFloat(rentAmount) || existingPayment?.amount || 0,
                expenseAmount: expenseAmount ? (parseFloat(expenseAmount) || undefined) : existingPayment?.expenseAmount,
                currency: property?.currency || 'ARS',
                month,
                year,
                paidOnTime: true,
                paymentDate: existingPayment?.paymentDate || todayString,
                paymentMethod: existingPayment?.paymentMethod || 'TRANSFER',
                proofOfPayment: rentUrl,
                proofOfExpenses: expensesUrl,
                status: 'REVISION',
                userId: tenant.userId,
                notes: existingPayment?.notes || 'Cargado por inquilino'
            };

            const { error } = await supabase
                .from('tenant_payments')
                .upsert(paymentToDb(paymentRecord));

            if (error) {
                logger.error('Supabase error:', error);
                throw new Error(error.message || 'Error al guardar el pago en la base de datos.');
            }

            // Notify all admins (non-blocking — don't let failures abort the payment success)
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
                logger.error('Notifications insert failed (non-blocking):', notifError);
                // Don't rethrow — payment was already saved successfully
            }

            toast.success('Comprobantes enviados correctamente.');
            onSuccess(paymentRecord);
        } catch (error: any) {
            logger.error('Upload receipt error:', error);
            toast.error(error?.message || 'Ocurrió un error al guardar los comprobantes.');
            setShowConfirm(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInitiateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // At least one proof must be present
        if (!hasRentProof && !hasExpensesProof) {
            toast.error('Debés subir al menos un comprobante (alquiler o expensas).');
            return;
        }
        // If submitting rent, amount is required
        if (hasRentProof && (!rentAmount || isNaN(parseFloat(rentAmount)) || parseFloat(rentAmount) <= 0)) {
            toast.error('Ingresá el monto del alquiler.');
            return;
        }
        // If submitting expenses, expense amount is required
        if (hasExpensesProof && (!expenseAmount || isNaN(parseFloat(expenseAmount)) || parseFloat(expenseAmount) <= 0)) {
            toast.error('Ingresá el monto de las expensas.');
            return;
        }
        setShowConfirm(true);
    };

    return (
        <div
            className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-4 sm:p-0"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md transition-opacity"></div>
            <div
                className="bg-white dark:bg-slate-900 border border-white/40 dark:border-white/10 rounded-3xl sm:rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] relative animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                            {MONTH_NAMES[month - 1]} {year}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Carga de comprobantes</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-95"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto">
                    {showConfirm ? (
                        <div className="p-6">
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 mb-6 text-center">
                                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-400 mb-2">Atención inquilino</h3>
                                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                                    Revisá bien lo que subiste antes de confirmar.<br /><br />
                                    Una vez entregado, el mes quedará en estado de <b>Revisión</b> para la administración.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    Volver y revisar
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 bg-indigo-600 rounded-2xl text-white font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center active:scale-95"
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
                        <form onSubmit={handleInitiateSubmit} className="p-6">

                            {isLocked ? (
                                /* APPROVED — locked */
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-5 text-center">
                                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-1">Pago aprobado ✓</h3>
                                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                        La administración aprobó tu pago de {MONTH_NAMES[month - 1]} {year}.
                                    </p>
                                    {(existingPayment?.proofOfPayment || existingPayment?.proofOfExpenses) && (
                                        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-500/20">
                                            {existingPayment.proofOfPayment && (
                                                <a href={existingPayment.proofOfPayment} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                                    <FileText className="w-4 h-4" /> Ver Alquiler
                                                </a>
                                            )}
                                            {existingPayment.proofOfExpenses && (
                                                <a href={existingPayment.proofOfExpenses} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                                    <FileText className="w-4 h-4" /> Ver Expensas
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* REVISION banner */}
                                    {isRevision && (
                                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                                            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Pago en revisión</p>
                                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                                    La administración requiere que revises tus comprobantes. Podés subir nuevos archivos o confirmar los actuales.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* ALQUILER */}
                                    <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Alquiler</h3>
                                            {hasRentProof && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Comprobante cargado</span>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Monto abonado</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-3 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    value={rentAmount}
                                                    onChange={(e) => setRentAmount(e.target.value)}
                                                    placeholder="Ingresá el monto del alquiler"
                                                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-white font-bold bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Comprobante</label>
                                            {existingPayment?.proofOfPayment && !deletedRent && (
                                                <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10 mb-2">
                                                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                        <FileText className="w-4 h-4" />
                                                        {rentFile ? 'Reemplazando archivo...' : 'Alquiler subido'}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <a href={existingPayment.proofOfPayment} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline">Ver</a>
                                                        <button type="button" onClick={() => { setDeletedRent(true); setRentFile(null); }} className="text-red-400 hover:text-red-600 transition-colors" title="Eliminar archivo">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-200 dark:border-white/20 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                                <div className="flex items-center gap-2 py-3">
                                                    {rentFile ? (
                                                        <>
                                                            <FileText className="w-4 h-4 text-indigo-500" />
                                                            <p className="text-xs font-medium text-slate-800 dark:text-white truncate max-w-[200px]">{rentFile.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UploadCloud className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                                {existingPayment?.proofOfPayment ? 'Subir nuevo archivo de alquiler' : 'Adjuntar comprobante de alquiler'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                <input type="file" className="hidden" accept="*/*" onChange={(e) => handleFileChange(e, 'rent')} />
                                            </label>
                                        </div>
                                    </div>

                                    {/* EXPENSAS */}
                                    <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Expensas <span className="text-xs font-normal text-slate-400">— podés subir después</span></h3>
                                            {hasExpensesProof && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Comprobante cargado</span>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Monto abonado</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-3 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    value={expenseAmount}
                                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                                    placeholder="Ingresá el monto de expensas"
                                                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-slate-800 dark:text-white font-bold bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Comprobante</label>
                                            {existingPayment?.proofOfExpenses && !deletedExpenses && (
                                                <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10 mb-2">
                                                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                        <FileText className="w-4 h-4" />
                                                        {expensesFile ? 'Reemplazando archivo...' : 'Expensas subidas'}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <a href={existingPayment.proofOfExpenses} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline">Ver</a>
                                                        <button type="button" onClick={() => { setDeletedExpenses(true); setExpensesFile(null); }} className="text-red-400 hover:text-red-600 transition-colors" title="Eliminar archivo">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-200 dark:border-white/20 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                                <div className="flex items-center gap-2 py-3">
                                                    {expensesFile ? (
                                                        <>
                                                            <FileText className="w-4 h-4 text-violet-500" />
                                                            <p className="text-xs font-medium text-slate-800 dark:text-white truncate max-w-[200px]">{expensesFile.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UploadCloud className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                                {existingPayment?.proofOfExpenses ? 'Subir nuevo archivo de expensas' : 'Adjuntar comprobante de expensas'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                <input type="file" className="hidden" accept="*/*" onChange={(e) => handleFileChange(e, 'expenses')} />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            className="w-full py-3 bg-indigo-600 rounded-2xl text-white font-bold hover:bg-indigo-700 transition-all active:scale-95"
                                        >
                                            Enviar Comprobantes
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
