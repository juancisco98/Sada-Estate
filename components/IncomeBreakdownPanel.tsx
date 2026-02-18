
import React from 'react';
import { Building, Property } from '../types';
import { formatCurrency } from '../utils/currency';
import { Building2, Home } from 'lucide-react';

interface IncomeBreakdownPanelProps {
    properties: Property[];
    buildings: Building[];
    currency: 'ARS' | 'USD';
}

const IncomeBreakdownPanel: React.FC<IncomeBreakdownPanelProps> = ({ properties, buildings, currency }) => {
    const currencyProperties = properties.filter(p => (p.currency || 'ARS') === currency);

    // Group by building
    const buildingGroups = buildings.map(b => {
        const units = currencyProperties.filter(p => p.buildingId === b.id);
        const total = units.reduce((sum, p) => sum + p.monthlyRent, 0);
        return { building: b, units, total };
    }).filter(g => g.units.length > 0);

    // Properties not in any building
    const individualProperties = currencyProperties.filter(p => !p.buildingId);

    return (
        <div className="p-4 bg-gray-50 border-t border-gray-100 animate-in slide-in-from-top-2 duration-300">
            <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Desglose por Propiedad</h4>

            {/* Buildings Breakdown */}
            {buildingGroups.map(group => (
                <div key={group.building.id} className="mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="font-bold text-gray-700">{group.building.name}</span>
                            <span className="text-xs text-gray-400">({group.units.length} un.)</span>
                        </div>
                        <span className="font-bold text-gray-900">{formatCurrency(group.total, currency)}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {group.units.map(unit => (
                            <div key={unit.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2 pl-4">
                                    <span className="text-sm text-gray-600 font-medium">{unit.unitLabel || unit.address}</span>
                                    <span className="text-xs text-gray-400 capitalize">• {unit.tenantName}</span>
                                </div>
                                <span className="text-sm font-bold text-gray-700">{formatCurrency(unit.monthlyRent, currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Individual Properties */}
            {individualProperties.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {individualProperties.map((prop, idx) => (
                        <div key={prop.id} className={`p-3 flex justify-between items-center hover:bg-gray-50 transition-colors ${idx !== 0 ? 'border-t border-gray-100' : ''}`}>
                            <div className="flex items-center gap-2">
                                <Home className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-700 font-bold">{prop.address}</span>
                                <span className="text-xs text-gray-400 capitalize">• {prop.tenantName}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-700">{formatCurrency(prop.monthlyRent, currency)}</span>
                        </div>
                    ))}
                </div>
            )}

            {currencyProperties.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-4">No hay propiedades registradas en esta moneda.</p>
            )}
        </div>
    );
};

export default IncomeBreakdownPanel;
