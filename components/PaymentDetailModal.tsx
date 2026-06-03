import React from 'react';
import { X, FileText, CheckCircle, Clock, RotateCcw, ExternalLink, Calendar, Home, CreditCard } from 'lucide-react';
import { TenantPayment, Property } from '../types';
import { MONTH_NAMES } from '../constants';

interface PaymentDetailModalProps {
    payment: TenantPayment;
    property: Property | null;
    onClose: () => void;
}

// Detecta si la URL del comprobante apunta a una imagen (ignora query string de Storage).
const isImageUrl = (url: string): boolean => {
    const clean = url.split('?')[0].toLowerCase();
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/.test(clean);
};

const statusMeta = (status?: string) => {
    switch (status) {
        case 'APPROVED':
            return { label: 'Aprobado', icon: CheckCircle, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
        case 'RETURNED':
            return { label: 'Corregir', icon: RotateCcw, cls: 'text-amber-800 bg-amber-50 border-amber-300' };
        case 'REVISION':
            return { label: 'En revisión', icon: Clock, cls: 'text-amber-700 bg-amber-50 border-amber-200' };
        default:
            return { label: 'Pendiente', icon: Clock, cls: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
};

const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({ payment, property, onClose }) => {
    const amount = payment.expenseAmount ?? payment.amount ?? 0;
    const methodLabel = payment.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia';
    const proof = payment.proofOfExpenses || payment.proofOfPayment || '';
    const status = statusMeta(payment.status);
    const StatusIcon = status.icon;

    return (
        <div
            className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity" />
            <div
                className="bg-white border border-white/40 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[95vh] sm:max-h-[90vh] relative animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 rounded-t-3xl sm:rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Detalle del pago</h2>
                        <p className="text-xs text-slate-500">
                            {MONTH_NAMES[payment.month - 1]} {payment.year}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-95"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                    {/* Monto destacado */}
                    <div className="text-center">
                        <p className="text-3xl font-black text-slate-900 tabular-nums">
                            ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">{methodLabel}</p>
                    </div>

                    {/* Datos */}
                    <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500 flex items-center gap-2"><Calendar className="w-4 h-4" /> Fecha de pago</span>
                            <span className="text-sm font-semibold text-slate-800">{payment.paymentDate || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Método</span>
                            <span className="text-sm font-semibold text-slate-800">{methodLabel}</span>
                        </div>
                        {property?.address && (
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm text-slate-500 flex items-center gap-2"><Home className="w-4 h-4" /> Propiedad</span>
                                <span className="text-sm font-semibold text-slate-800 text-right max-w-[60%] truncate">{property.address}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500">Estado</span>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${status.cls}`}>
                                <StatusIcon className="w-3.5 h-3.5" /> {status.label}
                            </span>
                        </div>
                    </div>

                    {/* Comprobante */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-2">Comprobante</h3>
                        {!proof ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-sm text-slate-500">
                                No hay comprobante adjunto.
                            </div>
                        ) : isImageUrl(proof) ? (
                            <a href={proof} target="_blank" rel="noopener noreferrer" className="block group relative rounded-2xl overflow-hidden border border-slate-200">
                                <img src={proof} alt="Comprobante" className="w-full max-h-[55vh] object-contain bg-slate-100" />
                                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/60 px-2.5 py-1 rounded-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                    <ExternalLink className="w-3 h-3" /> Ampliar
                                </span>
                            </a>
                        ) : (
                            <a
                                href={proof}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                            >
                                <FileText className="w-4 h-4" /> Ver comprobante
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentDetailModal;
