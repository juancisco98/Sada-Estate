import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MOCK_PROFESSIONALS } from '../constants';
import { Professional } from '../types';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-lg">
        <p className="font-bold text-gray-800">{data.name}</p>
        <p className="text-sm text-gray-600">{data.profession}</p>
        <div className="mt-2 text-xs">
           <p>Calidad: <b>{data.rating}</b></p>
           <p>Rapidez: <b>{data.speedRating}</b></p>
        </div>
      </div>
    );
  }
  return null;
};

const MetricsDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-50 z-[1050] overflow-y-auto animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto p-6 pb-24">
        <header className="flex justify-between items-center mb-8 sticky top-0 bg-gray-50/95 backdrop-blur py-4 z-10 border-b border-gray-200">
           <div>
             <h1 className="text-3xl font-bold text-gray-900">Métricas & Rentabilidad</h1>
             <p className="text-gray-500 text-lg">Reporte consolidado</p>
           </div>
           <button onClick={onClose} className="bg-white p-3 rounded-full shadow-md text-gray-600 hover:bg-gray-100 border border-gray-200">
             <span className="text-xl font-bold">✕</span>
           </button>
        </header>

        {/* Financial Summary */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <h3 className="text-gray-400 font-medium uppercase text-sm mb-2">Ingresos este mes</h3>
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-bold text-gray-900">$1.930.000</span>
               <span className="text-green-600 font-medium text-sm">▲ 12% vs mes anterior</span>
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <h3 className="text-gray-400 font-medium uppercase text-sm mb-2">Morosidad Global</h3>
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-bold text-red-600">18 días</span>
               <span className="text-gray-500 font-medium text-sm">Promedio cartera</span>
             </div>
          </div>
        </section>

        {/* Professionals Matrix */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-10">
           <h2 className="text-xl font-bold text-gray-900 mb-6">Matriz de Profesionales: Calidad vs. Rapidez</h2>
           <div className="h-80 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis 
                    type="number" 
                    dataKey="speedRating" 
                    name="Rapidez" 
                    domain={[0, 5]} 
                    label={{ value: 'Rapidez (1-5)', position: 'bottom', offset: 0 }}
                    tick={{fill: '#6b7280'}}
                 />
                 <YAxis 
                    type="number" 
                    dataKey="rating" 
                    name="Calidad" 
                    domain={[0, 5]} 
                    label={{ value: 'Calidad (1-5)', angle: -90, position: 'left' }}
                    tick={{fill: '#6b7280'}}
                 />
                 <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                 <Scatter name="Profesionales" data={MOCK_PROFESSIONALS} fill="#3b82f6">
                    {MOCK_PROFESSIONALS.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.rating > 4.5 ? '#16a34a' : entry.rating < 3 ? '#dc2626' : '#facc15'} />
                    ))}
                 </Scatter>
               </ScatterChart>
             </ResponsiveContainer>
           </div>
           <p className="text-sm text-gray-400 mt-4 text-center">Tamaño de burbuja: Nivel de confianza. Color: Performance General.</p>
        </section>

        {/* Action Button */}
        <div className="flex justify-center">
          <button className="flex items-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-2xl hover:bg-gray-800 transition-colors shadow-lg">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
             </svg>
             <span className="font-semibold text-lg">Generar Reporte Contador (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;