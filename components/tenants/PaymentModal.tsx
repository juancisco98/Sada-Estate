import React from 'react';
import { X, CheckCircle, Upload, Loader, Trash2 } from 'lucide-react';
import { MONTH_NAMES_SHORT, NewPaymentForm, TenantPayment } from './shared';

interface PaymentModalProps {
    newPayment: NewPaymentForm;
    setNewPayment: React.Dispatch<React.SetStateAction<NewPaymentForm>>;
    editingPayment: TenantPayment | null;
    isUploading: boolean;
    onClose: () => void;
    onSave: () => void;
    onDelete: (payment: TenantPayment) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, field: 'proofOfPayment' | 'proofOfExpenses') => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    newPayment,
    setNewPayment,
    editingPayment,
    isUploading,
    onClose,
    onSave,
    onDelete,
    onFileUpload,
}) => {
    return (
        <div
            className="fixed inset-0 z-[1500] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"></div>
            <div
                className="bg-white dark:bg-slate-950 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in scale-95 duration-200 relative border border-white dark:border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Registrar Pago
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Monto Alquiler *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-2.5 text-gray-400">$</span>
                                <input
                                    value={newPayment.amount}
                                    onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                                    placeholder="0"
                                    type="number"
                                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-hidden transition-all font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Monto Expensas <span className="text-xs font-normal text-gray-400">(opcional)</span></label>
                            <div className="relative">
                                <span className="absolute left-4 top-2.5 text-gray-400">$</span>
                                <input
                                    value={newPayment.expenseAmount}
                                    onChange={e => setNewPayment(p => ({ ...p, expenseAmount: e.target.value }))}
                                    placeholder="0"
                                    type="number"
                                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-hidden transition-all font-bold"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Mes</label>
                            <select
                                value={newPayment.month}
                                onChange={e => setNewPayment(p => ({ ...p, month: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-green-500 outline-hidden transition-all bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                            >
                                {MONTH_NAMES_SHORT.map((name, i) => (
                                    <option key={i} value={i + 1}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Año</label>
                            <input
                                value={newPayment.year}
                                onChange={e => setNewPayment(p => ({ ...p, year: parseInt(e.target.value) }))}
                                type="number"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-green-500 outline-hidden transition-all bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-white/5">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            ¿Pagó a tiempo?
                        </label>
                        <button
                            onClick={() => setNewPayment(p => ({ ...p, paidOnTime: !p.paidOnTime }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${newPayment.paidOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                            {newPayment.paidOnTime ? 'Sí, a tiempo' : 'No, con retraso'}
                        </button>
                    </div>

                    {/* Proof Upload (Redesigned) */}
                    <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                            Comprobante de Pago
                        </label>

                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => onFileUpload(e, 'proofOfPayment')}
                            className="hidden"
                            id="proof-upload"
                            disabled={isUploading}
                        />

                        {newPayment.proofOfPayment ? (
                            <div className="flex items-center justify-between bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 p-2 rounded-lg">
                                <a
                                    href={newPayment.proofOfPayment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-semibold text-green-700 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                >
                                    <CheckCircle size={12} /> Ver Alquiler
                                </a>
                                <button
                                    onClick={() => setNewPayment(p => ({ ...p, proofOfPayment: '' }))}
                                    className="p-1 hover:bg-green-100 dark:hover:bg-emerald-500/20 rounded-sm text-red-400 dark:text-rose-400"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label
                                htmlFor="proof-upload"
                                className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-gray-300 dark:border-white/10 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-400 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                                {isUploading ? 'Subiendo...' : 'Adjuntar Alquiler'}
                            </label>
                        )}

                        {/* EXPENSAS PROOF */}
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => onFileUpload(e, 'proofOfExpenses')}
                            className="hidden"
                            id="expenses-upload"
                            disabled={isUploading}
                        />

                        {newPayment.proofOfExpenses ? (
                            <div className="flex items-center justify-between bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 p-2 rounded-lg mt-2">
                                <a
                                    href={newPayment.proofOfExpenses}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-semibold text-green-700 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                >
                                    <CheckCircle size={12} /> Ver Expensas
                                </a>
                                <button
                                    onClick={() => setNewPayment(p => ({ ...p, proofOfExpenses: '' }))}
                                    className="p-1 hover:bg-green-100 dark:hover:bg-emerald-500/20 rounded-sm text-red-400 dark:text-rose-400"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label
                                htmlFor="expenses-upload"
                                className={`flex items-center justify-center gap-2 mt-2 w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-white/10 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-white/20 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                                {isUploading ? 'Subiendo...' : 'Adjuntar Expensas'}
                            </label>
                        )}

                    </div>

                    {/* ESTADO DEL PAGO */}
                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Estado del Pago</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setNewPayment(p => ({ ...p, status: 'APPROVED' }))}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all ${newPayment.status === 'APPROVED' ? 'bg-green-50 dark:bg-emerald-500/20 border-green-200 dark:border-emerald-500/30 text-green-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                Aprobado
                            </button>
                            <button
                                onClick={() => setNewPayment(p => ({ ...p, status: 'REVISION' }))}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all ${newPayment.status === 'REVISION' ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                En Revisión
                            </button>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600">Método de Pago</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setNewPayment(p => ({ ...p, paymentMethod: 'CASH' }))}
                                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${newPayment.paymentMethod === 'CASH' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                Efectivo
                            </button>
                            <button
                                onClick={() => setNewPayment(p => ({ ...p, paymentMethod: 'TRANSFER' }))}
                                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${newPayment.paymentMethod === 'TRANSFER' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                Transferencia
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Notas</label>
                        <textarea
                            value={newPayment.notes}
                            onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Detalles adicionales..."
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-green-500 outline-hidden transition-all resize-none bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                        />
                    </div>
                </div>

                <div className="p-6 pt-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-slate-950 shrink-0 space-y-2">
                    <button
                        onClick={onSave}
                        disabled={!newPayment.amount}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${newPayment.amount ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                    >
                        {editingPayment ? 'Guardar Cambios' : 'Registrar Pago'}
                    </button>
                    {editingPayment && (
                        <button
                            onClick={() => onDelete(editingPayment)}
                            className="w-full py-2.5 rounded-xl font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-[0.98] text-sm"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Trash2 size={14} /> Eliminar este pago
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
