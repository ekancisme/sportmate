import { getApiBaseUrl } from "@/lib/apiBase";

export type ApiUser = {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  location?: string;
  bio?: string;
  winRate: number;
  matchesPlayed: number;
  sport?: string;
  level?: string;
};

function resolveAvatarUrl(avatar: string | undefined): string | undefined {
  if (!avatar?.trim()) return undefined;
  if (avatar.startsWith("http")) return avatar;
  const base = getApiBaseUrl();
  return `${base}${avatar.startsWith("/") ? avatar : `/${avatar}`}`;
}

export async function fetchSuggestedPartners(options?: {
  excludeUserId?: string;
  limit?: number;
}): Promise<ApiUser[]> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options?.excludeUserId) {
    params.set("exclude", options.excludeUserId);
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${base}/api/users${query}`);
  if (!res.ok) throw new Error("Không tải được danh sách partner");
  const data = await res.json();
  return data.map((u: ApiUser & { avatar?: string }) => ({
    ...u,
    avatar: resolveAvatarUrl(u.avatar),
  }));
}

export async function fetchUserById(id: string): Promise<ApiUser> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/users/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error("Không tìm thấy người dùng");
  if (!res.ok) throw new Error("Không tải được thông tin người dùng");
  const data = await res.json();
  return {
    ...data,
    avatar: resolveAvatarUrl(data.avatar),
  };
}
