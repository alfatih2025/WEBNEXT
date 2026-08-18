const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

// The duplicate attribute warning is harmless but annoying. Let's fix it.
code = code.replaceAll('disabled={!isAdmin} disabled={!isAdmin}', 'disabled={!isAdmin}');

fs.writeFileSync('src/pages/SettingsPage.tsx', code, 'utf8');
