import React from 'react';
import { VoiceCommandResponse, Property } from '../types';

interface ExpenseConfirmationModalProps {
    pendingExpense: VoiceCommandResponse['data'];
    onClose: () => void;
    onConfirm: () => void;
}

export const ExpenseConfirmationModal: React.FC<ExpenseConfirmationModalProps> = ({
    pendingExpense,
    onClose,
    onConfirm
}) => {
    if (!pendingExpense) return null;

    return (
        <div className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Gasto</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Profesional</span>
                        <span className="font-semibold">{pendingExpense.professionalName || "No identificado"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Propiedad</span>
                        <span className="font-semibold">{pendingExpense.propertyAddressSnippet || "General"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-gray-900 font-bold">Monto Total</span>
                        <span className="text-2xl font-bold text-blue-600">
                            ${pendingExpense.amount?.toLocaleString('es-AR') || "0"}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">"{pendingExpense.description}"</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={onClose}
                        className="py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="py-3 px-4 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 shadow-lg"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

interface UpdateConfirmationModalProps {
    pendingUpdate: {
        property: Property;
        updates: Partial<Property>;
        description: string;
    };
    onClose: () => void;
    onConfirm: () => void;
}

export const UpdateConfirmationModal: React.FC<UpdateConfirmationModalProps> = ({
    pendingUpdate,
    onClose,
    onConfirm
}) => {
    if (!pendingUpdate) return null;

    return (
        <div className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Cambio</h3>
                <div className="bg-blue-50 rounded-xl p-4 space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Propiedad</span>
                        <span className="font-semibold text-gray-900">{pendingUpdate.property.address}</span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                        <p className="text-sm text-gray-500 uppercase font-bold mb-1">Acción Detectada</p>
                        <p className="text-lg font-bold text-blue-700">{pendingUpdate.description}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={onClose}
                        className="py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="py-3 px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-lg"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};
