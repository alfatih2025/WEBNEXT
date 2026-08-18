import { useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  MessageSquare,
  Settings,
  CloudSun,
  FileText,
  Menu,
  X,
  Sprout,
  Zap,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { LogOut } from 'lucide-react';
import logo from '../assets/nexagrow-logo.png';

export type PageId =
  | 'dashboard'
  | 'monitoring'
  | 'chat'
  | 'control'
  | 'weather'
  | 'logs'
  | 'settings'
  | 'about'
  | 'login';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const menuItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'control', label: 'Kontrol', icon: Zap },
  { id: 'weather', label: 'Cuaca', icon: CloudSun },
  { id: 'logs', label: 'Log & Analitik', icon: FileText },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
  { id: 'about', label: 'About', icon: BookOpen },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { logout, currentUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white light-card dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-green-600 dark:bg-blue-600">
            <img src={logo} alt="NexaGrow" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">NexaGrow</h1>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4 pb-24 scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onPageChange(item.id);
                setMobileOpen(false);
              }}
              className={`group flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-green-600 text-white shadow-md shadow-green-900/20 dark:bg-blue-600 dark:shadow-blue-900/20'
                  : 'text-slate-600 hover:bg-green-50 hover:text-green-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-600'
              }`}
            >
              <Icon
                size={20}
                className={`transition-colors ${
                  isActive ? 'text-white' : 'text-slate-600 group-hover:text-green-600 dark:group-hover:text-blue-600'
                }`}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-slate-200/50 dark:border-slate-800/50 p-4 space-y-4">
                <div className="flex items-center justify-between px-2">
          {currentUser ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {currentUser.username.charAt(0)}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">
                  {currentUser.username}
                </div>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                title="Keluar"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => { onPageChange('login'); setMobileOpen(false); }}
              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center"
            >
              Login Admin
            </button>
          )}
        </div>
        
        <p className="text-[10px] font-bold tracking-wider text-slate-600 dark:text-slate-500 uppercase">
          NexaGrow Web v2.0
        </p>
      </div>
    </div>
  );

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden inline-flex items-center justify-center rounded-2xl bg-green-600 dark:bg-blue-600 text-white p-3 shadow-lg shadow-green-900/20 dark:shadow-blue-900/20"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </motion.button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <motion.div
        animate={{ x: mobileOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 top-0 z-50 w-72 lg:hidden shadow-2xl shadow-slate-900/20"
      >
        {sidebarContent}
      </motion.div>

      {/* Desktop Sidebar */}
      <div className="hidden h-screen w-72 lg:block">
        {sidebarContent}
      </div>
    </>
  );
}
