import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API_BASE_URL } from './apiClient';

export type AppRole = 'student' | 'professor' | 'staff' | 'security_guard' | 'admin' | 'superadmin';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => void;
};

const storageKey = 'qcu-lost-and-found-token';
const AuthContext = createContext<AuthContextValue | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (body: unknown, fallback: string): string => {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }
  return fallback;
};

const saveSession = (value: unknown): AuthResponse => {
  const allowedRoles: AppRole[] = ['student', 'professor', 'staff', 'security_guard', 'admin', 'superadmin'];
  if (
    !isRecord(value) ||
    typeof value.token !== 'string' ||
    !isRecord(value.user)
  ) {
    throw new Error('The server returned an invalid sign-in response.');
  }
  const { user } = value;
  if (
    typeof user.id !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.fullName !== 'string' ||
    typeof user.role !== 'string' ||
    !allowedRoles.includes(user.role as AppRole)
  ) {
    throw new Error('The server returned an invalid sign-in response.');
  }
  const response: AuthResponse = {
    token: value.token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as AppRole,
    },
  };
  window.localStorage.setItem(storageKey, response.token);
  return response;
};

const postAuth = async (path: string, data: Record<string, string>): Promise<AuthResponse> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error('Could not connect to the server. Check that the backend is running.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorMessage(body, 'Sign-in failed. Please try again.'));
  }
  return saveSession(body as AuthResponse);
};

const authGet = async (path: string, token: string): Promise<Response> => {
  return fetch(`${API_BASE_URL}/auth/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem(storageKey);
    if (!token) {
      setIsLoading(false);
      return;
    }

    let active = true;
    authGet('me', token)
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          window.localStorage.removeItem(storageKey);
          setUser(null);
          return;
        }
        const currentUser = await response.json() as AuthUser;
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    signIn: async (email, password) => {
      const session = await postAuth('login', { email, password });
      setUser(session.user);
    },
    signUp: async (fullName, email, password) => {
      const session = await postAuth('register', { fullName, email, password });
      setUser(session.user);
    },
    signInWithGoogle: async (credential) => {
      const session = await postAuth('google', { credential });
      setUser(session.user);
    },
    signOut: () => {
      window.localStorage.removeItem(storageKey);
      setUser(null);
    },
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
};
