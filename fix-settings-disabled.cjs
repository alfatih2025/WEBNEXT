const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

code = code.replace(
  '<form onSubmit={handleSubmit} className="space-y-8">',
  '<form onSubmit={handleSubmit} className={`space-y-8 ${!isAdmin ? "pointer-events-none opacity-80" : ""}`}>'
);

code = code.replace(
  '<form onSubmit={handleWifiSubmit} className="space-y-4">',
  '<form onSubmit={handleWifiSubmit} className={`space-y-4 ${!isAdmin ? "pointer-events-none opacity-80" : ""}`}>'
);

// We need to also hide the "Save" buttons if not admin, or just let them be disabled by the pointer-events-none.
// Adding a clear banner at the top of settings for non-admins is very helpful.
if (!code.includes('Anda login sebagai pengguna')) {
  code = code.replace(
    '<div className="max-w-5xl mx-auto space-y-6">',
    `<div className="max-w-5xl mx-auto space-y-6">
      {!isAdmin && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-3 text-blue-700 dark:text-blue-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Anda login sebagai pengguna biasa (Hanya-Lihat). Hubungi Administrator untuk mengubah pengaturan.</p>
        </div>
      )}`
  );
}

// Ensure AlertCircle is imported
if (!code.includes('AlertCircle')) {
  code = code.replace(
    "import { UserPlus, Trash2, Users } from 'lucide-react';",
    "import { UserPlus, Trash2, Users, AlertCircle } from 'lucide-react';"
  );
}

fs.writeFileSync('src/pages/SettingsPage.tsx', code, 'utf8');
