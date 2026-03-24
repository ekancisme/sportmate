import { Platform } from 'react-native';

import { getCourtSportLabel, type CourtSportKey } from '@/constants/courtSports';
import { getApiBaseUrl } from '@/lib/apiBase';

export type CourtVisibilityStatus = 'active' | 'hidden';
export type CourtApprovalStatus = 'pending' | 'active' | 'rejected';
export type CourtBookingStatus = 'booked' | 'cancelled_by_user' | 'cancelled_by_owner';

export type ApiCourtOwner = {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  phone?: string;
  role?: string;
};

export type ApiCourt = {
  id: string;
  ownerId?: string;
  name: string;
  sportKey: CourtSportKey;
  sportLabel: string;
  address: string;
  pricePerHour: number;
  description: string;
  amenities: string[];
  images: string[];
  imageUrl: string;
  contactPhone: string;
  visibilityStatus: CourtVisibilityStatus;
  approvalStatus?: CourtApprovalStatus;
  rejectReason?: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  owner?: ApiCourtOwner | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SaveCourtPayload = {
  name: string;
  sportKey: CourtSportKey;
  address: string;
  pricePerHour: number;
  description: string;
  amenities: string[];
  images: string[];
  contactPhone: string;
};

export type CourtImageAsset = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export type CourtAvailabilitySlot = {
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  available: boolean;
};

export type CourtAvailabilityResponse = {
  date: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  slots: CourtAvailabilitySlot[];
};

export type ApiCourtBookingUser = {
  id: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar?: string;
};

export type ApiCourtBooking = {
  id: string;
  courtId: string;
  ownerId: string;
  userId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  priceSnapshot: number;
  contactName: string;
  contactPhone: string;
  note: string;
  status: CourtBookingStatus;
  user?: ApiCourtBookingUser | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CourtBookingsResponse = {
  court: ApiCourt;
  date: string;
  availability: CourtAvailabilityResponse;
  bookings: ApiCourtBooking[];
};

type BookingPayload = {
  userId: string;
  bookingDate: string;
  startTime: string;
  contactName?: string;
  contactPhone?: string;
  note?: string;
};

function normalizeCourt(raw: ApiCourt): ApiCourt {
  const sportKey = raw.sportKey;
  const images = Array.isArray(raw.images)
    ? raw.images.filter((item) => typeof item === 'string' && item.trim())
    : raw.imageUrl?.trim()
      ? [raw.imageUrl]
      : [];

  return {
    ...raw,
    sportKey,
    sportLabel: raw.sportLabel || getCourtSportLabel(sportKey),
    images,
    imageUrl: raw.imageUrl || images[0] || '',
    visibilityStatus: raw.visibilityStatus || 'active',
    openTime: raw.openTime || '06:00',
    closeTime: raw.closeTime || '22:00',
    slotMinutes: Number(raw.slotMinutes) || 60,
  };
}

export function formatCourtPrice(pricePerHour: number): string {
  const value = Number(pricePerHour || 0);
  if (!Number.isFinite(value) || value <= 0) return 'Liên hệ để báo giá';
  return `${value.toLocaleString('vi-VN')}đ/giờ`;
}

export function resolveCourtImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl?.trim()) return undefined;
  if (imageUrl.startsWith('http')) return imageUrl;
  const base = getApiBaseUrl();
  return `${base}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

export function resolveCourtImages(images: string[] | undefined): string[] {
  return (images || []).map((item) => resolveCourtImageUrl(item)).filter(Boolean) as string[];
}

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : fallback);
  }
  return data as T;
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.append(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchCourts(options?: { q?: string; sportKey?: CourtSportKey | 'all' }): Promise<ApiCourt[]> {
  const base = getApiBaseUrl();
  const query = buildQuery({
    q: options?.q?.trim() || undefined,
    sportKey: options?.sportKey && options.sportKey !== 'all' ? options.sportKey : undefined,
  });
  const res = await fetch(`${base}/api/courts${query}`);
  const data = await parseResponse<ApiCourt[]>(res, 'Không tải được danh sách sân');
  return data.map((item) => normalizeCourt(item));
}

export async function fetchCourtById(id: string): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts/${encodeURIComponent(id)}`);
  const data = await parseResponse<ApiCourt>(res, 'Không tải được thông tin sân');
  return normalizeCourt(data);
}

