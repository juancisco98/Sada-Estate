import React, { useState, useMemo } from 'react';
import { User, TenantPayment, Tenant } from '../types';
import { useDataContext } from '../context/DataContext';
import { MONTH_NAMES } from '../constants';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import UploadReceiptModal from './UploadReceiptModal';
import { LogOut, Calendar, Clock, CheckCircle, AlertCircle, Home } from 'lucide-react';

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
            <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 sm:px-8 py-5 sm:py-6 flex items-center justify-between sticky top-0 z-10 shadow-lg shadow-indigo-900/10">
                <div className="flex items-center gap-4">
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white/20 shadow-md bg-white/10" />
                    ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl sm:text-2xl border-2 border-white/20 shadow-md">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Hola, {currentUser.name.split(' ')[0]}</h1>
                        <p className="text-indigo-100/90 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                            <Home className="w-3.5 h-3.5" /> {tenantProperty ? tenantProperty.address : 'Miembro Inquilino'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all group flex items-center justify-center"
                    title="Cerrar sesión"
                >
                    <LogOut className="w-6 h-6 group-hover:scale-110 transition-transform" />
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
                        const payment = tenantPaymentsThisYear.find(p => p.month === index + 1);

                        return (
                            <button
                                key={monthName}
                                onClick={() => setSelectedMonth(index + 1)}
                                className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl cursor-pointer shadow-sm
                  ${status === 'PAID' ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100/40 shadow-green-100' : ''}
                  ${status === 'REVISION' ? 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/40 shadow-yellow-100' : ''}
                  ${status === 'INCOMPLETE' ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/40 shadow-orange-100' : ''}
                  ${status === 'PENDING' ? 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-indigo-100' : ''}
                `}
                            >
                                <span className={`text-base sm:text-lg font-bold mb-1.5 transition-colors ${status === 'PAID' ? 'text-green-800' : status === 'REVISION' ? 'text-yellow-800' : status === 'INCOMPLETE' ? 'text-orange-800' : 'text-gray-700 group-hover:text-indigo-900'}`}>
                                    {monthName}
                                </span>

                                <div className="flex flex-col items-center gap-1 mt-1">
                                    {status === 'PAID' && (
                                        <>
                                            <CheckCircle className="text-green-600 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider mt-0.5">Aprobado</span>
                                        </>
                                    )}
                                    {status === 'REVISION' && (
                                        <>
                                            <Clock className="text-yellow-600 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider mt-0.5">En Revisión</span>
                                        </>
                                    )}
                                    {status === 'INCOMPLETE' && (
                                        <>
                                            <AlertCircle className="text-orange-500 w-6 h-6" />
                                            <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wider mt-0.5">Incompleto</span>
                                        </>
                                    )}
                                    {status === 'PENDING' && (
                                        <>
                                            <Calendar className="text-gray-300 w-6 h-6 group-hover:text-indigo-400 transition-colors" />
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-0.5 group-hover:text-indigo-600 transition-colors">Pendiente</span>
                                        </>
                                    )}
                                </div>
                                {payment && payment.amount > 0 && status !== 'PENDING' && (
                                    <div className="mt-3 pt-2.5 border-t border-black/5 w-full text-center">
                                        <span className="text-[13px] font-extrabold text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>${payment.amount.toLocaleString('es-AR')}</span>
                                    </div>
                                )}
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
