import { getApiBaseUrl } from '@/lib/apiBase';

export type ApiMatchHost = {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  matchesPlayed?: number;
  winRate?: number;
};

export type ApiMatch = {
  id: string;
  /** Host tạo trận (MongoDB id) */
  hostId?: string;
  sport: string;
  title: string;
  location: string;
  date: string;
  time: string;
  maxPlayers: number;
  minSkillLevel: string;
  description: string;
  rules: string;
  currentPlayers?: number;
  host?: ApiMatchHost | null;
  /** Có khi GET /api/matches/:id?userId=... hoặc sau join/leave */
  viewerJoined?: boolean;
};

export type MatchDetail = {
  id: string;
  title: string;
  sport: string;
  sportLabelVi: string;
  venueName: string;
  venueCity: string;
  location: string;
  date: string;
  time: string;
  timeRange: string;
  currentPlayers: number;
  maxPlayers: number;
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  skillLevelVi: string;
  priceLabel: string;
  description: string;
  requirements: string[];
  rules: string[];
  organizer: {
    name: string;
    rating: number;
    matchesPlayed: number;
    avatarUrl?: string;
  };
  participants: {
    id: string;
    name: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    avatarUrl?: string;
  }[];
  mapUrl: string;
  /** Bạn đã tham gia trận (theo server) */
  viewerJoined?: boolean;
  hostId?: string;
};

export function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} Tháng ${m}`;
}

function parseLocation(location: string): { venueName: string; venueCity: string } {
  const trimmed = location.trim();
  const idx = trimmed.indexOf(',');
  if (idx === -1) return { venueName: trimmed, venueCity: '' };
  return {
    venueName: trimmed.slice(0, idx).trim(),
    venueCity: trimmed.slice(idx + 1).trim(),
  };
}

function rulesToLines(rules: string): string[] {
  return rules.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function requirementsFromDescription(desc: string): string[] {
  return desc
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-•*]\s/.test(l) || /^\d+\.\s/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, ''));
}

function mapMinSkillToLevel(s: string): 'Beginner' | 'Intermediate' | 'Advanced' {
  const x = s.toLowerCase();
  if (x.includes('cao') || x.includes('chuyên')) return 'Advanced';
  if (x.includes('trung')) return 'Intermediate';
  if (x.includes('sơ')) return 'Beginner';
  return 'Intermediate';
}

function minSkillDisplay(s: string): string {
  const t = s.trim();
  if (!t || t === 'Tất Cả') return 'Tất Cả';
  return t;
}

function hostRating(host: ApiMatchHost | null | undefined): number {
  if (!host || host.winRate == null) return 4.5;
  const w = Math.max(0, Math.min(100, host.winRate));
  return Math.round((3.5 + (w / 100) * 1.5) * 10) / 10;
}

function timeRangeFrom(time: string): string {
  const t = String(time || '').trim();
  if (!t) return '—';
  return t;
}

function mapUrlFor(location: string): string {
  const q = encodeURIComponent(location.trim());
  return `https://maps.google.com/maps?q=${q}&output=embed`;
}

function resolveAvatarUrl(avatar: string | undefined): string | undefined {
  if (!avatar?.trim()) return undefined;
  if (avatar.startsWith('http')) return avatar;
  const base = getApiBaseUrl();
  return `${base}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
}

export function mapApiMatchToDetail(raw: ApiMatch): MatchDetail {
  const { venueName, venueCity } = parseLocation(raw.location);
  const host = raw.host ?? null;
  const rulesLines = rulesToLines(raw.rules);
  const reqLines = requirementsFromDescription(raw.description);
  const level = mapMinSkillToLevel(raw.minSkillLevel);

  return {
    id: raw.id,
    title: raw.title,
    sport: raw.sport,
    sportLabelVi: raw.sport,
    venueName,
    venueCity,
    location: raw.location,
    date: raw.date,
    time: raw.time,
    timeRange: timeRangeFrom(raw.time),
    currentPlayers: Number(raw.currentPlayers ?? 0),
    maxPlayers: raw.maxPlayers,
    skillLevel: level,
    skillLevelVi: minSkillDisplay(raw.minSkillLevel),
    priceLabel: 'Miễn phí',
    description: raw.description?.trim() || 'Chưa có mô tả.',
    requirements: reqLines,
    rules:
      rulesLines.length > 0
        ? rulesLines
        : ['Tuân thủ luật chơi và hướng dẫn của người tổ chức.'],
    organizer: {
      name: host?.name || host?.username || 'Người tổ chức',
      rating: hostRating(host),
      matchesPlayed: host?.matchesPlayed ?? 0,
      avatarUrl: resolveAvatarUrl(host?.avatar),
    },
    participants: [],
    mapUrl: mapUrlFor(raw.location),
    viewerJoined: Boolean(raw.viewerJoined),
    hostId: raw.hostId,
  };
}

export async function fetchMatches(): Promise<ApiMatch[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/matches`);
  if (!res.ok) throw new Error('Không tải được danh sách trận');
  return res.json();
}

export async function fetchMyMatches(hostId: string): Promise<ApiMatch[]> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/api/matches/mine?hostId=${encodeURIComponent(hostId)}`,
  );
  if (!res.ok) throw new Error('Không tải được trận của bạn');
  return res.json();
}

export type UpdateMatchPayload = {
  sport: string;
  title: string;
  location: string;
  date: string;
  time: string;
  maxPlayers: number;
  minSkillLevel: string;
  description: string;
  rules: string;
};

export async function updateMatch(
  matchId: string,
  hostId: string,
  payload: UpdateMatchPayload,
): Promise<ApiMatch> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/matches/${encodeURIComponent(matchId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Không cập nhật được trận',
    );
  }
  return data as ApiMatch;
}

export async function deleteMatch(matchId: string, hostId: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/matches/${encodeURIComponent(matchId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId }),
  });
  if (res.status === 204) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Không xóa được trận');
  }
}

export async function fetchMatchById(
  id: string,
  options?: { userId?: string },
): Promise<ApiMatch> {
  const base = getApiBaseUrl();
  const q =
    options?.userId && options.userId.trim()
      ? `?userId=${encodeURIComponent(options.userId.trim())}`
      : '';
  const res = await fetch(`${base}/api/matches/${encodeURIComponent(id)}${q}`);
  if (res.status === 404) throw new Error('Không tìm thấy trận');
  if (!res.ok) throw new Error('Không tải được trận');
  return res.json();
}

export async function joinMatch(matchId: string, userId: string): Promise<ApiMatch> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/matches/${encodeURIComponent(matchId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Không tham gia được trận');
  }
  return data as ApiMatch;
}

export async function leaveMatch(matchId: string, userId: string): Promise<ApiMatch> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/matches/${encodeURIComponent(matchId)}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Không rời trận được');
  }
  return data as ApiMatch;
}

/** Dòng phụ trên card home: giờ + ngày */
export function formatMatchListSubtitle(m: ApiMatch): string {
  const t = String(m.time || '').trim();
  const d = m.date;
  if (t && d) return `${t} • ${formatDateVi(d)}`;
  if (d) return formatDateVi(d);
  return t || '';
}
