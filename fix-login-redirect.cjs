const fs = require('fs');
let code = fs.readFileSync('src/pages/LoginPage.tsx', 'utf8');

if (!code.includes('onLoginSuccess')) {
  code = code.replace(
    'export function LoginPage() {',
    'export function LoginPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {'
  );
  code = code.replace(
    'const success = login(username, password);',
    'const success = login(username, password);\n    if (success && onLoginSuccess) onLoginSuccess();'
  );
}
fs.writeFileSync('src/pages/LoginPage.tsx', code, 'utf8');

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  "return <LoginPage />;",
  "return <LoginPage onLoginSuccess={() => setCurrentPage('dashboard')} />;"
);
fs.writeFileSync('src/App.tsx', app, 'utf8');
