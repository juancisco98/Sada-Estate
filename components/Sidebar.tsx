import React from 'react';
import { LayoutDashboard, Wallet, Users, X, Map as MapIcon, LogOut } from 'lucide-react';

export type ViewState = 'MAP' | 'OVERVIEW' | 'FINANCE' | 'PROFESSIONALS';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout?: () => void; // New optional prop for logout
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, onNavigate, onLogout }) => {
  const menuItems = [
    { id: 'MAP', label: 'Mapa Interactivo', icon: MapIcon },
    { id: 'OVERVIEW', label: 'Visión General', icon: LayoutDashboard },
    { id: 'FINANCE', label: 'Finanzas', icon: Wallet },
    { id: 'PROFESSIONALS', label: 'Profesionales', icon: Users },
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
      <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-[1500] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold">SV</div>
            <span className="font-bold text-xl text-gray-900">SV sistemas</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id as ViewState);
                  onClose();
                }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="text-lg">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 w-full p-6 space-y-4 bg-white">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Estado del sistema</p>
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sada Voice Activo
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
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

export default Sidebar;