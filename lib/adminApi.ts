import { getApiBaseUrl } from '@/lib/apiBase';
import type { ApiMatch, MatchStatus } from '@/lib/matchApi';

export type AdminStats = {
  usersCount: number;
  matchesCount: number;
  venues: {
    pending: number;
    active: number;
    rejected: number;
  };
  courts: {
    pending: number;
    active: number;
    rejected: number;
  };
};

export type AdminUser = {
  id: string;
  name: string;
  username: string;
  role: 'user' | 'admin';
  isBanned?: boolean;
  avatar?: string;
  email?: string;
  phone?: string;
  age?: number;
  location?: string;
  bio?: string;
  sports?: { name: string; level: string }[];
  schedule?: { day: string; time?: string; activity: string }[];
  stats?: {
    matchesPlayed?: number;
    matchesWon?: number;
    winRate?: number;
    hoursActive?: number;
    followers?: number;
  };
};

export type AdminVenueStatus = 'pending' | 'active' | 'rejected';

export type AdminVenue = {
  id: string;
  ownerId?: string;
  name: string;
  address: string;
  sport: string;
  description: string;
  pricePerHour: number;
  status: AdminVenueStatus;
  rejectReason: string;
  createdAt?: string;
  updatedAt?: string;
};

function getJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/stats`);
  if (!res.ok) throw new Error('Không tải được thống kê admin');
  return getJson<AdminStats>(res);
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/users`);
  if (!res.ok) throw new Error('Không tải được danh sách user');
  return getJson<AdminUser[]>(res);
}

export async function updateAdminUserRole(userId: string, role: 'user' | 'admin'): Promise<AdminUser> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Cập nhật role thất bại');
  return data as AdminUser;
}

export async function setAdminUserBan(userId: string, isBanned: boolean): Promise<AdminUser> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/users/${encodeURIComponent(userId)}/ban`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isBanned }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Cập nhật ban thất bại');
  return data as AdminUser;
}

export async function fetchAdminVenues(status?: AdminVenueStatus): Promise<AdminVenue[]> {
  const base = getApiBaseUrl();
  const url = status ? `${base}/api/admin/venues?status=${encodeURIComponent(status)}` : `${base}/api/admin/venues`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không tải được danh sách sân');
  return getJson<AdminVenue[]>(res);
}

export async function fetchPendingVenues(): Promise<AdminVenue[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/venues/pending`);
  if (!res.ok) throw new Error('Không tải được sân chờ duyệt');
  return getJson<AdminVenue[]>(res);
}

export type CreateVenuePayload = {
  ownerId?: string;
  name: string;
  address?: string;
  sport?: string;
  description?: string;
  pricePerHour: number;
};

export async function createVenue(payload: CreateVenuePayload): Promise<AdminVenue> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Tạo sân thất bại');
  return data as AdminVenue;
}

export async function approveVenue(venueId: string): Promise<AdminVenue> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/venues/${encodeURIComponent(venueId)}/approve`, {
    method: 'PATCH',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Duyệt sân thất bại');
  return data as AdminVenue;
}

export async function rejectVenue(venueId: string, reason: string): Promise<AdminVenue> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/venues/${encodeURIComponent(venueId)}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Từ chối sân thất bại');
  return data as AdminVenue;
}

export type AdminMatchUpdatePayload = {
  sport?: string;
  title?: string;
  location?: string;
  date?: string;
  time?: string;
  maxPlayers?: number;
  minSkillLevel?: string;
  description?: string;
  rules?: string;
  status?: MatchStatus;
  winners?: string[];
  cancelReason?: string;
};

export type AdminReportStatus = 'pending' | 'reviewed' | 'resolved';
export type AdminReportResolvedAction = '' | 'warned' | 'banned';

export type AdminReport = {
  id: string;
  reason: string;
  status: AdminReportStatus;
  warningSentAt?: string | null;
  warningNote?: string;
  resolvedAt?: string | null;
  resolvedAction?: AdminReportResolvedAction;
  createdAt?: string;
  updatedAt?: string;
  match?: {
    id: string;
    title: string;
    date?: string;
    time?: string;
  } | null;
  reporter?: {
    id: string;
    name: string;
    username?: string;
    email?: string;
  } | null;
  reportedUser?: {
    id: string;
    name: string;
    username?: string;
    email?: string;
    isBanned?: boolean;
  } | null;
};

export async function updateAdminMatch(
  matchId: string,
  adminId: string,
  payload: AdminMatchUpdatePayload,
): Promise<ApiMatch> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/matches/${encodeURIComponent(matchId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Không cập nhật trận được');
  }
  return data as ApiMatch;
}

export async function fetchAdminReports(): Promise<AdminReport[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/reports`);
  if (!res.ok) throw new Error('Không tải được danh sách report');
  return getJson<AdminReport[]>(res);
}

export async function fetchAdminReportDetail(reportId: string): Promise<AdminReport> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/reports/${encodeURIComponent(reportId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Không tải được chi tiết report');
  return data as AdminReport;
}

export async function sendAdminReportWarning(reportId: string): Promise<AdminReport> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/reports/${encodeURIComponent(reportId)}/warn`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gửi cảnh báo thất bại');
  return (data?.report ?? data) as AdminReport;
}

export async function banUserByAdminReport(reportId: string): Promise<AdminReport> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/reports/${encodeURIComponent(reportId)}/ban`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Ban user thất bại');
  return data as AdminReport;
}

