export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
}

export interface AuthState {
  currentUser: User | null;
  users: User[];
}
