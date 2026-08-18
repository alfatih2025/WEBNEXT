const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

if (!code.includes('useAuth')) {
  code = code.replace(
    "import { useSettings, Settings as SettingsType } from '../hooks/useSettings';",
    "import { useSettings, Settings as SettingsType } from '../hooks/useSettings';\nimport { useAuth } from '../hooks/useAuth';\nimport { UserPlus, Trash2, Users } from 'lucide-react';"
  );
}

if (!code.includes('currentUser')) {
  code = code.replace(
    'export function SettingsPage() {\n  const { settings',
    'export function SettingsPage() {\n  const { currentUser, users, addUser, removeUser } = useAuth();\n  const isAdmin = currentUser?.role === "admin";\n\n  const [newUsername, setNewUsername] = useState("");\n  const [newPassword, setNewPassword] = useState("");\n  const [addUserError, setAddUserError] = useState("");\n\n  const handleAddUser = (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!newUsername || !newPassword) { setAddUserError("Isi semua field"); return; }\n    const ok = addUser(newUsername, newPassword, "user");\n    if (ok) { setNewUsername(""); setNewPassword(""); setAddUserError(""); } else { setAddUserError("Username sudah ada"); }\n  };\n\n  const { settings'
  );
}

if (!code.includes('if (!isAdmin) return;')) {
  code = code.replace(
    '  const handleSubmit = async (e: React.FormEvent) => {',
    '  const handleSubmit = async (e: React.FormEvent) => {\n    if (!isAdmin) return;'
  );
}

// Add User Management UI at the end
if (!code.includes('Manajemen Pengguna')) {
  code = code.replace(
    '      </form>\n    </div>',
    `      </form>

      {isAdmin && (
        <div className="glass-card p-6 md:p-8 mt-8 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-xl">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manajemen Pengguna</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Undang dan kelola akses pengguna lain.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <form onSubmit={handleAddUser} className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Tambah Pengguna</h3>
                {addUserError && <p className="text-red-500 text-xs font-semibold">{addUserError}</p>}
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Username</label>
                  <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="nama_user" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="••••••••" />
                </div>
                <button type="submit" className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                  <UserPlus size={16} /> Undang Pengguna
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Daftar Pengguna</h3>
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">{user.username}</div>
                      <div className="text-xs text-slate-500">{user.role === 'admin' ? 'Administrator' : 'Pengguna Biasa'}</div>
                    </div>
                  </div>
                  {user.role !== 'admin' && (
                    <button onClick={() => removeUser(user.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>`
  );
}

fs.writeFileSync('src/pages/SettingsPage.tsx', code, 'utf8');
