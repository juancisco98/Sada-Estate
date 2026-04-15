import React, { useState } from 'react';
import { Property, MaintenanceTask } from '../types';
import { X, Plus, DollarSign, Calendar, Upload, CheckCircle, ExternalLink, Loader } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { uploadFile } from '../services/storage';
import { toast } from 'sonner';

interface MaintenanceDetailsModalProps {
    property: Property;
    task: MaintenanceTask;
    professionalName: string;
    onClose: () => void;
    onAddExpense: (propertyId: string, expense: { description: string, amount: number, date: string, by: string, proofUrl?: string }) => void;
}

const MaintenanceDetailsModal: React.FC<MaintenanceDetailsModalProps> = ({
    property,
    task,
    professionalName,
    onClose,
    onAddExpense
}) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const partialExpenses = task.partialExpenses || [];
    const totalPartialCost = partialExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const url = await uploadFile(file, `expenses/${property.id}`);
        setIsUploading(false);
        if (url) {
            setProofUrl(url);
        } else {
            toast.error('Error al subir el comprobante.');
        }
    };

    const handleAdd = () => {
        if (!description || !amount) return;

        onAddExpense(property.id, {
            description,
            amount: parseFloat(amount),
            date: new Date().toISOString(),
            by: 'User',
            ...(proofUrl && { proofUrl })
        });

        setDescription('');
        setAmount('');
        setProofUrl(null);
        setIsAdding(false);
    };

    return (
        <div className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border dark:border-white/10">

                {/* Header */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-amber-500">🚧</span> Detalle de Obra
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            {property.address}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Task Info */}
                <div className="p-6 bg-white dark:bg-slate-900 shrink-0">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-white/10 mb-4">
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Profesional</p>
                        <p className="font-bold text-slate-900 dark:text-white">{professionalName}</p>

                        <div className="border-t border-slate-200 dark:border-white/10 my-2"></div>

                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Tarea</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{task.description}"</p>
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Gastos Parciales</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Materiales y adelantos</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold">Total Acumulado</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalPartialCost, property.currency)}</p>
                        </div>
                    </div>
                </div>

                {/* List of Expenses */}
                <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3 custom-scrollbar">
                    {partialExpenses.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                            <p>No hay gastos registrados.</p>
                        </div>
                    ) : (
                        partialExpenses.map((expense) => (
                            <div key={expense.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 rounded-xl">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">{expense.description}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> {new Date(expense.date).toLocaleDateString()}
                                        </p>
                                        {expense.proofUrl && (
                                            <a
                                                href={expense.proofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 font-medium"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Comprobante
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(expense.amount, property.currency)}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* Add New Expense Form */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/10 shrink-0">
                    {isAdding ? (
                        <div className="space-y-3 animate-in slide-in-from-bottom-2">
                            <input
                                type="text"
                                placeholder="Descripción (ej. Materiales, Adelanto)"
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <DollarSign className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <input
                                        type="number"
                                        placeholder="Monto"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold placeholder-slate-400 dark:placeholder-slate-500"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleAdd}
                                    className="bg-indigo-600 text-white px-6 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-transform active:scale-95"
                                >
                                    Guardar
                                </button>
                            </div>

                            {/* File upload for proof */}
                            <div>
                                {isUploading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                        <Loader className="w-4 h-4 animate-spin" /> Subiendo...
                                    </div>
                                ) : proofUrl ? (
                                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex-1">Comprobante adjunto</span>
                                        <button onClick={() => setProofUrl(null)} className="text-xs text-red-500 hover:text-red-700 font-bold">Quitar</button>
                                    </div>
                                ) : (
                                    <label htmlFor="expense-proof-upload" className="flex items-center gap-2 cursor-pointer text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                        <Upload className="w-4 h-4" /> Adjuntar comprobante (opcional)
                                        <input
                                            id="expense-proof-upload"
                                            type="file"
                                            accept="image/*,application/pdf"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            <button
                                onClick={() => { setIsAdding(false); setProofUrl(null); }}
                                className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white mt-2 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 font-bold hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> Agregar Gasto Parcial
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MaintenanceDetailsModal;
