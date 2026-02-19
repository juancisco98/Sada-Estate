import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle, X, DollarSign } from 'lucide-react';
import { Property, Professional, MaintenanceTask } from '../types';

interface FinishMaintenanceModalProps {
  property: Property;
  professionalName: string;
  task?: MaintenanceTask;
  onClose: () => void;
  onConfirm: (rating: number, speedRating: number, comment: string, cost: number) => void;
}

const FinishMaintenanceModal: React.FC<FinishMaintenanceModalProps> = ({
  property,
  professionalName,
  task,
  onClose,
  onConfirm
}) => {
  const [rating, setRating] = useState(0);
  const [speedRating, setSpeedRating] = useState(0);
  const [comment, setComment] = useState('');

  const partialCost = task?.partialExpenses?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const [cost, setCost] = useState(partialCost > 0 ? partialCost.toString() : '');

  const handleSubmit = () => {
    if (rating === 0) {
      alert("Por favor califica el trabajo realizado.");
      return;
    }
    const finalCost = parseFloat(cost) || 0;
    onConfirm(rating, speedRating || rating, comment, finalCost);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-green-50 p-6 border-b border-green-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-green-800 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" /> Finalizar Obra
            </h2>
            <p className="text-sm text-green-600 mt-1">
              {property.address}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-100 rounded-full text-green-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-gray-500 mb-2 text-sm">¿Cómo fue el trabajo de?</p>
            <h3 className="text-2xl font-bold text-gray-900">{professionalName}</h3>
          </div>

          {/* Quality Rating */}
          <div className="space-y-2 text-center">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Calidad del Trabajo</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={`q-${star}`}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Speed Rating */}
          <div className="space-y-2 text-center">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rapidez / Cumplimiento</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={`s-${star}`}
                  onClick={() => setSpeedRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${star <= speedRating ? 'fill-blue-400 text-blue-400' : 'text-gray-200'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cost Input (ARS) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Costo Final (ARS)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-900 text-lg"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            {partialCost > 0 && (
              <p className="text-xs text-center text-orange-500 font-medium mt-1">
                Incluye gasto parcial acumulado de ${partialCost}
              </p>
            )}
            <p className="text-xs text-center text-gray-400 italic">Ingrese el monto en dólares.</p>
          </div>

          {/* Comment */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-gray-400">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Comentario Privado</span>
            </div>
            <textarea
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700 resize-none h-20 placeholder-gray-400"
              placeholder="Escribí detalles para recordar en el futuro..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 shadow-xl transition-all active:scale-[0.98]"
          >
            Guardar y Finalizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinishMaintenanceModal;