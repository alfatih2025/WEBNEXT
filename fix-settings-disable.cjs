const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

// Find the start of the grid
if (code.includes('      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">')) {
  code = code.replace(
    '      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">',
    '      <div className={`grid grid-cols-1 gap-8 lg:grid-cols-2 ${!isAdmin ? "pointer-events-none opacity-70" : ""}`}>'
  );
} else {
  // alternative
  code = code.replace(
    '<div className="space-y-6 max-w-5xl mx-auto">',
    '<div className="space-y-6 max-w-5xl mx-auto">\n      {!isAdmin && (\n        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-700">\n          <AlertCircle className="w-5 h-5" />\n          <p className="text-sm">Hanya Admin yang dapat mengubah pengaturan.</p>\n        </div>\n      )}\n      <div className={!isAdmin ? "pointer-events-none opacity-70" : ""}>'
  );
  // Need to find a place to close the div...
}

// Let's just find `export function SettingsPage() {` and replace `!isAdmin` stuff to make inputs disabled.
code = code.replace(/<input\s/g, '<input disabled={!isAdmin} ');
code = code.replace(/<select\s/g, '<select disabled={!isAdmin} ');
code = code.replace(/<button onClick={handleSave}/g, '<button onClick={handleSave} disabled={!isAdmin} className={`rounded-xl px-6 py-3 font-semibold shadow-sm ${!isAdmin ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}');
// remove the old classes from button onClick={handleSave}
code = code.replace(/className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white shadow-sm"/g, '');

fs.writeFileSync('src/pages/SettingsPage.tsx', code, 'utf8');
