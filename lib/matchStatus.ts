/**
 * matchStatus.ts
 * Tính trạng thái hiển thị của trận đấu dựa vào ngày/giờ và status từ DB.
 *
 * 4 trạng thái:
 *  - "Chờ diễn ra"  → active, chưa đến giờ bắt đầu
 *  - "Đang diễn ra" → active, đang trong khoảng giờ thi đấu
 *  - "Kết thúc"     → finished (host bấm kết thúc) hoặc active nhưng đã qua giờ kết thúc
 *  - "Đã hủy"       → cancelled
 */

export type DisplayStatus = {
  label: string;
  color: string;        // text color / accent
  bg: string;           // background (semi-transparent)
  border: string;       // border color
  dot: string;          // dot / icon color (same as color or lighter)
  /** 'upcoming' | 'live' | 'finished' | 'cancelled' */
  key: 'upcoming' | 'live' | 'finished' | 'cancelled';
};

const STATUS_MAP: Record<string, DisplayStatus> = {
  upcoming: {
    label: 'Chờ diễn ra',
    key: 'upcoming',
    color: '#60a5fa',           // blue
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.4)',
    dot: '#60a5fa',
  },
  live: {
    label: 'Đang diễn ra',
    key: 'live',
    color: '#4ade80',           // green
    bg: 'rgba(74,222,128,0.12)',
    border: 'rgba(74,222,128,0.4)',
    dot: '#4ade80',
  },
  finished: {
    label: 'Kết thúc',
    key: 'finished',
    color: '#9ca3af',           // grey
    bg: 'rgba(156,163,175,0.12)',
    border: 'rgba(156,163,175,0.35)',
    dot: '#9ca3af',
  },
  cancelled: {
    label: 'Đã hủy',
    key: 'cancelled',
    color: '#f87171',           // red
    bg: 'rgba(248,113,113,0.12)',
    border: 'rgba(248,113,113,0.35)',
    dot: '#f87171',
  },
};

/**
 * Parse "HH:mm - HH:mm" hoặc "HH:mm" → [startMinutes, endMinutes] (phút từ 00:00)
 * Nếu không có giờ kết thúc, mặc định +90 phút.
 */
function parseTimeRange(timeStr: string | undefined): { startMin: number; endMin: number } | null {
  if (!timeStr?.trim()) return null;
  const parts = timeStr.split('-').map((s) => s.trim());
  const parseHHMM = (s: string) => {
    const [hStr, mStr] = s.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr ?? '0', 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };
  const startMin = parseHHMM(parts[0]);
  if (startMin === null) return null;
  const endMin = parts[1] ? parseHHMM(parts[1]) : startMin + 90;
  if (endMin === null) return null;
  return { startMin, endMin: endMin < startMin ? endMin + 24 * 60 : endMin };
}

/**
 * Tính DisplayStatus của một trận.
 * @param dbStatus   - match.status từ DB: 'active' | 'finished' | 'cancelled'
 * @param dateStr    - match.date: 'yyyy-mm-dd'
 * @param timeStr    - match.time: 'HH:mm - HH:mm'
 * @param now        - thời điểm hiện tại (mặc định = new Date())
 */
export function computeDisplayStatus(
  dbStatus: string,
  dateStr: string | undefined,
  timeStr: string | undefined,
  now: Date = new Date(),
): DisplayStatus {
  if (dbStatus === 'cancelled') return STATUS_MAP.cancelled;
  if (dbStatus === 'finished') return STATUS_MAP.finished;

  // dbStatus === 'active' → tính theo thời gian
  if (!dateStr?.trim()) return STATUS_MAP.upcoming;

  const [y, mo, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(mo) || isNaN(d)) return STATUS_MAP.upcoming;

  const range = parseTimeRange(timeStr);
  if (!range) {
    // Không có giờ — so sánh theo ngày
    const matchDay = new Date(y, mo - 1, d);
    matchDay.setHours(23, 59, 59, 999);
    return now > matchDay ? STATUS_MAP.finished : STATUS_MAP.upcoming;
  }

  const startMs = new Date(y, mo - 1, d, 0, range.startMin).getTime();
  const endMs = new Date(y, mo - 1, d, 0, range.endMin).getTime();
  const nowMs = now.getTime();

  if (nowMs < startMs) return STATUS_MAP.upcoming;
  if (nowMs <= endMs) return STATUS_MAP.live;
  return STATUS_MAP.finished;
}
