const fs = require('fs');

// 1. Update Sidebar.tsx to include PageId 'login' and a Login button if not logged in
let sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  /export type PageId =\s*([\s\S]*?);/,
  `export type PageId =
  | 'dashboard'
  | 'monitoring'
  | 'chat'
  | 'control'
  | 'weather'
  | 'logs'
  | 'settings'
  | 'about'
  | 'login';`
);

if (sidebar.includes('{currentUser?.username?.charAt(0)')) {
  const profileSection = `        <div className="flex items-center justify-between px-2">
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
        </div>`;
  sidebar = sidebar.replace(/<div className="flex items-center justify-between px-2">[\s\S]*?<\/button>\s*<\/div>/, profileSection);
}
fs.writeFileSync('src/components/Sidebar.tsx', sidebar, 'utf8');

// 2. Update App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace('if (!currentUser) return <LoginPage />;', '');
if (!app.includes("case 'login':")) {
  app = app.replace("case 'settings':", "case 'login':\n        return <LoginPage />;\n      case 'settings':");
}
// Remove login from resolvePageFromPath or handle it
if (!app.includes("case 'login': return 'login';")) {
  app = app.replace("case 'dashboard':", "case 'login': return 'login';\n    case 'dashboard':");
}
fs.writeFileSync('src/App.tsx', app, 'utf8');

// 3. Update LoginPage.tsx so after login it goes to dashboard, or use effect
let login = fs.readFileSync('src/pages/LoginPage.tsx', 'utf8');
if (!login.includes('window.location.href')) {
  login = login.replace(
    'setCurrentUser(safeUser);',
    'setCurrentUser(safeUser);\n      window.location.href = "/";'
  );
}
fs.writeFileSync('src/pages/LoginPage.tsx', login, 'utf8');

