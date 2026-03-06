import React from 'react';
import { Menu, Search, Loader2, Bell } from 'lucide-react';
import { ViewState } from './Sidebar';
import { User } from '../types';
import InstallButton from './InstallButton';

interface HeaderProps {
    onMenuClick: () => void;
    currentUser: User | null;
    currentView: ViewState;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSearchSubmit: () => void;
    isSearching: boolean;
    onNavigateToMap: () => void; // Resets map center too
}

const Header: React.FC<HeaderProps> = ({
    onMenuClick,
    currentUser,
    currentView,
    searchQuery,
    onSearchChange,
    onSearchSubmit,
    isSearching,
    onNavigateToMap
}) => {
    return (
        <div className="absolute top-0 left-0 right-0 z-[800] p-2 sm:p-4 pointer-events-none">
            <div className="bg-white/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-[32px] sm:rounded-full p-2.5 sm:p-3 flex items-center justify-between pointer-events-auto max-w-[98%] sm:max-w-[95%] xl:max-w-7xl mx-auto border border-white/60">
                <div className="flex items-center gap-2 sm:gap-4 ml-1">
                    <button
                        onClick={onMenuClick}
                        className="p-2 bg-white/50 hover:bg-white rounded-full text-gray-800 transition-all active:scale-95 w-11 h-11 flex items-center justify-center border border-gray-200/80 shadow-sm"
                        aria-label="Abrir menú"
                    >
                        <Menu className="w-5 h-5 sm:w-5 sm:h-5" />
                    </button>

                    <div className="hidden md:flex flex-col ml-2">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-extrabold text-[#1f2937] leading-none tracking-tight">SV Propiedades</h1>
                            {currentUser?.color && (
                                <div
                                    className="w-3 h-3 rounded-full border border-gray-300 shadow-sm"
                                    style={{ backgroundColor: currentUser.color }}
                                    title={`Sesión activa: ${currentUser.name}`}
                                ></div>
                            )}
                        </div>
                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">Bienvenido, {currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuario'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 mr-1">
                    <InstallButton />
                    {currentView === 'MAP' && (
                        <div className="flex items-center bg-white/50 border border-gray-200/80 hover:bg-white hover:border-blue-200 rounded-full px-3 py-1.5 min-h-[44px] transition-all focus-within:ring-4 focus-within:ring-blue-100 shadow-sm">
                            {isSearching ? (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                            ) : (
                                <button onClick={onSearchSubmit} className="cursor-pointer hover:text-blue-600 transition-colors" aria-label="Buscar">
                                    <Search className="w-5 h-5 text-gray-400 mr-2" />
                                </button>
                            )}
                            <input
                                type="text"
                                placeholder="Buscar dirección..."
                                aria-label="Buscar dirección"
                                className="bg-transparent border-none outline-none text-sm sm:text-base text-gray-800 w-28 sm:w-40 md:w-72 placeholder-gray-400 font-medium"
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                            />
                        </div>
                    )}

                    <button
                        className="p-2 bg-white/50 hover:bg-white rounded-full text-gray-700 relative transition-all shadow-sm active:scale-95 w-11 h-11 flex items-center justify-center border border-gray-200/80"
                        onClick={onNavigateToMap}
                        aria-label={currentView === 'MAP' ? 'Notificaciones' : 'Volver al Mapa'}
                    >
                        {currentView === 'MAP' ? (
                            <>
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                            </>
                        ) : (
                            <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                                Mapa
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div >
    );
};

export default React.memo(Header);
