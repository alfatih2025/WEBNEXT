import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
  password?: string; // Storing password purely for demo/sandbox purposes
}

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (username: string, password: string, role?: Role) => boolean;
  removeUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_USERS: User[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' }
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedUsers = localStorage.getItem('nexagrow_users');
    if (storedUsers) {
      try {
        setUsers(JSON.parse(storedUsers));
      } catch (e) {
        setUsers(DEFAULT_USERS);
      }
    } else {
      setUsers(DEFAULT_USERS);
      localStorage.setItem('nexagrow_users', JSON.stringify(DEFAULT_USERS));
    }

    const storedCurrent = localStorage.getItem('nexagrow_current_user');
    if (storedCurrent) {
      try {
        setCurrentUser(JSON.parse(storedCurrent));
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  const login = (username: string, password: string) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      const safeUser = { id: user.id, username: user.username, role: user.role };
      setCurrentUser(safeUser);
      localStorage.setItem('nexagrow_current_user', JSON.stringify(safeUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('nexagrow_current_user');
  };

  const addUser = (username: string, password: string, role: Role = 'user') => {
    if (users.find(u => u.username === username)) return false;
    const newUsers = [...users, { id: Date.now().toString(), username, password, role }];
    setUsers(newUsers);
    localStorage.setItem('nexagrow_users', JSON.stringify(newUsers));
    return true;
  };

  const removeUser = (id: string) => {
    if (id === '1') return; // Cannot remove default admin
    const newUsers = users.filter(u => u.id !== id);
    setUsers(newUsers);
    localStorage.setItem('nexagrow_users', JSON.stringify(newUsers));
  };

  if (!isLoaded) return null;

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, removeUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
