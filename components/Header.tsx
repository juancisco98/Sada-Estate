import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Loader2, Bell, Sun, Moon, CheckCircle, Clock, Upload, X, Check } from 'lucide-react';
import { ViewState } from './Sidebar';
import { User, AppNotification } from '../types';
import InstallButton from './InstallButton';
import { useTheme } from '../context/ThemeContext';
import { useDataContext } from '../context/DataContext';

interface HeaderProps {
    onMenuClick: () => void;
    currentUser: User | null;
    currentView: ViewState;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSearchSubmit: () => void;
    isSearching: boolean;
    onNavigateToMap: () => void;
}

const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
};

const NotificationIcon: React.FC<{ type: AppNotification['type'] }> = ({ type }) => {
    if (type === 'PAYMENT_APPROVED') return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (type === 'PAYMENT_REVISION') return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
    return <Upload className="w-4 h-4 text-indigo-500 shrink-0" />;
};

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
    const { theme, toggleTheme } = useTheme();
    const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useDataContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        if (showNotifications) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showNotifications]);

    return (
        <div className="absolute top-0 left-0 right-0 z-[800] p-3 sm:p-5 pointer-events-none">
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none rounded-[28px] sm:rounded-full p-2.5 sm:p-3.5 flex items-center justify-between pointer-events-auto max-w-[98%] sm:max-w-[96%] xl:max-w-7xl mx-auto border border-white/40 dark:border-white/10 ring-1 ring-black/5">
                <div className="flex items-center gap-2 sm:gap-4 ml-1">
                    <button
                        onClick={onMenuClick}
                        className="p-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-full text-gray-800 dark:text-white transition-all active:scale-95 w-11 h-11 flex items-center justify-center border border-gray-200/80 dark:border-white/10 shadow-sm"
                        aria-label="Abrir menú"
                    >
                        <Menu className="w-5 h-5 sm:w-5 sm:h-5" />
                    </button>

                    <div className="hidden md:flex flex-col ml-2">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-extrabold text-[#1f2937] dark:text-white leading-none tracking-tight">SV Propiedades</h1>
                            {currentUser?.color && (
                                <div
                                    className="w-3 h-3 rounded-full border border-gray-300 dark:border-white/20 shadow-sm"
                                    style={{ backgroundColor: currentUser.color }}
                                    title={`Sesión activa: ${currentUser.name}`}
                                ></div>
                            )}
                        </div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">Bienvenido, {currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuario'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 mr-1">
                    <button
                        onClick={toggleTheme}
                        className="p-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-full text-gray-700 dark:text-gray-200 transition-all shadow-sm active:scale-95 w-11 h-11 flex items-center justify-center border border-gray-200/80 dark:border-white/10"
                        aria-label="Cambiar tema"
                    >
                        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>
                    <InstallButton />
                    {currentView === 'MAP' && (
                        <div className="flex items-center bg-white/50 dark:bg-slate-800/50 border border-gray-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200 rounded-full px-3 py-1.5 min-h-[44px] transition-all focus-within:ring-4 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 shadow-sm">
                            {isSearching ? (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                            ) : (
                                <button onClick={onSearchSubmit} className="cursor-pointer hover:text-blue-600 transition-colors" aria-label="Buscar">
                                    <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
                                </button>
                            )}
                            <input
                                type="text"
                                placeholder="Buscar dirección..."
                                aria-label="Buscar dirección"
                                className="bg-transparent border-none outline-none text-sm sm:text-base text-gray-800 dark:text-white w-28 sm:w-40 md:w-72 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                            />
                        </div>
                    )}

                    {/* Notifications Bell */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            className="p-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-full text-gray-700 dark:text-gray-200 relative transition-all shadow-sm active:scale-95 w-11 h-11 flex items-center justify-center border border-gray-200/80 dark:border-white/10"
                            onClick={() => setShowNotifications(v => !v)}
                            aria-label="Notificaciones"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center leading-none">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Mapa button when not on map */}
                        {currentView !== 'MAP' && !showNotifications && (
                            <button
                                className="hidden"
                                onClick={onNavigateToMap}
                            />
                        )}

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 top-14 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl dark:shadow-black/40 z-[900] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Dropdown header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/5">
                                    <div className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                        <span className="font-bold text-sm text-slate-800 dark:text-white">Notificaciones</span>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount} nuevas</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={() => markAllNotificationsRead()}
                                                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                                title="Marcar todas como leídas"
                                            >
                                                <Check className="w-3 h-3" /> Todas leídas
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowNotifications(false)}
                                            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Notification list */}
                                <div className="max-h-[360px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            Sin notificaciones
                                        </div>
                                    ) : (
                                        notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={() => !notif.read && markNotificationRead(notif.id)}
                                                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors cursor-pointer
                                                    ${!notif.read
                                                        ? notif.type === 'PAYMENT_APPROVED'
                                                            ? 'bg-emerald-50/60 dark:bg-emerald-500/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/15'
                                                            : notif.type === 'PAYMENT_REVISION'
                                                                ? 'bg-amber-50/60 dark:bg-amber-500/10 hover:bg-amber-50 dark:hover:bg-amber-500/15'
                                                                : 'bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/15'
                                                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                                                    notif.type === 'PAYMENT_APPROVED' ? 'bg-emerald-100 dark:bg-emerald-500/20' :
                                                    notif.type === 'PAYMENT_REVISION' ? 'bg-amber-100 dark:bg-amber-500/20' :
                                                    'bg-indigo-100 dark:bg-indigo-500/20'
                                                }`}>
                                                    <NotificationIcon type={notif.type} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-sm font-bold truncate ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {notif.title}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">{timeAgo(notif.createdAt)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                                                </div>
                                                {!notif.read && (
                                                    <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Footer — navigate to map */}
                                {currentView !== 'MAP' && (
                                    <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                                        <button
                                            onClick={() => { setShowNotifications(false); onNavigateToMap(); }}
                                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            Volver al mapa
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(Header);
