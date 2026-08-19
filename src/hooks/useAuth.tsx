import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
  email: string;
}

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (email: string, role?: Role) => Promise<boolean>;
  removeUser: (id: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch role from firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCurrentUser({
            id: firebaseUser.uid,
            username: data.email?.split('@')[0] || 'User',
            email: data.email,
            role: data.role as Role
          });
        } else {
          // If no user doc, default to admin if first user, else user
          const isFirstUser = firebaseUser.email === 'alfatihwibowo264@gmail.com'; // Admin
          const role: Role = isFirstUser ? 'admin' : 'user';
          
          const newUser = {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setCurrentUser(newUser);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Login dibatalkan. Silakan coba lagi.');
      }
      throw new Error('Gagal login dengan Google.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const addUser = async (email: string, role: Role = 'user') => {
    // In a real app, this would invite via backend. 
    // Here we can just create a record if needed, but Firebase Auth handles signups.
    return true;
  };

  const removeUser = async (id: string) => {
    // Delete from Firestore
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, removeUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
