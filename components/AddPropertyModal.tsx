import React, { useState, useEffect } from 'react';
import { X, DollarSign, User, Phone, Save, MapPin, Image as ImageIcon, Briefcase, StickyNote, Upload, Hammer, FileText, Check, Sparkles, Globe, LayoutGrid, Ruler } from 'lucide-react';
import { Property, PropertyStatus } from '../types';
import { MOCK_PROFESSIONALS } from '../constants';
import { getTaxConfig } from '../utils/taxConfig';
import { formatCurrency, convertCurrencyLive } from '../utils/currency';

interface AddPropertyModalProps {
  address?: string;
  coordinates?: [number, number];
  existingProperty?: Property | null;
  detectedCountry?: string; // Auto-detected from geocoding
  onClose: () => void;
  onSave: (property: Property) => void;
  professionals?: any[];
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
  professionals = MOCK_PROFESSIONALS
}) => {
  const isEditing = !!existingProperty;

  const [isCalculating, setIsCalculating] = useState(false);
  const [estimationSource, setEstimationSource] = useState<'ai' | 'fallback' | null>(null);

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

    // Dynamic tax fields (stored as generic record)
    taxValues: {} as Record<string, string>,

    suggestedRent: '',
    suggestedRentUsd: '', // For Argentina: USD equivalent

    // Country & Currency
    country: detectedCountry || 'Argentina',
    currency: 'ARS',

    // Live rate info
    liveArsRate: '',
  });

  // Mock state for document uploads
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  // Get tax config for current country
  const taxConfig = getTaxConfig(formData.country);

  // Initialize Data
  useEffect(() => {
    if (isEditing && existingProperty) {
      // Build taxValues from existing taxInfo
      const taxValues: Record<string, string> = {};
      if (existingProperty.taxInfo) {
        Object.entries(existingProperty.taxInfo).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            taxValues[key] = val.toString();
          }
        });
      }

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
        taxValues,
        suggestedRent: existingProperty.suggestedRent?.toString() || '',
        suggestedRentUsd: '',
        country: existingProperty.country || 'Argentina',
        currency: existingProperty.currency || 'ARS',
        liveArsRate: '',
      });
    } else if (address) {
      const initialCountry = detectedCountry || 'Argentina';
      const config = getTaxConfig(initialCountry);

      setFormData(prev => ({
        ...prev,
        address: address,
        imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop',
        notes: '',
        country: initialCountry,
        currency: config.defaultRentCurrency,
        taxValues: {},
      }));
    }
  }, [address, isEditing, existingProperty, detectedCountry]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    const config = getTaxConfig(newCountry);

    setFormData(prev => ({
      ...prev,
      country: newCountry,
      currency: config.defaultRentCurrency,
      taxValues: {}, // Clear taxes when country changes
      suggestedRent: '',
      suggestedRentUsd: '',
      liveArsRate: '',
    }));
    setEstimationSource(null);
  };

  const handleNumberChange = (field: string, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      [field]: cleanValue
    }));
  };

  const handleTaxValueChange = (key: string, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      taxValues: {
        ...prev.taxValues,
        [key]: cleanValue
      }
    }));
  };

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

  // AI Calculation Handler
  const handleAICalculation = async () => {
    const addressToQuery = formData.address || (isEditing && existingProperty ? existingProperty.address : '');

    if (!addressToQuery) {
      alert("Primero ingresa una dirección o selecciona una propiedad.");
      return;
    }

    setIsCalculating(true);
    try {
      const { estimateFinancials } = await import('../services/geminiService');
      const results = await estimateFinancials(addressToQuery, formData.country, Number(formData.rooms) || undefined, Number(formData.squareMeters) || undefined);

      // Map results to taxValues based on country config
      const newTaxValues: Record<string, string> = {};
      taxConfig.fields.forEach(field => {
        if (results[field.key] !== undefined) {
          newTaxValues[field.key] = results[field.key].toString();
        }
      });

      setFormData(prev => ({
        ...prev,
        taxValues: newTaxValues,
        suggestedRent: results.suggestedRent?.toString() || '',
        suggestedRentUsd: results.suggestedRentUsd?.toString() || '',
        liveArsRate: results.liveArsRate?.toString() || '',
      }));

      // Track whether this came from AI or fallback
      setEstimationSource(results.source || 'ai');

      if (results.source === 'fallback') {
        console.warn('[UI] ⚠️ Los valores mostrados son genéricos (fallback), NO de la IA. Revisa la consola para el error de Gemini.');
      }

    } catch (error: any) {
      console.error("[UI] Error calculating:", error);
      alert(`Error al calcular con IA: ${error?.message || 'Error desconocido'}. Revisa la consola (F12) para más detalles.`);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalAddress = isEditing && existingProperty ? existingProperty.address : address?.split(',')[0] || 'Nueva Propiedad';
    const finalCoords = isEditing && existingProperty ? existingProperty.coordinates : coordinates || [0, 0];
    const finalId = isEditing && existingProperty ? existingProperty.id : Date.now().toString();

    const status = formData.tenantName ? PropertyStatus.CURRENT : PropertyStatus.WARNING;

    let dateToSave = isEditing && existingProperty ? existingProperty.professionalAssignedDate : undefined;

    if (formData.assignedProfessionalId) {
      if (!existingProperty || existingProperty.assignedProfessionalId !== formData.assignedProfessionalId) {
        dateToSave = new Date().toISOString();
      }
      if (!formData.maintenanceTaskDescription.trim()) {
        alert("Por favor, describe la tarea o motivo de la obra para el profesional asignado.");
        return;
      }
    } else {
      dateToSave = undefined;
    }

    // Build taxInfo from form values
    const taxInfo: Record<string, number> = {};
    Object.entries(formData.taxValues).forEach(([key, val]) => {
      taxInfo[key] = Number(val) || 0;
    });

    // Validate rooms and square meters for new properties
    if (!isEditing && (!formData.rooms || !formData.squareMeters)) {
      alert('Por favor, ingresa los ambientes y metros cuadrados de la propiedad.');
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
      valuation: isEditing && existingProperty ? existingProperty.valuation : 0,
      taxInfo: taxInfo as any,
      suggestedRent: Number(formData.suggestedRent),
      rooms: Number(formData.rooms) || undefined,
      squareMeters: Number(formData.squareMeters) || undefined,
      country: formData.country,
      currency: formData.currency
    };
    onSave(propertyToSave);
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
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Editar Propiedad' : 'Agregar Propiedad'}
            </h2>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {isEditing ? existingProperty?.address : address || 'Dirección manual'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">

          {/* Photo Upload Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Foto de Portada</label>

            <div className="flex gap-4 items-stretch h-32">
              {/* Preview */}
              <div className="w-32 h-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 relative">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-8 h-8 opacity-50" />
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <label className="flex-1 cursor-pointer group">
                <div className="w-full h-full rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-2">
                  <div className="bg-white p-2 rounded-full shadow-sm border border-gray-200 group-hover:border-blue-200">
                    <Upload className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-700">Subir foto</p>
                    <p className="text-xs text-gray-400">JPG, PNG del dispositivo</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Property Details: Rooms & Square Meters */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Datos del Inmueble
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Ambientes</label>
                <div className="relative">
                  <LayoutGrid className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    min="1"
                    max="20"
                    placeholder="Ej: 3"
                    required={!isEditing}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold"
                    value={formData.rooms}
                    onChange={e => setFormData({ ...formData, rooms: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Metros² (m²)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej: 72"
                    required={!isEditing}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold"
                    value={formData.squareMeters}
                    onChange={e => setFormData({ ...formData, squareMeters: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location & Currency Section */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4" /> Ubicación y Moneda
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">País {taxConfig.flag}</label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.country}
                  onChange={handleCountryChange}
                >
                  <option value="Argentina">🇦🇷 Argentina</option>
                  <option value="USA">🇺🇸 Estados Unidos</option>
                  <option value="Uruguay">🇺🇾 Uruguay</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Moneda del Contrato</label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  {taxConfig.allowedRentCurrencies.map(cur => (
                    <option key={cur} value={cur}>
                      {cur === 'ARS' ? 'ARS (Pesos Arg)' : cur === 'USD' ? 'USD (Dólares)' : `${cur}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tenant Section */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Datos del Alquiler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Inquilino</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Nombre o Vacante"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={formData.tenantName}
                    onChange={e => setFormData({ ...formData, tenantName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="11-XXXX-XXXX"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={formData.tenantPhone}
                    onChange={e => setFormData({ ...formData, tenantPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Valor Alquiler Mensual ({formData.currency})</label>
              <div className="relative">
                <DollarSign className={`absolute left-3 top-3 w-5 h-5 ${formData.currency === 'USD' ? 'text-green-600' : 'text-blue-600'}`} />
                <input
                  type="text"
                  placeholder="0"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold"
                  value={formatNumberWithDots(formData.monthlyRent)}
                  onChange={e => handleNumberChange('monthlyRent', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* === DYNAMIC Taxes & AI Estimation Section === */}
          <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Impuestos y Estimaciones (IA)
              </h3>
              <button
                type="button"
                onClick={handleAICalculation}
                disabled={isCalculating}
                className="text-white text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {isCalculating ? (
                  <>Calculando...</>
                ) : (
                  <><Sparkles className="w-3 h-3" /> Calcular con IA</>
                )}
              </button>
            </div>

            {/* Source Indicator Badge */}
            {estimationSource && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${estimationSource === 'ai'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                {estimationSource === 'ai' ? (
                  <><Sparkles className="w-3 h-3" /> ✅ Valores calculados por IA (Gemini)</>
                ) : (
                  <>⚠️ Estimación genérica (la IA no respondió — revisa consola F12)</>
                )}
              </div>
            )}

            {/* Suggested Rent Display */}
            {formData.suggestedRent && (
              <div className="bg-white/80 p-3 rounded-xl border border-indigo-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-indigo-800 uppercase">Alquiler Sugerido</span>
                  <span className="text-lg font-bold text-indigo-700">
                    {getCurrencySymbol(taxConfig.taxCurrency === 'ARS' ? 'ARS' : formData.currency)}{' '}
                    {formatNumberWithDots(formData.suggestedRent)}
                  </span>
                </div>
                {/* Show USD equivalent for Argentina */}
                {formData.country === 'Argentina' && formData.suggestedRentUsd && (
                  <div className="flex justify-between items-center border-t border-indigo-100 pt-1">
                    <span className="text-[10px] font-medium text-green-700 uppercase">≈ Equivalente USD</span>
                    <span className="text-sm font-bold text-green-700">
                      US$ {formatNumberWithDots(formData.suggestedRentUsd)}
                    </span>
                  </div>
                )}
                {formData.liveArsRate && (
                  <p className="text-[10px] text-indigo-500 text-right">
                    TC Oficial: 1 USD = ${formatNumberWithDots(formData.liveArsRate)} ARS
                  </p>
                )}
              </div>
            )}

            {/* Dynamic Tax Fields */}
            <div className="space-y-1">
              <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wider">
                Impuestos en {taxConfig.taxCurrency} {taxConfig.flag}
              </p>
              <div className={`grid grid-cols-${taxConfig.fields.length} gap-3`}>
                {taxConfig.fields.map(field => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium text-indigo-800">{field.label}</label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-indigo-400 text-xs">
                        {getCurrencySymbol(field.currency)}
                      </span>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full pl-7 pr-2 py-2 rounded-lg border border-indigo-200 bg-white text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                        value={formatNumberWithDots(formData.taxValues[field.key] || '')}
                        onChange={e => handleTaxValueChange(field.key, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-indigo-600/70 italic leading-tight">
              * Los valores son estimados por Inteligencia Artificial basados en la ubicación. Puedes editarlos manualmente si tienes la boleta exacta.
            </p>
          </div>

          {/* Documentos Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Documentos / Recibos
            </label>
            <div className="flex flex-col gap-2">
              {uploadedDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                  <Check className="w-4 h-4" /> {doc}
                </div>
              ))}
              <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 border-dashed w-fit">
                <Upload className="w-4 h-4" /> + Adjuntar Archivo (PDF, Img)
                <input type="file" className="hidden" onChange={handleDocUpload} />
              </label>
            </div>
          </div>

          {/* Professional Assignment */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Profesional / Encargado Asignado</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <select
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                  value={formData.assignedProfessionalId}
                  onChange={e => setFormData({ ...formData, assignedProfessionalId: e.target.value })}
                >
                  <option value="">Seleccionar Profesional (Opcional)...</option>
                  {professionals.map(pro => (
                    <option key={pro.id} value={pro.id}>{pro.name} - {pro.profession}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Maintenance Description */}
            {formData.assignedProfessionalId && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-medium text-orange-700 flex items-center gap-1">
                  <Hammer className="w-4 h-4" /> Descripción de la Obra / Tarea
                </label>
                <input
                  type="text"
                  placeholder="Ej: Reparación de cañería en cocina..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  value={formData.maintenanceTaskDescription}
                  onChange={e => setFormData({ ...formData, maintenanceTaskDescription: e.target.value })}
                />
                <p className="text-xs text-orange-600">Especifica qué trabajo está realizando el profesional.</p>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wider flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> Notas y Recordatorios
              </h3>
            </div>
            <textarea
              placeholder="Ej: El portero se llama Jose. Recordar pedir comprobante de servicio de luz..."
              className="w-full p-3 rounded-xl border border-yellow-200 bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none h-24 text-sm"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
            <p className="text-xs text-yellow-600 mt-2 italic">* Espacio personal para anotar detalles importantes de esta propiedad.</p>
          </div>

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-white hover:shadow-sm transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-[2] py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" /> {isEditing ? 'Guardar Cambios' : 'Crear Propiedad'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPropertyModal;