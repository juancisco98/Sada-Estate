import React, { useState } from 'react';
import { X, UploadCloud, FileText, AlertTriangle } from 'lucide-react';
import { Tenant, TenantPayment, Property } from '../types';
import { uploadFile } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { paymentToDb } from '../utils/mappers';
import { toast } from 'sonner';
import { MONTH_NAMES } from '../constants';

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
    const [amount, setAmount] = useState(existingPayment?.amount?.toString() || property?.monthlyRent?.toString() || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // If a payment exists and is not pending/incomplete without files, block editing completely as per requirement.
    const isLocked = existingPayment ? (!!existingPayment.proofOfPayment && !!existingPayment.proofOfExpenses) : false;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'rent' | 'expenses') => {
        if (e.target.files && e.target.files.length > 0) {
            if (type === 'rent') setRentFile(e.target.files[0]);
            if (type === 'expenses') setExpensesFile(e.target.files[0]);
        }
    };

    const handleConfirmSubmit = async () => {
        if ((!rentFile && !existingPayment?.proofOfPayment) || (!expensesFile && !existingPayment?.proofOfExpenses)) {
            toast.error('Debes subir ambos comprobantes (alquiler y expensas).');
            return;
        }

        setIsSubmitting(true);
        try {
            let rentUrl = existingPayment?.proofOfPayment || '';
            let expensesUrl = existingPayment?.proofOfExpenses || '';

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

            // Check date - if existing payment has date use it, else use today
            const todayString = new Date().toISOString().split('T')[0];

            const paymentRecord: TenantPayment = {
                id: existingPayment?.id || crypto.randomUUID(),
                tenantId: tenant.id,
                propertyId: property?.id || null,
                amount: parseFloat(amount) || 0,
                currency: property?.currency || 'ARS',
                month,
                year,
                paidOnTime: true, // Optimistically assuming on time, can be recalculated by admins
                paymentDate: existingPayment?.paymentDate || todayString,
                paymentMethod: existingPayment?.paymentMethod || 'TRANSFER',
                proofOfPayment: rentUrl,
                proofOfExpenses: expensesUrl,
                status: 'REVISION', // Goes to revision straight away
                userId: tenant.userId,
                notes: existingPayment?.notes || 'Cargado por inquilino'
            };

            const { error } = await supabase
                .from('tenant_payments')
                .upsert(paymentToDb(paymentRecord));

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            toast.success('Comprobantes enviados correctamente.');
            onSuccess(paymentRecord);
        } catch (error) {
            console.error(error);
            toast.error('Ocurrió un error al guardar los comprobantes.');
        } finally {
            setIsSubmitting(false);
            setShowConfirm(false);
        }
    };

    const handleInitiateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            toast.error('Debes ingresar un monto válido.');
            return;
        }
        if (!rentFile && !existingPayment?.proofOfPayment) {
            toast.error('Falta el comprobante de alquiler.');
            return;
        }
        if (!expensesFile && !existingPayment?.proofOfExpenses) {
            toast.error('Falta el comprobante de expensas.');
            return;
        }
        setShowConfirm(true);
    };

    return (
        <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-4 sm:p-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            {/* Modal Panel - No z-10 needed anymore */}
            <div className="bg-white rounded-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {MONTH_NAMES[month - 1]} {year}
                        </h2>
                        <p className="text-sm text-gray-500">Carga de comprobantes</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {showConfirm ? (
                    <div className="p-6">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-yellow-800 mb-2">Atención inquilino</h3>
                            <p className="text-sm text-yellow-700 font-medium">
                                Revisen bien lo subido porque no se va a poder modificar después. <br /><br />
                                Una vez entregado, el mes quedará en estado de <b>Revisión</b> para la administración.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isSubmitting}
                                className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                Volver y revisar
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 transition disabled:opacity-50 relative flex items-center justify-center"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    "Confirmar Envío"
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleInitiateSubmit} className="p-6">

                        {isLocked ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-2 text-center">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-green-800 mb-1">Comprobantes Entregados</h3>
                                <p className="text-sm text-green-700">
                                    Ya has subido los comprobantes de este mes exitosamente. Cualquier modificación debes solicitarla a la administración.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* MONTO */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Monto Total Abonado</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-gray-500 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="Ingresa el monto (alquiler + expensas)"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800 font-bold bg-white hover:bg-gray-50/50"
                                        />
                                    </div>
                                </div>

                                {/* ALQUILER */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Comprobante de Alquiler</label>
                                    {existingPayment?.proofOfPayment ? (
                                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <span className="text-sm text-gray-600 flex items-center gap-2"><FileText /> Alquiler subido</span>
                                            <a href={existingPayment.proofOfPayment} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm font-medium hover:underline">Ver</a>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition relative overflow-hidden">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                {rentFile ? (
                                                    <div className="text-center">
                                                        <FileText className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                                                        <p className="text-sm font-medium text-gray-800 px-2 truncate w-48">{rentFile.name}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <UploadCloud className="w-6 h-6 text-gray-400 mb-2" />
                                                        <p className="text-xs text-gray-500 font-medium">Toca para cargar archivo de alquiler</p>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*,.pdf"
                                                onChange={(e) => handleFileChange(e, 'rent')}
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* EXPENSAS */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Comprobante de Expensas</label>
                                    {existingPayment?.proofOfExpenses ? (
                                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <span className="text-sm text-gray-600 flex items-center gap-2"><FileText /> Expensas subidas</span>
                                            <a href={existingPayment.proofOfExpenses} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm font-medium hover:underline">Ver</a>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition relative overflow-hidden">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                {expensesFile ? (
                                                    <div className="text-center">
                                                        <FileText className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                                                        <p className="text-sm font-medium text-gray-800 px-2 truncate w-48">{expensesFile.name}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <UploadCloud className="w-6 h-6 text-gray-400 mb-2" />
                                                        <p className="text-xs text-gray-500 font-medium">Toca para cargar archivo de expensas</p>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*,.pdf"
                                                onChange={(e) => handleFileChange(e, 'expenses')}
                                            />
                                        </label>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 transition"
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
    );
};

export default UploadReceiptModal;
