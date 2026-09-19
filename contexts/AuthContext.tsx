import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const SESSION_KEY = 'sportmate_session';
/** Bản sao trên Keychain/Keystore (Expo Go iOS/Android ổn định hơn chỉ AsyncStorage) */
const SECURE_SESSION_KEY = 'sportmate_session_secure';

function utf8ByteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length;
  }
  return s.length;
}

/** Đọc chuỗi phiên: ưu tiên SecureStore (native), sau đó AsyncStorage + migrate */
async function readSessionJson(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(SESSION_KEY);
  }
  try {
    const fromSecure = await SecureStore.getItemAsync(SECURE_SESSION_KEY);
    if (fromSecure) return fromSecure;
    const fromAsync = await AsyncStorage.getItem(SESSION_KEY);
    if (fromAsync && utf8ByteLength(fromAsync) <= 2040) {
      try {
        await SecureStore.setItemAsync(SECURE_SESSION_KEY, fromAsync);
      } catch {
        // bỏ qua giới hạn 2048 byte trên iOS
      }
    }
    return fromAsync;
  } catch {
    return AsyncStorage.getItem(SESSION_KEY);
  }
}

/** Ghi phiên: luôn AsyncStorage + mirror SecureStore nếu đủ nhỏ (giới hạn iOS ~2048 byte) */
async function writeSessionJson(json: string) {
  await AsyncStorage.setItem(SESSION_KEY, json);
  if (Platform.OS === 'web') return;
  try {
    if (utf8ByteLength(json) <= 2040) {
      await SecureStore.setItemAsync(SECURE_SESSION_KEY, json);
    }
  } catch {
    // chỉ giữ AsyncStorage
  }
}

async function clearSessionJson() {
  await AsyncStorage.removeItem(SESSION_KEY);
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(SECURE_SESSION_KEY);
  } catch {
    // ignore
  }
}

import { resolveAvatarUrl } from "@/lib/userApi";

type Role = "user" | "owner" | "admin";

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
  schedule?: {
    day: string;
    time?: string;
    activity: string;
    matchId?: string;
  }[];
  favorites?: string[];
};

export type SuggestedPartner = {
  id: string;
  name: string;
  sport: string;
  level: string;
  distance: string | null;
  winRate: number;
  bio?: string;
  age?: number;
  location?: string;
  avatar?: string;
  /** Location có rõ ràng không (tên thành phố/quận vs địa chỉ cụ thể) */
  isLocationClear?: boolean;
};

