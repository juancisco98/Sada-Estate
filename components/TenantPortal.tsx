import React, { useState, useMemo } from 'react';
import { User, TenantPayment, Tenant } from '../types';
import { useDataContext } from '../context/DataContext';
import { MONTH_NAMES } from '../constants';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import UploadReceiptModal from './UploadReceiptModal';
import { LogOut, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface TenantPortalProps {
    currentUser: User;
    onLogout: () => void;
}

const TenantPortal: React.FC<TenantPortalProps> = ({ currentUser, onLogout }) => {
    const { tenants, payments, properties, setPayments } = useDataContext();
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
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

    // If no tenant record is found (shouldn't happen due to login check, but fallback)
    if (!tenantRecord) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md w-full">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">No se encontró tu perfil</h2>
                    <p className="text-gray-600 mb-6">Contactate con la administración para que vinculen tu cuenta de correo.</p>
                    <button
                        onClick={onLogout}
                        className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    const handleUploadComplete = (newPayment: TenantPayment) => {
        // Optimistic UI update or rely on DataProvider (if it refreshes, but mostly we update here directly)
        setPayments(prev => {
            const exists = prev.find(p => p.id === newPayment.id);
            if (exists) return prev.map(p => p.id === newPayment.id ? newPayment : p);
            return [...prev, newPayment];
        });
        setSelectedMonth(null);
    };

    const getMonthStatus = (monthIndex: number) => {
        const payment = tenantPaymentsThisYear.find(p => p.month === monthIndex + 1);
        if (!payment) return 'PENDING';

        // Si tiene comprobante pero está en estado revisión
        if (payment.status === 'REVISION' || payment.status === 'PENDING') return 'REVISION';

        // Si tiene los dos comprobantes pero no status, o status APPROVED
        if (payment.proofOfPayment && payment.proofOfExpenses) return 'PAID';

        return 'INCOMPLETE';
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* HEADER */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">Hola, {currentUser.name}</h1>
                        <p className="text-sm text-gray-500">{tenantProperty ? tenantProperty.address : 'Inquilino'}</p>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center"
                    title="Cerrar sesión"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            {/* BODY */}
            <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 pb-20">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Panel de Pagos {currentYear}</h2>
                    <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                        Seleccioná el mes correspondiente para subir tus comprobantes de alquiler y expensas.
                        <span className="font-semibold text-indigo-600 ml-1">Todo archivo subido no podrá ser modificado.</span>
                    </p>
                </div>

                {/* CALENDAR GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {MONTH_NAMES.map((monthName, index) => {
                        const status = getMonthStatus(index);
                        const isFuture = index > new Date().getMonth();
                        const payment = tenantPaymentsThisYear.find(p => p.month === index + 1);

                        return (
                            <button
                                key={monthName}
                                disabled={isFuture && status === 'PENDING'}
                                onClick={() => setSelectedMonth(index + 1)}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group
                  ${isFuture && status === 'PENDING' ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' : 'hover:-translate-y-1 hover:shadow-md cursor-pointer'}
                  ${status === 'PAID' ? 'border-green-500 bg-green-50' : ''}
                  ${status === 'REVISION' ? 'border-yellow-400 bg-yellow-50' : ''}
                  ${status === 'INCOMPLETE' ? 'border-orange-400 bg-orange-50' : ''}
                  ${status === 'PENDING' && !isFuture ? 'border-gray-200 bg-white hover:border-indigo-300' : ''}
                `}
                            >
                                <span className={`text-base font-bold mb-1 ${status === 'PAID' ? 'text-green-700' : status === 'REVISION' ? 'text-yellow-700' : 'text-gray-700'}`}>
                                    {monthName}
                                </span>

                                <div className="flex items-center gap-1 mt-1">
                                    {status === 'PAID' && (
                                        <>
                                            <CheckCircle className="text-green-600 w-5 h-5" />
                                            <span className="text-xs font-semibold text-green-700">Completado</span>
                                        </>
                                    )}
                                    {status === 'REVISION' && (
                                        <>
                                            <Clock className="text-yellow-600 w-5 h-5" />
                                            <span className="text-xs font-semibold text-yellow-700">En Revisión</span>
                                        </>
                                    )}
                                    {status === 'INCOMPLETE' && (
                                        <>
                                            <AlertCircle className="text-orange-600 w-5 h-5" />
                                            <span className="text-xs font-semibold text-orange-700">Incompleto</span>
                                        </>
                                    )}
                                    {status === 'PENDING' && !isFuture && (
                                        <>
                                            <Calendar className="text-gray-400 w-5 h-5 group-hover:text-indigo-500" />
                                            <span className="text-xs font-medium text-gray-500 group-hover:text-indigo-600">Pendiente</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
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
