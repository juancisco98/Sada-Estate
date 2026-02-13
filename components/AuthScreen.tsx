import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, KeyRound, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';

import { MOCK_USERS } from '../constants';

interface AuthScreenProps {
  onLogin: (user: any) => void;
}

type AuthView = 'LOGIN' | 'REGISTER' | 'RECOVERY';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [view, setView] = useState<AuthView>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      // 1. Check Mock Users (Parents)
      const mockUser = MOCK_USERS.find(u =>
        (u.email === email || u.name === email) && u.password === password
      );

      if (mockUser) {
        onLogin(mockUser);
        return;
      }

      // 2. Check Stored Users (Legacy/Register)
      const storedUsers = JSON.parse(localStorage.getItem('sada_users') || '[]');
      const user = storedUsers.find((u: any) =>
        (u.email === email || u.username === email) && u.password === password
      );

      if (user) {
        onLogin(user);
      } else {
        setError('Usuario o contraseña incorrectos. Intenta con padre1@sada.com / 123');
        setIsLoading(false);
      }
    }, 1000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('Por favor ingresa un email válido.');
      return;
    }
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const storedUsers = JSON.parse(localStorage.getItem('sada_users') || '[]');

      if (storedUsers.find((u: any) => u.email === email)) {
        setError('Este email ya está registrado.');
        setIsLoading(false);
        return;
      }

      const newUser = { username, email, password };
      storedUsers.push(newUser);
      localStorage.setItem('sada_users', JSON.stringify(storedUsers));

      setIsLoading(false);
      onLogin(newUser); // Auto login
    }, 1500);
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('Ingresa el email para recuperarla.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMsg(`¡Listo! Hemos enviado un correo a ${email} con un enlace para crear una nueva contraseña.`);
    }, 2000);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-gray-900 flex items-center justify-center p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"
          alt="Background"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-blue-900/20"></div>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-500">

        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-white tracking-tight">SV Propiedades</h1>
          <p className="text-blue-200 mt-2 text-sm font-medium">Gestión Inmobiliaria Inteligente</p>
        </div>

        {view === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase ml-1">Usuario o Email</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ej: roberto@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-12 pr-12 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Ingresar <ArrowRight className="w-5 h-5" /></>}
            </button>

            <div className="flex justify-between items-center mt-6 text-sm">
              <button type="button" onClick={() => setView('REGISTER')} className="text-gray-400 hover:text-white transition-colors">Crear cuenta</button>
              <button type="button" onClick={() => setView('RECOVERY')} className="text-blue-400 hover:text-blue-300 transition-colors">Olvidé mi clave</button>
            </div>
          </form>
        )}

        {view === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase ml-1">Email (Para recuperar)</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="nombre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase ml-1">Crear Usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: Roberto2024"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase ml-1">Crear Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-12 pr-12 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Registrarme <CheckCircle className="w-5 h-5" /></>}
            </button>

            <button type="button" onClick={() => setView('LOGIN')} className="w-full text-center text-gray-400 hover:text-white text-sm mt-4">
              Ya tengo cuenta, volver al inicio
            </button>
          </form>
        )}

        {view === 'RECOVERY' && (
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <p className="text-gray-300 text-sm">Ingresa tu email y te enviaremos un enlace mágico para restablecer tu contraseña.</p>
            </div>

            {!successMsg ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 uppercase ml-1">Tu Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="nombre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar enlace"}
                </button>
              </>
            ) : (
              <div className="bg-green-900/30 border border-green-800 p-4 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-200 text-sm">{successMsg}</p>
              </div>
            )}

            <button type="button" onClick={() => { setView('LOGIN'); setSuccessMsg(''); }} className="w-full text-center text-gray-400 hover:text-white text-sm mt-4">
              Volver al inicio
            </button>
          </form>
        )}

      </div>

      <p className="absolute bottom-6 text-gray-500 text-xs text-center w-full z-10">
        &copy; {new Date().getFullYear()} SV Propiedades. Protección de datos activa.
      </p>
    </div>
  );
};

export default AuthScreen;