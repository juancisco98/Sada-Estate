import React from 'react';
import { Menu, Search, Loader2, Bell } from 'lucide-react';
import { ViewState } from './Sidebar';

interface HeaderProps {
    onMenuClick: () => void;
    currentUser: { name?: string; email?: string } | null;
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
        <div className="absolute top-0 left-0 right-0 z-[800] p-4 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-3xl p-3 flex items-center justify-between pointer-events-auto max-w-[95%] xl:max-w-7xl mx-auto border border-white/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="p-2 hover:bg-gray-100 rounded-2xl text-gray-800 transition-colors active:scale-95"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="hidden md:flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 leading-none tracking-tight">SV Propiedades</h1>
                            {currentUser?.color && (
                                <div
                                    className="w-3 h-3 rounded-full border border-gray-300 shadow-sm"
                                    style={{ backgroundColor: currentUser.color }}
                                    title={`Sesión activa: ${currentUser.name}`}
                                ></div>
                            )}
                        </div>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">Bienvenido, {currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuario'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {currentView === 'MAP' && (
                        <div className="flex items-center bg-gray-100/80 hover:bg-white border border-transparent hover:border-blue-200 rounded-2xl px-3 py-2 transition-all focus-within:ring-4 focus-within:ring-blue-100 shadow-inner">
                            {isSearching ? (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                            ) : (
                                <button onClick={onSearchSubmit} className="cursor-pointer hover:text-blue-600 transition-colors">
                                    <Search className="w-5 h-5 text-gray-500 mr-2" />
                                </button>
                            )}
                            <input
                                type="text"
                                placeholder="Buscar dirección (Ej: Miami...)"
                                className="bg-transparent border-none outline-none text-base text-gray-800 w-40 md:w-72 placeholder-gray-400 font-medium"
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                            />
                        </div>
                    )}

                    <button
                        className="p-2 hover:bg-gray-100 rounded-2xl text-gray-700 relative transition-colors shadow-sm active:scale-95"
                        onClick={onNavigateToMap}
                    >
                        {currentView === 'MAP' ? (
                            <>
                                <Bell className="w-6 h-6" />
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                            </>
                        ) : (
                            <span className="text-xs font-bold border border-gray-300 bg-white shadow-sm rounded-xl px-3 py-1.5 hover:bg-gray-50">
                                Volver al Mapa
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Header;
