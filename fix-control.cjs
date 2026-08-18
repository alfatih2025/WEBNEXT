const fs = require('fs');
let code = fs.readFileSync('src/components/ControlPanel.tsx', 'utf8');

if (!code.includes('useAuth')) {
  code = code.replace(
    "import { SensorData } from '../hooks/useSensorData';",
    "import { SensorData } from '../hooks/useSensorData';\nimport { useAuth } from '../hooks/useAuth';\nimport { AlertCircle } from 'lucide-react';"
  );
  
  code = code.replace(
    'export function ControlPanel({ sensorData }: ControlPanelProps) {',
    'export function ControlPanel({ sensorData }: ControlPanelProps) {\n  const { currentUser } = useAuth();\n  const isAdmin = currentUser?.role === "admin";'
  );

  code = code.replace(
    '  return (\n    <div className="grid',
    `  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Hanya Admin yang dapat mengontrol perangkat secara manual.</p>
        </div>
      )}
      <div className={\`grid \${!isAdmin ? 'opacity-60 pointer-events-none' : ''}\``
  );
}
fs.writeFileSync('src/components/ControlPanel.tsx', code, 'utf8');
