const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

if (!code.includes('useAuth')) {
  code = code.replace(
    "import { motion, AnimatePresence } from 'framer-motion';",
    "import { motion, AnimatePresence } from 'framer-motion';\nimport { useAuth } from '../hooks/useAuth';\nimport { LogOut } from 'lucide-react';"
  );
}

code = code.replace(
  'export function Sidebar({ currentPage, onPageChange }: SidebarProps) {',
  'export function Sidebar({ currentPage, onPageChange }: SidebarProps) {\n  const { logout, currentUser } = useAuth();'
);

code = code.replace(
  '      <div className="border-t border-slate-200/50 dark:border-slate-800/50 p-6 text-center">',
  `      <div className="border-t border-slate-200/50 dark:border-slate-800/50 p-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
              {currentUser?.username?.charAt(0) || 'U'}
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">
              {currentUser?.username}
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
            title="Keluar"
          >
            <LogOut size={18} />
          </button>
        </div>
        <p className="text-[10px] font-bold tracking-wider text-slate-600 dark:text-slate-500 uppercase text-center">`
);
fs.writeFileSync('src/components/Sidebar.tsx', code, 'utf8');
