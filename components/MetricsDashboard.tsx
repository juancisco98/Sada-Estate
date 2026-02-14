import React from 'react';
import { Property, Professional, MaintenanceTask, PropertyStatus } from '../types';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { X, TrendingUp, Clock, Users } from 'lucide-react';
import { formatCurrency, convertCurrency } from '../utils/currency';

interface MetricsDashboardProps {
  properties: Property[];
  professionals: Professional[];
  maintenanceTasks: MaintenanceTask[];
  onClose: () => void;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ properties, professionals, maintenanceTasks, onClose }) => {

  // Calculate live metrics
  const totalMonthlyIncome = properties.reduce((acc, p) => {
    return acc + convertCurrency(p.monthlyRent, p.currency || 'ARS', 'USD');
  }, 0);

  const propertiesCount = properties.length;
  const lateCount = properties.filter(p => p.status === PropertyStatus.LATE).length;
  const delinquencyRate = propertiesCount > 0 ? Math.round((lateCount / propertiesCount) * 100) : 0;

  const activeMaintenanceCount = maintenanceTasks.filter(t => t.status === 'IN_PROGRESS').length;

  // Scatter data for professional ratings
  const chartData = professionals
    .filter(p => p.rating > 0)
    .map(p => ({
      name: p.name,
      quality: p.rating,
      speed: p.speedRating || p.rating,
      profession: p.profession,
    }));

  const getColor = (quality: number, speed: number) => {
    const avg = (quality + speed) / 2;
    if (avg >= 4.5) return '#10B981';
    if (avg >= 3.5) return '#3B82F6';
    if (avg >= 2.5) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Métricas Generales</h2>
            <p className="text-sm text-gray-500">Resumen operativo en tiempo real</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
              <TrendingUp className="w-5 h-5 mx-auto text-green-600 mb-1" />
              <p className="text-xs text-green-600 font-bold uppercase">Ingreso Mensual</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalMonthlyIncome, 'USD')}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
              <Clock className="w-5 h-5 mx-auto text-red-600 mb-1" />
              <p className="text-xs text-red-600 font-bold uppercase">Mora</p>
              <p className="text-lg font-bold text-gray-900">{delinquencyRate}%</p>
              <p className="text-[10px] text-gray-400">{lateCount} de {propertiesCount}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
              <Users className="w-5 h-5 mx-auto text-orange-600 mb-1" />
              <p className="text-xs text-orange-600 font-bold uppercase">Obras Activas</p>
              <p className="text-lg font-bold text-gray-900">{activeMaintenanceCount}</p>
            </div>
          </div>

          {/* Professional Scatter Chart */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Mapa de Rendimiento Profesional</h3>
            <p className="text-xs text-gray-400 mb-4">Calidad vs. Rapidez (solo profesionales calificados)</p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" dataKey="speed" name="Rapidez" domain={[0, 5]} tick={{ fontSize: 10 }} label={{ value: 'Rapidez', position: 'bottom', fontSize: 10 }} />
                  <YAxis type="number" dataKey="quality" name="Calidad" domain={[0, 5]} tick={{ fontSize: 10 }} label={{ value: 'Calidad', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-lg border text-xs">
                            <p className="font-bold text-gray-900">{d.name}</p>
                            <p className="text-gray-500">{d.profession}</p>
                            <p className="text-green-600">Calidad: {d.quality.toFixed(1)}</p>
                            <p className="text-blue-600">Rapidez: {d.speed.toFixed(1)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter data={chartData}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getColor(entry.quality, entry.speed)} r={8} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm">Sin profesionales calificados aún.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;