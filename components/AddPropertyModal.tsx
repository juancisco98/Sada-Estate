import React, { useState, useEffect } from 'react';
import { X, Save, MapPin, Image as ImageIcon, Briefcase, StickyNote, Upload, Hammer, FileText, Check, Globe, LayoutGrid, Ruler, Trash2, User, Phone, DollarSign, Calendar, RefreshCw, Calculator, Clock } from 'lucide-react';
import { Property, PropertyStatus, Professional, PropertyType } from '../types';
import { DEFAULT_PROPERTY_IMAGE } from '../constants';

import { getTaxConfig } from '../utils/taxConfig';
import { toast } from 'sonner';
import { logger } from '../utils/logger';
import { BuildingUnitManager, BuildingUnit } from './properties/BuildingUnitManager';

// BuildingUnit interface moved to BuildingUnitManager


interface AddPropertyModalProps {
  address?: string;
  coordinates?: [number, number];
  existingProperty?: Property | null;
  detectedCountry?: string; // Auto-detected from geocoding
  onClose: () => void;
  onSave: (property: Property | Property[]) => void;
  onDelete?: (id: string) => void;
  professionals?: Professional[];
  isRestrictedMode?: boolean; // Added for restricted building edits
}

const formatNumberWithDots = (value: string | number) => {
  if (value === '' || value === undefined || value === null) return '';
  const stringValue = String(value);
  const cleanValue = stringValue.replace(/\./g, '');
  const num = parseInt(cleanValue, 10);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-AR').format(num);
};

