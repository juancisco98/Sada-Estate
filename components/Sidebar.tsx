import React from 'react';
import { LayoutDashboard, Wallet, Users, X, Map as MapIcon, LogOut, UserCheck, ArrowLeftRight, Bell, Settings } from 'lucide-react';

export type ViewState = 'MAP' | 'OVERVIEW' | 'FINANCE' | 'PROFESSIONALS' | 'TENANTS' | 'REMINDERS' | 'SETTINGS';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout?: () => void;
  onSwitchMode?: () => void;
  reminderCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, onNavigate, onLogout, onSwitchMode, reminderCount }) => {
  const menuItems = [
    { id: 'MAP', label: 'Mapa Interactivo', icon: MapIcon },
    { id: 'OVERVIEW', label: 'Visión General', icon: LayoutDashboard },
    { id: 'REMINDERS', label: 'Recordatorios', icon: Bell, badge: reminderCount },
    { id: 'TENANTS', label: 'Inquilinos', icon: UserCheck },
    { id: 'FINANCE', label: 'Finanzas', icon: Wallet },
    { id: 'PROFESSIONALS', label: 'Profesionales', icon: Users },
    { id: 'SETTINGS', label: 'Ajustes', icon: Settings },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[1400] backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-slate-950 shadow-2xl z-[1500] transform transition-transform duration-300 ease-in-out border-r dark:border-white/10 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 dark:bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">SV</div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">SV Prop</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400" aria-label="Cerrar menú">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id as ViewState);
                  onClose();
                }}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-[22px] transition-all duration-300 group ${isActive
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200/50 dark:shadow-none font-bold scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white font-medium'
                  }`}
              >
                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20' : 'bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 text-gray-400 group-hover:text-indigo-600'}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-base font-semibold tracking-tight">{item.label}</span>
                {(item as any).badge > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {(item as any).badge > 99 ? '99+' : (item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 w-full p-6 space-y-2 bg-white dark:bg-slate-900 border-t dark:border-white/5">
          {onSwitchMode && (
            <button
              onClick={() => { onSwitchMode(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
            >
              <ArrowLeftRight className="w-5 h-5" />
              <span className="font-medium">Cambiar modo</span>
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-rose-500 hover:bg-red-50 dark:hover:bg-rose-500/10 transition-colors border border-transparent hover:border-red-100 dark:hover:border-rose-500/20"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default React.memo(Sidebar);