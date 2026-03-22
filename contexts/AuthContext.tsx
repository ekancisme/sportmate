import Constants from 'expo-constants';
import React, { createContext, ReactNode, useContext, useState } from 'react';

type Role = 'user' | 'admin';

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
  name?: string;
  age?: number;
  location?: string;
  bio?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  stats?: {
    matchesPlayed?: number;
    winRate?: number;
    hoursActive?: number;
    followers?: number;
  };
  sports?: { name: string; level: string }[];
  schedule?: { day: string; time?: string; activity: string }[];
};

type AuthContextValue = {
  user: AuthUser | null;
  role: Role;
  isAuthenticated: boolean;
  loading: boolean;
  login: (options: {
    identifier: string; // username hoặc email
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  register: (options: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Gửi mã đặt lại mật khẩu tới email */
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  /** Đặt lại mật khẩu bằng mã 6 số */
  resetPassword: (options: {
    email: string;
    code: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setUserFromServer: (user: AuthUser) => void;
};

function getApiBaseUrl() {
  // Ưu tiên EXPO_PUBLIC_API_URL nếu có
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;

  // Lấy host từ cấu hình Expo (phù hợp khi chạy trên thiết bị thật / Expo Go)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    // fallback cho một số phiên bản Expo cũ
    // @ts-expect-error manifest có thể không tồn tại trong type mới
    Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  // Fallback cuối cùng cho trường hợp chạy web trên chính máy dev
  return 'http://localhost:3000';
}

const API_BASE_URL = getApiBaseUrl();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const setUserFromServer = (u: AuthUser) => {
    setUser(u);
  };

  const login: AuthContextValue['login'] = async ({ identifier, password }) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || 'Đăng nhập thất bại' };
      }
      setUser(data);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'Không thể kết nối máy chủ' };
    } finally {
      setLoading(false);
    }
  };

  const register: AuthContextValue['register'] = async ({ fullName, email, phone, password }) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || 'Đăng ký thất bại' };
      }
      setUser(data);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'Không thể kết nối máy chủ' };
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset: AuthContextValue['requestPasswordReset'] = async (email) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const base = (data?.error as string) || 'Không thể gửi mã';
        const detail = data?.detail ? `\n${String(data.detail)}` : '';
        return { ok: false, error: base + detail };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối máy chủ' };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword: AuthContextValue['resetPassword'] = async ({ email, code, newPassword }) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || 'Đặt lại mật khẩu thất bại' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối máy chủ' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    role: (user?.role as Role) || 'user',
    isAuthenticated: !!user,
    loading,
    login,
    register,
    requestPasswordReset,
    resetPassword,
    logout,
    setUserFromServer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

