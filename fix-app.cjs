const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  'function App() {',
  'function App() {\n  const { currentUser } = useAuth();'
);
code = code.replace(
  'if (sensorLoading && !sensorData) {',
  'if (!currentUser) return <LoginPage />;\n\n  if (sensorLoading && !sensorData) {'
);
fs.writeFileSync('src/App.tsx', code, 'utf8');
