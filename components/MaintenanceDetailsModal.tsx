import React, { useState } from 'react';
import { Property, MaintenanceTask, PartialExpense } from '../types';
import { X, Plus, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface MaintenanceDetailsModalProps {
    property: Property;
    task: MaintenanceTask;
    professionalName: string;
    onClose: () => void;
    onAddExpense: (propertyId: string, expense: { description: string, amount: number, date: string, by: string }) => void;
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

    const partialExpenses = task.partialExpenses || [];
    const totalPartialCost = partialExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    const handleAdd = () => {
        if (!description || !amount) return;

        onAddExpense(property.id, {
            description,
            amount: parseFloat(amount),
            date: new Date().toISOString(),
            by: 'User' // In a real app, use current user name
        });

        setDescription('');
        setAmount('');
        setIsAdding(false);
    };

    return (
        <div className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-orange-50 p-6 border-b border-orange-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2">
                            🚧 Detalle de Obra
                        </h2>
                        <p className="text-sm text-orange-700 mt-1 font-medium">
                            {property.address}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-700 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Task Info */}
                <div className="p-6 bg-white shrink-0">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Profesional</p>
                        <p className="font-bold text-gray-900">{professionalName}</p>

                        <div className="border-t border-gray-200 my-2"></div>

                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Tarea</p>
                        <p className="text-sm text-gray-700 italic">"{task.description}"</p>
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                            <h3 className="font-bold text-gray-900">Gastos Parciales</h3>
                            <p className="text-xs text-gray-500">Materiales y adelantos</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase font-bold">Total Acumulado</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPartialCost, property.currency)}</p>
                        </div>
                    </div>
                </div>

                {/* List of Expenses */}
                <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3 custom-scrollbar">
                    {partialExpenses.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                            <p>No hay gastos registrados.</p>
                        </div>
                    ) : (
                        partialExpenses.map((expense) => (
                            <div key={expense.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                <div>
                                    <p className="font-semibold text-gray-800">{expense.description}</p>
                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {new Date(expense.date).toLocaleDateString()}
                                    </p>
                                </div>
                                <p className="font-bold text-gray-900">
                                    {formatCurrency(expense.amount, property.currency)}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* Add New Expense Form */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                    {isAdding ? (
                        <div className="space-y-3 animate-in slide-in-from-bottom-2">
                            <input
                                type="text"
                                placeholder="Descripción (ej. Materiales, Adelanto)"
                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        type="number"
                                        placeholder="Monto"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none font-bold"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleAdd}
                                    className="bg-gray-900 text-white px-6 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-transform active:scale-95"
                                >
                                    Guardar
                                </button>
                            </div>
                            <button
                                onClick={() => setIsAdding(false)}
                                className="w-full text-center text-xs text-gray-500 hover:text-gray-800 mt-2"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
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
