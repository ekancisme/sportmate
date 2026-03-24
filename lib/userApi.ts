import { getApiBaseUrl } from '@/lib/apiBase';

export type ApiUser = {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  location?: string;
  bio?: string;
  winRate: number;
  matchesPlayed: number;
  matchesWon?: number;
  hoursActive?: number;
  followers?: number;
  sport?: string;
  level?: string;
  sports?: { name: string; level: string }[];
  schedule?: { day: string; time?: string; activity: string; matchId?: string }[];
  favoritesCount?: number;     // số người đã yêu thích
  isFavoritedByMe?: boolean;   // viewer hiện tại đã yêu thích chưa
};

/** Chuẩn hóa avatar từ API (path tương đối → URL đầy đủ cho Image) */
export function resolveAvatarUrl(avatar: string | undefined): string | undefined {
  if (!avatar?.trim()) return undefined;
  if (avatar.startsWith('http')) return avatar;
  const base = getApiBaseUrl();
  return `${base}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
}

export async function fetchSuggestedPartners(
  options?: { excludeUserId?: string; limit?: number },
): Promise<ApiUser[]> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options?.excludeUserId) {
    params.set('exclude', options.excludeUserId);
  }
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${base}/api/users${query}`);
  if (!res.ok) throw new Error('Không tải được danh sách partner');
  const data = await res.json();
  return data.map((u: ApiUser & { avatar?: string }) => ({
    ...u,
    avatar: resolveAvatarUrl(u.avatar),
  }));
}

export async function fetchUserById(
  id: string,
  options?: { viewerId?: string },
): Promise<ApiUser> {
  const base = getApiBaseUrl();
  const params = options?.viewerId
    ? `?viewerId=${encodeURIComponent(options.viewerId)}`
    : '';
  const res = await fetch(`${base}/api/users/${encodeURIComponent(id)}${params}`);
  if (res.status === 404) throw new Error('Không tìm thấy người dùng');
  if (!res.ok) throw new Error('Không tải được thông tin người dùng');
  const data = await res.json();
  return {
    ...data,
    avatar: resolveAvatarUrl(data.avatar),
    // flatten stats sub-object to root for convenience
    winRate:        data.stats?.winRate        ?? data.winRate        ?? 0,
    matchesPlayed:  data.stats?.matchesPlayed  ?? data.matchesPlayed  ?? 0,
    matchesWon:     data.stats?.matchesWon     ?? data.matchesWon     ?? 0,
    hoursActive:    data.stats?.hoursActive    ?? data.hoursActive    ?? 0,
    followers:      data.stats?.followers      ?? data.followers      ?? 0,
    favoritesCount: data.favorites?.length     ?? 0,
    isFavoritedByMe: options?.viewerId
      ? (data.favorites ?? []).map(String).includes(String(options.viewerId))
      : false,
  };
}

/**
 * Toggle yêu thích: thêm hoặc xóa fromUserId khỏi mảng favorites của user `targetId`.
 * Trả về { favorited: boolean, favoritesCount: number }
 */
export async function toggleFavorite(
  targetId: string,
  fromUserId: string,
): Promise<{ favorited: boolean; favoritesCount: number }> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/api/users/${encodeURIComponent(targetId)}/favorite`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId }),
    },
  );
  if (!res.ok) throw new Error('Thao tác yêu thích thất bại');
  return res.json();
}
