import { User } from './index';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export interface AuthError {
  message: string;
  code?: string;
}
