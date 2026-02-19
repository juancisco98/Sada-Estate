import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, KeyRound, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';



interface AuthScreenProps { }

type AuthView = 'LOGIN' | 'REGISTER' | 'RECOVERY';

const AuthScreen: React.FC<AuthScreenProps> = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    // Dynamically import to avoid circular dependencies if any, though here it's fine.
    // Using the helper from services
    const { signInWithGoogle } = await import('../services/supabaseClient');
    const { error: authError } = await signInWithGoogle();

    if (authError) {
      console.error("Google Login Error:", authError);
      setError('Error al iniciar sesión con Google. Verifica tu conexión.');
      setIsLoading(false);
    }
    // If successful, Supabase will redirect, so no need to stop loading manually immediately
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

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">SV Propiedades</h1>
          <p className="text-blue-200 mt-2 text-sm font-medium">Gestión Inmobiliaria Inteligente</p>
          <div className="mt-4 inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            Acceso Privado Familiar
          </div>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continuar con Google</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <p className="text-red-200 text-xs">{error}</p>
            </div>
          )}

          <p className="text-center text-gray-400 text-xs">
            Solo emails autorizados de la familia Sada.
          </p>
        </div>

      </div>

      <p className="absolute bottom-6 text-gray-500 text-xs text-center w-full z-10">
        &copy; {new Date().getFullYear()} SV Propiedades.
      </p>
    </div>
  );
};

export default AuthScreen;