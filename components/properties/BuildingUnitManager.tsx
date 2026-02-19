import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, User, Phone, LayoutGrid, Ruler, DollarSign, Building2 } from 'lucide-react';
import { PropertyStatus } from '../../types';

export interface BuildingUnit {
    label: string;
    tenantName: string;
    tenantPhone: string;
    rooms: string;
    squareMeters: string;
    monthlyRent: string;
}

interface BuildingUnitManagerProps {
    units: BuildingUnit[];
    setUnits: React.Dispatch<React.SetStateAction<BuildingUnit[]>>;
    currency: string;
    isEditing: boolean;
    isBuilding: boolean;
    setIsBuilding: (value: boolean) => void;
    formatNumber: (value: string | number) => string;
}

export const BuildingUnitManager: React.FC<BuildingUnitManagerProps> = ({
    units,
    setUnits,
    currency,
    isEditing,
    isBuilding,
    setIsBuilding,
    formatNumber
}) => {
    const [expandedUnit, setExpandedUnit] = useState<number>(0);

    const emptyUnit = (): BuildingUnit => ({ label: '', tenantName: '', tenantPhone: '', rooms: '', squareMeters: '', monthlyRent: '' });

    const addUnit = () => {
        setUnits(prev => [...prev, emptyUnit()]);
        setExpandedUnit(units.length);
    };

    const removeUnit = (idx: number) => {
        setUnits(prev => prev.filter((_, i) => i !== idx));
        if (expandedUnit >= idx && expandedUnit > 0) setExpandedUnit(expandedUnit - 1);
    };

    const updateUnitField = (idx: number, field: keyof BuildingUnit, val: string) => {
        setUnits(prev => prev.map((u, i) => i === idx ? { ...u, [field]: val } : u));
    };

    if (isEditing) return null;

    return (
        <div className="bg-violet-50 rounded-2xl p-5 border border-violet-100 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-violet-900 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-600" /> ¿Es un Edificio?
                </h3>
                <button
                    type="button"
                    onClick={() => setIsBuilding(!isBuilding)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${isBuilding ? 'bg-violet-600' : 'bg-gray-300'}`}
                    aria-label={isBuilding ? "Desactivar modo edificio" : "Activar modo edificio"}
                >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isBuilding ? 'translate-x-6' : 'translate-x-0.5'}`}></span>
                </button>
            </div>

            {isBuilding && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs text-violet-700">Define cada piso/departamento con sus datos individuales:</p>

                    {units.map((unit, idx) => {
                        const isExpanded = expandedUnit === idx;
                        return (
                            <div key={idx} className="bg-white rounded-xl border border-violet-200 overflow-hidden shadow-sm">
                                {/* Unit header */}
                                <div className="flex items-center gap-2 p-3">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedUnit(isExpanded ? -1 : idx)}
                                        className="p-1 text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
                                    >
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    <input
                                        type="text"
                                        placeholder={`Ej: Piso ${idx + 1}A`}
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-violet-100 bg-violet-50/50 text-sm font-semibold focus:ring-2 focus:ring-violet-400 outline-none"
                                        value={unit.label}
                                        onChange={e => updateUnitField(idx, 'label', e.target.value)}
                                    />
                                    {unit.tenantName && !isExpanded && (
                                        <span className="text-xs text-gray-500 truncate max-w-[80px]">{unit.tenantName}</span>
                                    )}
                                    {units.length > 1 && (
                                        <button type="button" onClick={() => removeUnit(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                                            <Minus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="px-3 pb-3 space-y-3 border-t border-violet-100 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {/* Tenant & Phone */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">Inquilino</label>
                                                <div className="relative">
                                                    <User className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre o Vacante"
                                                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                                                        value={unit.tenantName}
                                                        onChange={e => updateUnitField(idx, 'tenantName', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">Teléfono</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="tel"
                                                        placeholder="11-XXXX-XXXX"
                                                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                                                        value={unit.tenantPhone}
                                                        onChange={e => updateUnitField(idx, 'tenantPhone', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rooms & SqM */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">Ambientes</label>
                                                <div className="relative">
                                                    <LayoutGrid className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        placeholder="Ej: 3"
                                                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-violet-400 outline-none"
                                                        value={unit.rooms}
                                                        onChange={e => updateUnitField(idx, 'rooms', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">Metros² (m²)</label>
                                                <div className="relative">
                                                    <Ruler className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="Ej: 72"
                                                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-violet-400 outline-none"
                                                        value={unit.squareMeters}
                                                        onChange={e => updateUnitField(idx, 'squareMeters', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rent */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600">Alquiler ({currency})</label>
                                            <div className="relative">
                                                <DollarSign className={`absolute left-2.5 top-2 w-4 h-4 ${currency === 'USD' ? 'text-green-600' : 'text-blue-600'}`} />
                                                <input
                                                    type="text"
                                                    placeholder="0"
                                                    className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-violet-400 outline-none"
                                                    value={formatNumber(unit.monthlyRent)}
                                                    onChange={e => {
                                                        const clean = e.target.value.replace(/[^0-9]/g, '');
                                                        updateUnitField(idx, 'monthlyRent', clean);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={addUnit}
                        className="flex items-center gap-1 text-sm text-violet-700 font-medium hover:text-violet-900 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Agregar unidad
                    </button>
                </div>
            )}
        </div>
    );
};