/** Chuẩn hoá user lưu/đọc từ storage (id có thể là id hoặc _id) */
function normalizeSessionUser(raw: unknown): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const idVal = o.id ?? o._id;
  if (idVal == null || String(idVal).trim() === '') return null;
  return { ...(o as object), id: String(idVal) } as AuthUser;
}

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
    /** Mặc định lưu phiên sau khi đăng ký thành công */
    persistSession?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Gửi mã đặt lại mật khẩu tới email */
  requestPasswordReset: (
    email: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Đặt lại mật khẩu bằng mã 6 số */
  resetPassword: (options: {
    email: string;
    code: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setUserFromServer: (user: AuthUser) => void;
  /** Đã đọc xong phiên từ storage (tránh flash màn login khi đang restore) */
  authReady: boolean;
  /** Fetch lại dữ liệu user từ server và cập nhật AuthContext */
  refreshUser: () => Promise<void>;
  /** Lấy danh sách partner gợi ý theo location */
  fetchSuggestedPartners: (options?: {
    maxDistance?: number;
    limit?: number;
    latitude?: number;
    longitude?: number;
    userLocation?: string;
  }) => Promise<{
    partners: SuggestedPartner[];
    total: number;
    userLocation: string | null;
  }>;
};

function getApiBaseUrl() {
  // Ưu tiên EXPO_PUBLIC_API_URL nếu có
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;

  // Lấy host từ cấu hình Expo (phù hợp khi chạy trên thiết bị thật / Expo Go)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    // fallback cho một số phiên bản Expo cũ
    (Constants as { manifest?: { hostUri?: string } }).manifest?.hostUri;
  // @ts-ignore manifest có thể không tồn tại trong type mới
  Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:3000`;
  }

  // Fallback cuối cùng cho trường hợp chạy web trên chính máy dev
  return "http://localhost:3000";
}

const API_BASE_URL = getApiBaseUrl();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistUserSession(u: AuthUser | null) {
  try {
    if (u) {
      const normalized = normalizeSessionUser(u);
      if (!normalized) {
        if (__DEV__) {
          console.warn('[Auth] Không lưu phiên: thiếu id hợp lệ');
        }
        return;
      }
      const payload = JSON.stringify(normalized);
      await writeSessionJson(payload);
    } else {
      await clearSessionJson();
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[Auth] Lưu phiên thất bại:', e);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  /** Khôi phục phiên đã lưu — không dùng `cancelled` skip setAuthReady (React Strict Mode dev hay làm authReady không bao giờ true) */
  useEffect(() => {
    (async () => {
      try {
        const raw = await readSessionJson();
        if (raw) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }
          const userFromStore = normalizeSessionUser(parsed);
          if (userFromStore) {
            setUser(userFromStore);
          } else if (__DEV__ && raw) {
            console.warn('[Auth] Phiên trong storage không hợp lệ (thiếu id), đã bỏ qua');
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[Auth] Đọc phiên thất bại:', e);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const setUserFromServer = (u: AuthUser) => {
    setUser(u);
    void (async () => {
      try {
        const raw = await readSessionJson();
        if (raw) {
          await persistUserSession(u);
        }
      } catch {
        // ignore
      }
    })();
  };

  const login: AuthContextValue["login"] = async ({ identifier, password }) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || "Đăng nhập thất bại" };
      }
      const authUser = normalizeSessionUser(data) ?? (data as AuthUser);
      setUser(authUser);
      // Luôn lưu phiên: reload Expo / mở lại app vẫn đăng nhập. "Remember me" trên UI chỉ lưu email/mật khẩu.
      await persistUserSession(authUser);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: "Không thể kết nối máy chủ" };
    } finally {
      setLoading(false);
    }
  };

  const register: AuthContextValue['register'] = async ({
    fullName,
    email,
    phone,
    password,
    persistSession = true,
  }) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || "Đăng ký thất bại" };
      }
      const regUser = normalizeSessionUser(data) ?? (data as AuthUser);
      setUser(regUser);
      if (persistSession) {
        await persistUserSession(regUser);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: "Không thể kết nối máy chủ" };
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset: AuthContextValue["requestPasswordReset"] = async (
    email,
  ) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const base = (data?.error as string) || "Không thể gửi mã";
        const detail = data?.detail ? `\n${String(data.detail)}` : "";
        return { ok: false, error: base + detail };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Không thể kết nối máy chủ" };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword: AuthContextValue["resetPassword"] = async ({
    email,
    code,
    newPassword,
  }) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || "Đặt lại mật khẩu thất bại" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Không thể kết nối máy chủ" };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    void persistUserSession(null);
    void AsyncStorage.removeItem('sportmate_login').catch(() => {});
  };

  const refreshUser: AuthContextValue["refreshUser"] = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/users/${encodeURIComponent(user.id)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      // Giữ nguyên id và role từ authUser hiện tại
      setUser((prev) =>
        prev ? { ...prev, ...data, id: prev.id, role: prev.role } : prev,
      );
    } catch (e) {
      console.warn("⚠️ refreshUser failed:", e);
    }
  };

  const fetchSuggestedPartners: AuthContextValue["fetchSuggestedPartners"] =
    async ({
      maxDistance = 10,
      limit = 20,
      latitude,
      longitude,
      userLocation,
    } = {}) => {
      try {
        const params = new URLSearchParams({
          limit: String(limit),
        });

        if (user?.id) {
          params.append("userId", user.id);
        }

        // Truyền tọa độ GPS nếu có
        if (latitude != null && longitude != null) {
          params.append("lat", String(latitude));
          params.append("lng", String(longitude));
        }

        // Truyền location string nếu có (từ GPS)
        if (userLocation) {
          params.append("currentLocation", userLocation);
        }

        const res = await fetch(
          `${API_BASE_URL}/api/partners/suggested?${params}`,
        );
        const data = await res.json();

        if (!res.ok) {
          console.error("Fetch partners error:", data?.error);
          return { partners: [], total: 0, userLocation: null };
        }

        const raw = data.partners || [];
        const partners = raw.map((p: SuggestedPartner) => ({
          ...p,
          avatar: resolveAvatarUrl(p.avatar),
        }));

        return {
          partners,
          total: data.total || 0,
          userLocation: data.userLocation,
        };
      } catch (error) {
        console.error("Failed to fetch suggested partners:", error);
        return { partners: [], total: 0, userLocation: null };
      }
    };

  const value: AuthContextValue = {
    user,
    role: (user?.role as Role) || "user",
    isAuthenticated: !!user,
    loading,
    login,
    register,
    requestPasswordReset,
    resetPassword,
    logout,
    setUserFromServer,
    authReady,
    refreshUser,
    fetchSuggestedPartners,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
