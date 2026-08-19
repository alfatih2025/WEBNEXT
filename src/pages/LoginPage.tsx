import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { Leaf, AlertCircle } from 'lucide-react';

export function LoginPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      const success = await login();
      if (success && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan Google.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8 bg-white/80 dark:bg-slate-900/80 shadow-2xl relative z-10 border border-slate-200/50 dark:border-slate-800/50">
          <div className="text-center mb-8">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 w-16 h-16 flex items-center justify-center rounded-2xl mb-4 shadow-inner">
              <Leaf className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">NexaGrow Admin</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Login dengan Google untuk mengakses kontrol panel pintar.</p>
          </div>

          <div className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Login dengan Google
            </button>
          </div>
          
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            Hanya admin yang memiliki akses penuh.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
