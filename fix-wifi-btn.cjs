const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

code = code.replace(
  "disabled={wifiStatus === 'sending' || controlLoading}",
  "disabled={wifiStatus === 'sending' || controlLoading || !isAdmin}"
);

fs.writeFileSync('src/pages/SettingsPage.tsx', code, 'utf8');