const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  address,
  coordinates,
  existingProperty,
  detectedCountry,
  onClose,
  onSave,
  onDelete,
  professionals = [],
  isRestrictedMode = false
}) => {
  const isEditing = !!existingProperty;

  // Building mode state
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingUnits, setBuildingUnits] = useState<BuildingUnit[]>([{ label: '', tenantName: '', tenantPhone: '', rooms: '', squareMeters: '', monthlyRent: '' }]);


  const [formData, setFormData] = useState({
    address: address || '',
    tenantName: '',
    tenantPhone: '',
    monthlyRent: '',
    imageUrl: '',
    assignedProfessionalId: '',
    maintenanceTaskDescription: '',
    notes: '',

    // Property details
    rooms: '',
    squareMeters: '',

    // Country & Currency
    country: detectedCountry || 'Argentina',
    currency: 'ARS',

    // Property type
    propertyType: 'casa' as PropertyType,

    // Contract
    contractStart: '',
    adjustmentMonths: '3',
  });

  // Mock state for document uploads
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  // IPC calculator state
  const [ipcCalc, setIpcCalc] = useState<{
    show: boolean;
    loading: boolean;
    variation: number | null;
    suggestedRent: number | null;
    isEstimated: boolean;
    periodLabel: string;
    manualPct: string;
    error: string | null;
  }>({ show: false, loading: false, variation: null, suggestedRent: null, isEstimated: false, periodLabel: '', manualPct: '', error: null });

  // Get tax config for current country
  const taxConfig = getTaxConfig(formData.country);

  const calcNextAdjustment = (startDate: string, months: number): string => {
    if (!startDate || !months || months <= 0) return '';
    const next = new Date(startDate + 'T00:00:00');
    next.setMonth(next.getMonth() + months);
    return next.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const fetchIPCData = async () => {
    const months = Number(formData.adjustmentMonths) || 3;
    const currentRent = Number(String(formData.monthlyRent).replace(/\./g, '')) || 0;
    const contractStart = formData.contractStart;
    setIpcCalc(prev => ({ ...prev, loading: true, error: null, variation: null, suggestedRent: null, isEstimated: false, periodLabel: '' }));
    try {
      const toYYYYMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const fmtMonth = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });

      // Base month: month BEFORE contractStart (reference IPC index)
      const baseDate = contractStart ? new Date(contractStart + 'T00:00:00') : new Date();
      if (contractStart) baseDate.setMonth(baseDate.getMonth() - 1);

      // End month ideal: contractStart + months - 1
      const idealEnd = contractStart ? new Date(contractStart + 'T00:00:00') : new Date();
      if (contractStart) idealEnd.setMonth(idealEnd.getMonth() + months - 1);
      else idealEnd.setMonth(idealEnd.getMonth() - 1);

      // Cap end date to current month (INDEC publishes with ~1-2 months of lag)
      const now = new Date();
      const queryEnd = idealEnd > now ? now : idealEnd;

      const periodLabel = `${fmtMonth(contractStart ? new Date(contractStart + 'T00:00:00') : baseDate)} → ${fmtMonth(idealEnd)}`;

      // Query a wider range to ensure we get enough data points
      // Go back 2 extra months as buffer for INDEC publication delay
      const queryStart = new Date(baseDate);
      queryStart.setMonth(queryStart.getMonth() - 2);

      const res = await fetch(
        `https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=${toYYYYMM(queryStart)}&end_date=${toYYYYMM(queryEnd)}&format=json`
      );
      if (!res.ok) throw new Error('Error de red al consultar INDEC');
      const json = await res.json();
      const allData: [string, number][] = (json.data || []).filter(([, v]: [string, number]) => v !== null);
      if (allData.length < 2) throw new Error('Datos insuficientes en INDEC para este período');

      // Find the data point closest to our base month
      const baseStr = toYYYYMM(baseDate);
      let baseIdx = allData.findIndex(([d]) => d >= baseStr);
      if (baseIdx < 0) baseIdx = allData.length - 2; // fallback: use the earliest available

      let points: number[] = allData.slice(baseIdx).map(([, v]) => v);
      if (points.length < 2) {
        // If we can't find enough from the base, use the last available points
        points = allData.slice(-Math.min(allData.length, months + 1)).map(([, v]) => v);
      }
      if (points.length < 2) throw new Error('Datos insuficientes en INDEC para este período');

      // How many total points we need: months + 1 (base + N months)
      const expected = months + 1;
      let isEstimated = false;
      // Extrapolate missing months using the last known monthly ratio
      if (points.length < expected) {
        isEstimated = true;
        const lastRatio = points[points.length - 1] / points[points.length - 2];
        while (points.length < expected) {
          points.push(points[points.length - 1] * lastRatio);
        }
      }

      const factor = points[points.length - 1] / points[0];
      const variation = parseFloat(((factor - 1) * 100).toFixed(2));
      const suggestedRent = Math.round(currentRent * factor);
      setIpcCalc(prev => ({ ...prev, loading: false, variation, suggestedRent, isEstimated, periodLabel }));
    } catch (e: any) {
      setIpcCalc(prev => ({ ...prev, loading: false, error: e.message || 'No se pudo conectar con INDEC' }));
    }
  };

  const applyIPCRent = (amount: number) => {
    // Avanzar contractStart al próximo ajuste (contractStart + adjustmentMonths)
    const months = Number(formData.adjustmentMonths) || 3;
    const currentStart = formData.contractStart ? new Date(formData.contractStart + 'T12:00:00') : new Date();
    const targetMonth = currentStart.getMonth() + months;
    const day = currentStart.getDate();
    currentStart.setMonth(targetMonth);
    // Si el día cambió (ej: 31 enero + 1 mes = 3 marzo), corregir al último día del mes objetivo
    if (currentStart.getDate() !== day) {
      currentStart.setDate(0); // último día del mes anterior
    }
    const y = currentStart.getFullYear();
    const m = String(currentStart.getMonth() + 1).padStart(2, '0');
    const d = String(currentStart.getDate()).padStart(2, '0');
    const newStart = `${y}-${m}-${d}`;

    setFormData(prev => ({
      ...prev,
      monthlyRent: String(amount),
      contractStart: newStart,
    }));
    setIpcCalc(prev => ({ ...prev, show: false }));
  };

  const applyManualPct = () => {
    const pct = parseFloat(ipcCalc.manualPct);
    if (isNaN(pct) || pct <= 0) return;
    const currentRent = Number(String(formData.monthlyRent).replace(/\./g, '')) || 0;
    const newRent = Math.round(currentRent * (1 + pct / 100));
    applyIPCRent(newRent);
  };

  // Initialize Data
  useEffect(() => {
    if (isEditing && existingProperty) {
      setFormData({
        address: existingProperty.address,
        tenantName: existingProperty.tenantName,
        tenantPhone: existingProperty.tenantPhone || '',
        monthlyRent: existingProperty.monthlyRent.toString(),
        imageUrl: existingProperty.imageUrl || '',
        assignedProfessionalId: existingProperty.assignedProfessionalId || '',
        maintenanceTaskDescription: existingProperty.maintenanceTaskDescription || '',
        notes: existingProperty.notes || '',
        rooms: existingProperty.rooms?.toString() || '',
        squareMeters: existingProperty.squareMeters?.toString() || '',
        country: existingProperty.country || 'Argentina',
        currency: existingProperty.currency || 'ARS',
        propertyType: existingProperty.propertyType || (existingProperty.buildingId ? 'edificio' : 'casa'),
        contractStart: existingProperty.contractStart || '',
        adjustmentMonths: existingProperty.adjustmentMonths?.toString() || '3',
      });
    } else if (address) {
      const initialCountry = detectedCountry || 'Argentina';
      const config = getTaxConfig(initialCountry);

      setFormData(prev => ({
        ...prev,
        address: address,
        imageUrl: DEFAULT_PROPERTY_IMAGE,
        notes: '',
        country: initialCountry,
        currency: 'ARS', // Always ARS
      }));
    }
  }, [address, isEditing, existingProperty, detectedCountry]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    const config = getTaxConfig(newCountry);

    setFormData(prev => ({
      ...prev,
      country: newCountry,
      // currency: 'ARS' // Already default, no need to change
    }));
  };

  const handleNumberChange = (field: string, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      [field]: cleanValue
    }));
  };

  // Building unit management
  // Logic moved to BuildingUnitManager


  // Handle Local Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Mock Document Upload
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const name = e.target.files[0].name;
      setUploadedDocs(prev => [...prev, name]);
    }
  };



  const handleDelete = () => {
    if (isEditing && existingProperty && onDelete) {
      toast("¿Estás seguro de eliminar esta propiedad?", {
        description: "Esta acción no se puede deshacer.",
        action: {
          label: "Eliminar",
          onClick: () => {
            onDelete(existingProperty.id);
            onClose();
            toast.success("Propiedad eliminada");
          },
        },
        cancel: {
          label: "Cancelar",
        },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalAddress = formData.address || (address?.split(',')[0] || 'Nueva Propiedad');
    let finalCoords = isEditing && existingProperty ? existingProperty.coordinates : coordinates || [0, 0];
    const finalId = isEditing && existingProperty ? existingProperty.id : Date.now().toString();

    // Geocode if coordinates are missing or [0,0]
    if ((finalCoords[0] === 0 && finalCoords[1] === 0) && finalAddress) {
      try {
        // Import dynamically to avoid top-level issues if any
        const { geocodeAddress } = await import('../utils/geocoding');
        const result = await geocodeAddress(finalAddress);
        if (result) {
          finalCoords = [result.lat, result.lng];
          logger.log(`[Geocoding] Found coords for ${finalAddress}:`, finalCoords);
        }
      } catch (err) {
        logger.error("Error geocoding on save:", err);
      }
    }

    let dateToSave = isEditing && existingProperty ? existingProperty.professionalAssignedDate : undefined;

    if (formData.assignedProfessionalId) {
      if (!existingProperty || existingProperty.assignedProfessionalId !== formData.assignedProfessionalId) {
        dateToSave = new Date().toISOString();
      }
      if (!formData.maintenanceTaskDescription.trim()) {
        toast.error("Por favor, describe la tarea o motivo de la obra para el profesional asignado.");
        return;
      }
    } else {
      dateToSave = undefined;
    }

    // === BUILDING MODE: create one property per unit ===
    if (isBuilding && !isEditing) {
      const validUnits = buildingUnits.filter(u => u.label.trim());
      if (validUnits.length === 0) {
        toast.error('Agrega al menos una unidad con nombre.');
        return;
      }
      for (const unit of validUnits) {
        if (!unit.rooms || !unit.squareMeters) {
          toast.error(`La unidad "${unit.label}" necesita ambientes y metros cuadrados.`);
          return;
        }
        if (!unit.monthlyRent || Number(unit.monthlyRent) <= 0) {
          toast.error(`La unidad "${unit.label}" necesita un valor de alquiler.`);
          return;
        }
      }

      const buildingId = `bld-${Date.now()}`;

      const buildingProperties: Property[] = [];

      for (const [idx, unit] of validUnits.entries()) {
        const unitStatus = unit.tenantName ? PropertyStatus.CURRENT : PropertyStatus.WARNING;
        const unitProp: Property = {
          id: `${Date.now()}-u${idx}`,
          address: finalAddress,
          tenantName: unit.tenantName || 'Vacante',
          tenantPhone: unit.tenantPhone || '-',
          status: unitStatus,
          monthlyRent: Number(unit.monthlyRent) || 0,
          coordinates: finalCoords,
          contractEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
          lastPaymentDate: '-',
          imageUrl: formData.imageUrl,
          notes: formData.notes,
          rooms: Number(unit.rooms) || undefined,
          squareMeters: Number(unit.squareMeters) || undefined,
          country: formData.country,
          currency: formData.currency,
          buildingId: buildingId,
          unitLabel: unit.label,
          propertyType: 'edificio',
        };
        buildingProperties.push(unitProp);
      }
      onSave(buildingProperties);
      toast.success('Edificio y unidades creados correctamente');
      return;
    }

    // === NORMAL MODE ===
    const status = formData.tenantName ? PropertyStatus.CURRENT : PropertyStatus.WARNING;

    // Validate rooms and square meters for new properties
    if (!isEditing && (!formData.rooms || !formData.squareMeters)) {
      toast.error('Por favor, ingresa los ambientes y metros cuadrados de la propiedad.');
      return;
    }

    const propertyToSave: Property = {
      id: finalId,
      address: finalAddress,
      tenantName: formData.tenantName || 'Vacante',
      tenantPhone: formData.tenantPhone || '-',
      status: status,
      monthlyRent: Number(formData.monthlyRent) || 0,
      coordinates: finalCoords,
      contractEnd: isEditing && existingProperty ? existingProperty.contractEnd : new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
      lastPaymentDate: isEditing && existingProperty ? existingProperty.lastPaymentDate : '-',
      imageUrl: formData.imageUrl,
      assignedProfessionalId: formData.assignedProfessionalId,
      professionalAssignedDate: dateToSave,
      maintenanceTaskDescription: formData.assignedProfessionalId ? formData.maintenanceTaskDescription : undefined,
      notes: formData.notes,
      rooms: Number(formData.rooms) || undefined,
      squareMeters: Number(formData.squareMeters) || undefined,
      country: formData.country,
      currency: formData.currency,
      propertyType: formData.propertyType || 'casa',
      contractStart: formData.contractStart || undefined,
      adjustmentMonths: formData.adjustmentMonths ? Number(formData.adjustmentMonths) : undefined,
    };
    onSave(propertyToSave);
    toast.success(isEditing ? 'Propiedad actualizada' : 'Propiedad creada');
  };

  // Currency symbol helper
  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return 'US$';
      case 'ARS': return '$';
      case 'UYU': return '$U';
      default: return '$';
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editar Propiedad' : 'Nueva Propiedad'}
            </h2>
            <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {isEditing ? existingProperty?.address : address || 'Dirección manual'}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors" aria-label="Cerrar modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-8 py-6 overflow-y-auto space-y-7">

          {/* ROW 1: Photo + Property Details side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Foto de Portada</label>
              <div className="flex gap-3 items-stretch h-28">
                <div className="w-28 h-full rounded-xl overflow-hidden bg-gray-50 border border-gray-200 flex-shrink-0">
                  {formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}
                </div>
                <label className="flex-1 cursor-pointer group">
                  <div className="w-full h-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-1.5">
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                    <p className="text-xs font-medium text-gray-500 group-hover:text-blue-600">Subir foto</p>
                    <p className="text-[10px] text-gray-400">JPG, PNG</p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} aria-label="Subir foto de portada" />
                  </div>
                </label>
              </div>
            </div>

            {/* Property Details: Rooms & m2 */}
            {!isBuilding && !isRestrictedMode && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" /> Datos del Inmueble
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Ambientes</label>
                    <div className="relative">
                      <LayoutGrid className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="number" min="1" max="20" placeholder="Ej: 3" required={!isEditing}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold"
                        value={formData.rooms} onChange={e => setFormData({ ...formData, rooms: e.target.value })} aria-label="Cantidad de ambientes"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Metros² (m²)</label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="number" min="1" placeholder="Ej: 72" required={!isEditing}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold"
                        value={formData.squareMeters} onChange={e => setFormData({ ...formData, squareMeters: e.target.value })} aria-label="Metros cuadrados"
                      />
                    </div>
                  </div>
                </div>
                {/* Country inline with property details */}
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-medium text-gray-600">País {taxConfig.flag}</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.country} onChange={handleCountryChange} aria-label="Seleccionar país"
                  >
                    <option value="Argentina">AR Argentina</option>
                    <option value="USA">US Estados Unidos</option>
                    <option value="Uruguay">UY Uruguay</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Contrato: full width, entre foto/datos y dirección */}
          {!isBuilding && !isRestrictedMode && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Contrato
              </label>
              {/* Fila 1: Fecha de inicio + Ajuste + Calcular */}
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Fecha de inicio</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.contractStart}
                      onChange={e => setFormData({ ...formData, contractStart: e.target.value })}
                      aria-label="Fecha de inicio del contrato"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Ajuste cada (meses)</label>
                  <div className="relative">
                    <RefreshCw className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="number" min="1" max="24" placeholder="Ej: 3"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                      value={formData.adjustmentMonths}
                      onChange={e => setFormData({ ...formData, adjustmentMonths: e.target.value })}
                      aria-label="Cada cuántos meses se ajusta el alquiler"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 invisible select-none">.</label>
                  <button
                    type="button"
                    onClick={() => setIpcCalc(prev => ({ ...prev, show: !prev.show }))}
                    className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <Calculator className="w-4 h-4" /> IPC
                  </button>
                </div>
              </div>
              {/* 1er ajuste */}
              {formData.contractStart && formData.adjustmentMonths && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700">
                    1er ajuste: <strong>{calcNextAdjustment(formData.contractStart, Number(formData.adjustmentMonths))}</strong>
                  </span>
                </div>
              )}
              {/* Calculadora IPC */}
              {ipcCalc.show && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" /> Calculadora IPC (INDEC)
                    </span>
                    {ipcCalc.periodLabel && (
                      <span className="text-xs text-slate-400">{ipcCalc.periodLabel}</span>
                    )}
                  </div>
                  {ipcCalc.loading && (
                    <p className="text-xs text-slate-500 animate-pulse">Consultando INDEC...</p>
                  )}
                  {!ipcCalc.loading && ipcCalc.variation === null && !ipcCalc.error && (
                    <button
                      type="button"
                      onClick={fetchIPCData}
                      className="w-full text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      Calcular con IPC
                    </button>
                  )}
                  {!ipcCalc.loading && ipcCalc.variation !== null && ipcCalc.suggestedRent !== null && (
                    <div className="space-y-2">
                      {ipcCalc.isEstimated && (
                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs text-amber-700">Valor aproximado — INDEC aún no publicó todos los datos del período</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Variación acumulada IPC:</span>
                        <span className="font-bold text-emerald-600">+{ipcCalc.variation}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Alquiler actual:</span>
                        <span className="font-semibold">${Number(String(formData.monthlyRent).replace(/\./g, '')).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-800 font-bold border-t border-slate-200 pt-2">
                        <span>Alquiler sugerido:</span>
                        <span className="text-indigo-600">${ipcCalc.suggestedRent.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => applyIPCRent(ipcCalc.suggestedRent!)}
                          className="flex-1 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={fetchIPCData}
                          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                          Recalcular
                        </button>
                      </div>
                    </div>
                  )}
                  {!ipcCalc.loading && ipcCalc.error && (
                    <div className="space-y-2">
                      <p className="text-xs text-red-600">{ipcCalc.error}. Ingresá el % manualmente:</p>
                      <div className="flex gap-2">
                        <input
                          type="number" min="0" step="0.1" placeholder="Ej: 4.5"
                          className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                          value={ipcCalc.manualPct}
                          onChange={e => setIpcCalc(prev => ({ ...prev, manualPct: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={applyManualPct}
                          className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
                        >
                          Aplicar %
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ROW 2: Address full width */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Dirección
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text" placeholder="Dirección completa de la propiedad" required
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} aria-label="Dirección de la propiedad"
              />
            </div>
          </div>

          {/* ROW 3: Tenant data — 3 columns */}
          {!isBuilding && !isRestrictedMode && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Datos del Alquiler</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Inquilino</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="text" placeholder="Nombre o Vacante"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      value={formData.tenantName} onChange={e => setFormData({ ...formData, tenantName: e.target.value })} aria-label="Nombre del inquilino"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="tel" placeholder="11-XXXX-XXXX"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      value={formData.tenantPhone} onChange={e => setFormData({ ...formData, tenantPhone: e.target.value })} aria-label="Teléfono del inquilino"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Alquiler Mensual ({formData.currency})</label>
                  <div className="relative">
                    <DollarSign className={`absolute left-3 top-2.5 w-4 h-4 ${formData.currency === 'USD' ? 'text-green-600' : 'text-blue-600'}`} />
                    <input
                      type="text" placeholder="0" required
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold"
                      value={formatNumberWithDots(formData.monthlyRent)} onChange={e => handleNumberChange('monthlyRent', e.target.value)} aria-label="Valor del alquiler mensual"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Property Type Selector */}
          {!isRestrictedMode && !isEditing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tipo de Propiedad
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { type: 'casa' as PropertyType, label: 'Casa', icon: '🏠', activeBg: 'bg-teal-600', activeBorder: 'border-teal-300', inactiveBg: 'bg-teal-50', inactiveBorder: 'border-teal-200' },
                    { type: 'edificio' as PropertyType, label: 'Edificio', icon: '🏢', activeBg: 'bg-violet-600', activeBorder: 'border-violet-300', inactiveBg: 'bg-violet-50', inactiveBorder: 'border-violet-200' },
                    { type: 'local' as PropertyType, label: 'Local', icon: '🏪', activeBg: 'bg-amber-600', activeBorder: 'border-amber-300', inactiveBg: 'bg-amber-50', inactiveBorder: 'border-amber-200' },
                  ]).map(opt => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, propertyType: opt.type }));
                        setIsBuilding(opt.type === 'edificio');
                      }}
                      className={`p-3 rounded-xl border-2 font-bold text-sm flex flex-col items-center gap-1 transition-all min-h-[56px] ${
                        formData.propertyType === opt.type
                          ? `${opt.activeBg} text-white ${opt.activeBorder} shadow-lg`
                          : `${opt.inactiveBg} ${opt.inactiveBorder} text-gray-700 hover:shadow-md`
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Building Unit Manager — only when edificio is selected */}
              {formData.propertyType === 'edificio' && (
                <BuildingUnitManager
                  units={buildingUnits}
                  setUnits={setBuildingUnits}
                  currency={formData.currency}
                  isEditing={isEditing}
                  isBuilding={true}
                  setIsBuilding={() => {}}
                  formatNumber={formatNumberWithDots}
                  hideToggle={true}
                />
              )}
            </div>
          )}

          {/* ROW 4: Professional + Documents side by side */}
          {!isRestrictedMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-gray-100">
              {/* Professional Assignment */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Profesional Asignado
                </label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none"
                  value={formData.assignedProfessionalId} onChange={e => setFormData({ ...formData, assignedProfessionalId: e.target.value })} aria-label="Seleccionar profesional asignado"
                >
                  <option value="">Ninguno (Opcional)</option>
                  {professionals.map(pro => (
                    <option key={pro.id} value={pro.id}>{pro.name} - {pro.profession}</option>
                  ))}
                </select>

                {formData.assignedProfessionalId && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-medium text-orange-700 flex items-center gap-1">
                      <Hammer className="w-3.5 h-3.5" /> Descripción de la Obra
                    </label>
                    <input
                      type="text" placeholder="Ej: Reparación de cañería..." required
                      className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-gray-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      value={formData.maintenanceTaskDescription} onChange={e => setFormData({ ...formData, maintenanceTaskDescription: e.target.value })} aria-label="Descripción de la tarea"
                    />
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Documentos / Recibos
                </label>
                <div className="flex flex-col gap-2">
                  {uploadedDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                      <Check className="w-3.5 h-3.5" /> {doc}
                    </div>
                  ))}
                  <label className="cursor-pointer inline-flex items-center gap-2 text-xs text-blue-600 font-medium hover:text-blue-800 transition-colors bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 border-dashed w-fit">
                    <Upload className="w-3.5 h-3.5" /> + Adjuntar Archivo
                    <input type="file" className="hidden" onChange={handleDocUpload} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {!isRestrictedMode && (
            <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-100">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <StickyNote className="w-3.5 h-3.5" /> Notas y Recordatorios
              </h3>
              <textarea
                placeholder="Ej: El portero se llama Jose. Recordar pedir comprobante..."
                className="w-full p-3 rounded-lg border border-amber-200 bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none h-20 text-sm"
                value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} aria-label="Notas y recordatorios"
              />
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          {isEditing && onDelete && (
            <button
              type="button" onClick={handleDelete}
              className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center border border-red-200 shrink-0 min-h-[44px] min-w-[44px]"
              title="Eliminar Propiedad"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-white hover:text-gray-700 transition-all min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-[2] py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Save className="w-4 h-4" /> {isEditing ? 'Guardar Cambios' : 'Crear Propiedad'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPropertyModal;