const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

if (!code.includes('useAuth')) {
  code = code.replace(
    "import { Settings as SettingsType } from '../hooks/useSettings';",
    "import { Settings as SettingsType } from '../hooks/useSettings';\nimport { useAuth } from '../hooks/useAuth';\nimport { UserPlus, Trash2, Users } from 'lucide-react';"
  );
}

code = code.replace(
  'export function SettingsPage() {\n  const { settings',
  'export function SettingsPage() {\n  const { currentUser, users, addUser, removeUser } = useAuth();\n  const isAdmin = currentUser?.role === "admin";\n\n  const [newUsername, setNewUsername] = useState("");\n  const [newPassword, setNewPassword] = useState("");\n  const [addUserError, setAddUserError] = useState("");\n\n  const handleAddUser = (e) => {\n    e.preventDefault();\n    if (!newUsername || !newPassword) { setAddUserError("Isi semua field"); return; }\n    const ok = addUser(newUsername, newPassword, "user");\n    if (ok) { setNewUsername(""); setNewPassword(""); setAddUserError(""); } else { setAddUserError("Username sudah ada"); }\n  };\n\n  const { settings'
);

code = code.replace(
  '  const handleSubmit = async (e: React.FormEvent) => {',
  '  const handleSubmit = async (e: React.FormEvent) => {\n    if (!isAdmin) return;'
);

code = code.replace(
  '              <Save className="w-5 h-5" />',
  '              <Save className="w-5 h-5" />'
);

// We need to disable inputs if not admin
code = code.replaceAll('<input', '<input disabled={!isAdmin}');
code = code.replaceAll('<select', '<select disabled={!isAdmin}');

fs.writeFileSync('src/pages/SettingsPage.tsx', code, 'utf8');
