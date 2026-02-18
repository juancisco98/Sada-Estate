import React from 'react';
import { Property, MaintenanceTask, Professional } from '../types';
import { X, TrendingUp, TrendingDown, DollarSign, Receipt, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface FinancialDetailsCardProps {
  property: Property;
  maintenanceTasks: MaintenanceTask[];
  professionals: Professional[];
  onClose: () => void;
}

const FinancialDetailsCard: React.FC<FinancialDetailsCardProps> = ({
  property,
  maintenanceTasks,
  professionals,
  onClose
}) => {
  // Filter tasks related to this property
  const expenses = maintenanceTasks.filter(task => task.propertyId === property.id);
  const totalMaintenance = expenses.reduce((acc, task) => acc + (task.cost || task.estimatedCost || 0), 0);

  const totalExpenses = totalMaintenance;
  const netResult = property.monthlyRent - totalExpenses;

  const displayCurrency = property.currency || 'ARS';

  return (
    <div className="fixed inset-0 z-[1300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative">

        {/* Header */}
        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Resumen Financiero</p>
            <h2 className="text-xl font-bold text-gray-900">{property.address}</h2>
            <p className="text-sm text-gray-500">{property.tenantName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Property Size & Price per m² */}
        {(property.rooms || property.squareMeters) && (
          <div className="mx-6 mt-4 flex items-center gap-3">
            {property.rooms && (
              <div className="flex-1 bg-blue-50 p-3 rounded-xl border border-blue-100 text-center">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Ambientes</p>
                <p className="text-xl font-bold text-gray-900">{property.rooms}</p>
              </div>
            )}
            {property.squareMeters && (
              <div className="flex-1 bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Superficie</p>
                <p className="text-xl font-bold text-gray-900">{property.squareMeters} m²</p>
              </div>
            )}
            {property.squareMeters && property.monthlyRent > 0 && (
              <div className="flex-1 bg-amber-50 p-3 rounded-xl border border-amber-100 text-center">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Precio/m²</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(Math.round(property.monthlyRent / property.squareMeters), displayCurrency)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main Numbers */}
        <div className="p-6 grid grid-cols-2 gap-4">
          {/* Income */}
          <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Ingreso (Alquiler)</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(property.monthlyRent, displayCurrency)}</p>
          </div>

          {/* Expenses */}
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Total Gastos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses, displayCurrency)}</p>
          </div>
        </div>

        {/* Net Result Highlight */}
        <div className="mx-6 p-4 bg-gray-900 rounded-2xl text-white flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-800 rounded-full">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-medium text-sm text-gray-300">Resultado Neto</span>
          </div>
          <span className={`text-2xl font-bold ${netResult >= 0 ? 'text-white' : 'text-red-400'}`}>
            {formatCurrency(netResult, displayCurrency)}
          </span>
        </div>

        {/* Breakdown List */}
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-gray-400" /> Desglose de Gastos
          </h3>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {/* Maintenance Expenses */}
            {expenses.length > 0 ? (
              expenses.map(expense => {
                const professional = professionals.find(p => p.id === expense.professionalId);
                return (
                  <div key={expense.id} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{expense.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          {professional?.profession || 'Mantenimiento'}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {expense.startDate}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-red-600 text-sm">
                      - {formatCurrency(expense.cost || expense.estimatedCost, 'ARS')}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm">Sin gastos registrados este mes.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div >
  );
};

export default FinancialDetailsCard;