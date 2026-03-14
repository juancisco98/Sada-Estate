import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle, X, DollarSign } from 'lucide-react';
import { Property, Professional, MaintenanceTask } from '../types';
import { toast } from 'sonner';

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
      toast.error("Por favor califica el trabajo realizado.");
      return;
    }
    const finalCost = parseFloat(cost) || 0;
    onConfirm(rating, speedRating || rating, comment, finalCost);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border dark:border-white/10 max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-6 border-b border-emerald-100 dark:border-emerald-500/20 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" /> Finalizar Obra
            </h2>
            <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
              {property.address}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-full text-emerald-700 dark:text-emerald-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-2 text-sm">¿Cómo fue el trabajo de?</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{professionalName}</h3>
          </div>

          {/* Quality Rating */}
          <div className="space-y-2 text-center">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Calidad del Trabajo</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={`q-${star}`}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200 dark:text-slate-700'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Speed Rating */}
          <div className="space-y-2 text-center">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rapidez / Cumplimiento</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={`s-${star}`}
                  onClick={() => setSpeedRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${star <= speedRating ? 'fill-indigo-400 text-indigo-400' : 'text-slate-200 dark:text-slate-700'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cost Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Costo Final (ARS)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white text-lg placeholder-slate-400 dark:placeholder-slate-500"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            {partialCost > 0 && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-medium mt-1">
                Incluye gasto parcial acumulado de ${partialCost.toLocaleString('es-AR')}
              </p>
            )}
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 italic">Ingrese el costo total de la obra.</p>
          </div>

          {/* Comment */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2 mb-2 text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Comentario Privado</span>
            </div>
            <textarea
              className="w-full bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 resize-none h-20 placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Escribí detalles para recordar en el futuro..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 shadow-xl transition-all active:scale-[0.98]"
          >
            Guardar y Finalizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinishMaintenanceModal;
