const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `    case 'logs':
    case 'login':
        return <LoginPage onLoginSuccess={() => setCurrentPage('dashboard')} />;
      case 'settings':`,
  `    case 'logs':
    case 'settings':`
);

if (!code.includes("case 'login':\n        return <LoginPage")) {
  code = code.replace(
    `      case 'dashboard':
        return (
          <Dashboard`,
    `      case 'login':
        return <LoginPage onLoginSuccess={() => setCurrentPage('dashboard')} />;
      case 'dashboard':
        return (
          <Dashboard`
  );
}

fs.writeFileSync('src/App.tsx', code, 'utf8');