export async function fetchMyCourts(ownerId: string): Promise<ApiCourt[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts/mine?ownerId=${encodeURIComponent(ownerId)}`);
  const data = await parseResponse<ApiCourt[]>(res, 'Không tải được sân của bạn');
  return data.map((item) => normalizeCourt(item));
}

export async function createCourt(ownerId: string, payload: SaveCourtPayload): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId, ...payload }),
  });
  const data = await parseResponse<ApiCourt>(res, 'Không đăng được sân');
  return normalizeCourt(data);
}

export async function updateCourt(
  courtId: string,
  ownerId: string,
  payload: Partial<SaveCourtPayload & { visibilityStatus: CourtVisibilityStatus }>,
): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts/${encodeURIComponent(courtId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId, ...payload }),
  });
  const data = await parseResponse<ApiCourt>(res, 'Không cập nhật được sân');
  return normalizeCourt(data);
}

export async function deleteCourt(courtId: string, ownerId: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts/${encodeURIComponent(courtId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId }),
  });
  if (res.status === 204) return;
  await parseResponse(res, 'Không xóa được sân');
}

export async function resubmitCourtOwner(courtId: string, ownerId: string): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts/${encodeURIComponent(courtId)}/resubmit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId }),
  });
  const data = await parseResponse<ApiCourt>(res, 'Không đăng lại được sân');
  return normalizeCourt(data);
}

export async function uploadCourtImages(
  courtId: string,
  ownerId: string,
  assets: CourtImageAsset[],
): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const form = new FormData();
  form.append('ownerId', ownerId);

  for (const asset of assets) {
    if (Platform.OS === 'web') {
      const imageRes = await fetch(asset.uri);
      const blob = await imageRes.blob();
      const ext = asset.mimeType?.split('/')[1] || 'jpeg';
      form.append('images', blob, asset.fileName || `court.${ext}`);
    } else {
      form.append('images', {
        uri: asset.uri,
        name: asset.fileName || 'court.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as never);
    }
  }

  const res = await fetch(`${base}/api/courts/${encodeURIComponent(courtId)}/images`, {
    method: 'POST',
    body: form,
  });
  const data = await parseResponse<ApiCourt>(res, 'Không tải ảnh sân lên được');
  return normalizeCourt(data);
}

export async function fetchCourtAvailability(
  courtId: string,
  date: string,
): Promise<CourtAvailabilityResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/api/courts/${encodeURIComponent(courtId)}/availability?date=${encodeURIComponent(date)}`,
  );
  return parseResponse<CourtAvailabilityResponse>(res, 'Không tải được lịch trống');
}

export async function createCourtBooking(
  courtId: string,
  payload: BookingPayload,
): Promise<{ booking: ApiCourtBooking; court: ApiCourt }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/courts/${encodeURIComponent(courtId)}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ booking: ApiCourtBooking; court: ApiCourt }>(
    res,
    'Không thể đặt sân lúc này',
  );
  return { booking: data.booking, court: normalizeCourt(data.court) };
}

export async function fetchCourtBookings(
  courtId: string,
  ownerId: string,
  date: string,
): Promise<CourtBookingsResponse> {
  const base = getApiBaseUrl();
  const query = buildQuery({ ownerId, date });
  const res = await fetch(`${base}/api/courts/${encodeURIComponent(courtId)}/bookings${query}`);
  const data = await parseResponse<CourtBookingsResponse>(res, 'Không tải được lịch đặt sân');
  return {
    ...data,
    court: normalizeCourt(data.court),
  };
}

export async function cancelCourtBooking(bookingId: string, actorId: string): Promise<ApiCourtBooking> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/court-bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId }),
  });
  return parseResponse<ApiCourtBooking>(res, 'Không hủy được booking');
}

// ─── Admin court functions ────────────────────────────────────────────────

/** Lấy toàn bộ sân (kể cả pending/rejected) dành cho admin. */
export async function fetchAllCourtsAdmin(): Promise<ApiCourt[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/courts`);
  const data = await parseResponse<ApiCourt[]>(res, 'Không tải được danh sách sân');
  return data.map((item) => normalizeCourt(item));
}

/** Admin duyệt sân: chuyển approvalStatus thành 'active'. */
export async function approveCourtAdmin(courtId: string): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/courts/${encodeURIComponent(courtId)}/approve`, {
    method: 'PATCH',
  });
  const data = await parseResponse<ApiCourt>(res, 'Duyệt sân thất bại');
  return normalizeCourt(data);
}

/** Admin từ chối sân kèm lý do. */
export async function rejectCourtAdmin(courtId: string, reason: string): Promise<ApiCourt> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/courts/${encodeURIComponent(courtId)}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await parseResponse<ApiCourt>(res, 'Từ chối sân thất bại');
  return normalizeCourt(data);
}
