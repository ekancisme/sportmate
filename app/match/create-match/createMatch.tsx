import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import { getApiBaseUrl } from '@/lib/apiBase';
import {
  fetchMatchById,
  updateMatch,
  type ApiMatch,
  type ApiMatchParticipant,
  type MatchStatus,
} from '@/lib/matchApi';

const SPORTS = [
  'Bóng Đá',
  'Bóng Rổ',
  'Cầu Lông',
  'Quần Vợt',
  'Bóng Chuyền',
  'Chạy Bộ',
  'Bơi Lội',
  'Khác',
] as const;

const PLAYER_COUNTS = ['2', '4', '6', '8', '10', 'Khác'] as const;

const SKILL_LEVELS = [
  'Tất Cả',
  'Sơ Cấp',
  'Trung Bình',
  'Cao',
  'Chuyên Nghiệp',
  'Khác',
] as const;

/** Cùng tone với nút "Tạo trận đấu" */
const PRIMARY = '#ff4d4f';

function parseDateFromForm(s: string): Date {
  if (!s.trim()) return new Date();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    return new Date(y, m, d);
  }
  return new Date();
}

/** Hiển thị kiểu mm/dd/yyyy (giống mock) */
function formatDateDisplay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Lưu form: yyyy-mm-dd */
function formatDateStore(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Ghép ngày (yyyy-mm-dd) với giờ/phút từ một Date mẫu */
function mergeDateAndClock(dateYmd: string, clock: Date): Date {
  const d = parseDateFromForm(dateYmd);
  d.setHours(clock.getHours(), clock.getMinutes(), 0, 0);
  return d;
}

/** Parse "HH:mm - HH:mm" hoặc "HH:mm" → hai mốc trên cùng một ngày form */
function parseTimeRangeForDay(dateYmd: string, timeStr: string): { start: Date; end: Date } {
  const base = parseDateFromForm(dateYmd);
  const s = new Date(base);
  const e = new Date(base);
  const range = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (range) {
    s.setHours(parseInt(range[1], 10), parseInt(range[2], 10), 0, 0);
    e.setHours(parseInt(range[3], 10), parseInt(range[4], 10), 0, 0);
    return { start: s, end: e };
  }
  const one = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (one) {
    s.setHours(parseInt(one[1], 10), parseInt(one[2], 10), 0, 0);
    e.setTime(s.getTime() + 60 * 60 * 1000);
    return { start: s, end: e };
  }
  const now = new Date();
  s.setHours(now.getHours() + 1, 0, 0, 0);
  e.setTime(s.getTime() + 60 * 60 * 1000);
  return { start: s, end: e };
}

function formatTimeRange(start: Date, end: Date): string {
  const f = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${f(start)} - ${f(end)}`;
}

/** Thời điểm bắt đầu trận (để so với hiện tại) */
function parseMatchStartAt(dateYmd: string, timeRange: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(timeRange.trim());
  if (!m) return null;
  const d = parseDateFromForm(dateYmd);
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}

/** Giới hạn dưới cho picker giờ: hôm nay thì không trước "bây giờ", ngày sau thì từ 00:00 */
function getMinimumClockForDate(dateYmd: string): Date {
  const day = parseDateFromForm(dateYmd);
  const now = new Date();
  if (isSameCalendarDay(day, now)) return now;
  day.setHours(0, 0, 0, 0);
  return day;
}

type MatchForm = {
  sport: string;
  /** Khi sport === "Khác": tên môn do người dùng nhập */
  sportOther: string;
  title: string;
  location: string;
  date: string;
  time: string;
  maxPlayers: string;
  /** Khi maxPlayers === "Khác": số người tùy nhập */
  maxPlayersOther: string;
  minSkillLevel: string;
  /** Khi minSkillLevel === "Khác" */
  skillOther: string;
  description: string;
  rules: string;
};

const initialForm: MatchForm = {
  sport: 'Bóng Đá',
  sportOther: '',
  title: '',
  location: '',
  date: '',
  time: '',
  maxPlayers: '10',
  maxPlayersOther: '',
  minSkillLevel: 'Tất Cả',
  skillOther: '',
  description: '',
  rules: '',
};

function apiMatchToForm(m: ApiMatch): MatchForm {
  const sportList = SPORTS as readonly string[];
  const sportIn = sportList.includes(m.sport) ? m.sport : 'Khác';
  const sportOther = sportIn === 'Khác' ? m.sport : '';
  const mpStr = String(m.maxPlayers);
  const pc = PLAYER_COUNTS as readonly string[];
  const mpIn = (pc as readonly string[]).includes(mpStr) ? mpStr : 'Khác';
  const maxPlayersOther = mpIn === 'Khác' ? mpStr : '';
  const sl = SKILL_LEVELS as readonly string[];
  const skillIn = (sl as readonly string[]).includes(m.minSkillLevel)
    ? m.minSkillLevel
    : 'Khác';
  const skillOther = skillIn === 'Khác' ? m.minSkillLevel : '';
  return {
    sport: sportIn,
    sportOther,
    title: m.title,
    location: m.location,
    date: m.date,
    time: m.time,
    maxPlayers: mpIn,
    maxPlayersOther,
    minSkillLevel: skillIn,
    skillOther,
    description: m.description || '',
    rules: m.rules || '',
  };
}

export default function CreateMatch() {
  const params = useLocalSearchParams<{ editId?: string }>();
  const editId = params.editId
    ? Array.isArray(params.editId)
      ? params.editId[0]
      : params.editId
    : undefined;
  const isEditMode = Boolean(editId);

  const { user } = useAuth();
  const { show: showAlert, Alert: AppAlertNode } = useAppAlert();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [form, setForm] = useState<MatchForm>(initialForm);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [tempDate, setTempDate] = useState(() => new Date());
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  /** Chọn giờ theo 2 bước: chỉ một đồng hồ mỗi lần */
  const [timePickStep, setTimePickStep] = useState<'start' | 'end'>('start');
  const [tempTimeStart, setTempTimeStart] = useState(() => new Date());
  const [tempTimeEnd, setTempTimeEnd] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(!!editId);
  const [resultSubmitting, setResultSubmitting] = useState(false);

  const [matchStatus, setMatchStatus] = useState<MatchStatus>('active');
  const [matchParticipants, setMatchParticipants] = useState<ApiMatchParticipant[]>([]);
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [resultAction, setResultAction] = useState<'finish' | 'cancel' | null>(null);

  useEffect(() => {
    if (!editId || !user?.id) {
      setLoadingMatch(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await fetchMatchById(editId);
        if (cancelled) return;
        if (raw.hostId && raw.hostId !== user.id) {
          showAlert('Không thể sửa', 'Bạn không phải host của trận này.', {
            variant: 'error',
            onConfirm: () => router.back(),
          });
          return;
        }
        setForm(apiMatchToForm(raw));
        setMatchStatus(raw.status ?? 'active');
        setMatchParticipants(raw.participants ?? []);
        setWinnerIds(raw.winners ?? []);
        setCancelReasonDraft(raw.cancelReason ?? '');
        setResultAction(
          raw.status === 'finished'
            ? 'finish'
            : raw.status === 'cancelled'
              ? 'cancel'
              : null,
        );
      } catch {
        if (!cancelled) {
          showAlert('Lỗi', 'Không tải được trận để sửa.', {
            variant: 'error',
            onConfirm: () => router.back(),
          });
        }
      } finally {
        if (!cancelled) setLoadingMatch(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, user?.id]);

  const scrollMultilineIntoView = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleChange = (key: keyof MatchForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSportSelect = (sport: string) => {
    setForm((prev) => ({
      ...prev,
      sport,
      ...(sport !== 'Khác' ? { sportOther: '' } : {}),
    }));
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      showAlert(
        'Cần đăng nhập',
        isEditMode ? 'Vui lòng đăng nhập để sửa trận.' : 'Vui lòng đăng nhập để tạo trận đấu.',
        { variant: 'error' },
      );
      return;
    }

    const sportResolved =
      form.sport === 'Khác' ? form.sportOther.trim() : form.sport;
    const skillResolved =
      form.minSkillLevel === 'Khác' ? form.skillOther.trim() : form.minSkillLevel;
    const maxPlayersResolved =
      form.maxPlayers === 'Khác' ? form.maxPlayersOther.trim() : form.maxPlayers;

    if (form.sport === 'Khác' && !sportResolved) {
      showAlert('Thiếu thông tin', 'Vui lòng nhập tên môn thể thao.', { variant: 'error' });
      return;
    }
    if (form.minSkillLevel === 'Khác' && !skillResolved) {
      showAlert('Thiếu thông tin', 'Vui lòng nhập mức kỹ năng.', { variant: 'error' });
      return;
    }
    if (form.title.trim().length < 2) {
      showAlert('Thiếu thông tin', 'Tiêu đề trận đấu cần ít nhất 2 ký tự.', { variant: 'error' });
      return;
    }
    if (!form.location.trim()) {
      showAlert('Thiếu thông tin', 'Vui lòng nhập địa điểm.', { variant: 'error' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim())) {
      showAlert('Thiếu thông tin', 'Vui lòng chọn ngày.', { variant: 'error' });
      return;
    }
    if (form.maxPlayers === 'Khác') {
      const n = parseInt(maxPlayersResolved, 10);
      if (!Number.isFinite(n) || n < 1) {
        showAlert('Số người', 'Vui lòng nhập số người hợp lệ.', { variant: 'error' });
        return;
      }
    }

    const maxN = parseInt(maxPlayersResolved, 10);
    if (!Number.isFinite(maxN) || maxN < 1) {
      showAlert('Số người', 'Số người không hợp lệ.', { variant: 'error' });
      return;
    }

    if (!/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(form.time.trim())) {
      showAlert('Giờ', 'Vui lòng chọn khoảng giờ (bắt đầu - kết thúc).', { variant: 'error' });
      return;
    }
    const startAt = parseMatchStartAt(form.date, form.time);
    if (!startAt) {
      showAlert('Giờ', 'Không đọc được giờ đã chọn.', { variant: 'error' });
      return;
    }
    const endM = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(form.time.trim());
    if (endM) {
      const endAt = parseDateFromForm(form.date);
      endAt.setHours(parseInt(endM[3], 10), parseInt(endM[4], 10), 0, 0);
      if (endAt.getTime() <= startAt.getTime()) {
        showAlert('Giờ', 'Giờ kết thúc phải sau giờ bắt đầu.', { variant: 'error' });
        return;
      }
    }
    if (!isEditMode && startAt.getTime() < Date.now() - 30 * 1000) {
      showAlert('Thời gian', 'Không thể chọn ngày giờ trong quá khứ.', { variant: 'error' });
      return;
    }

    const base = getApiBaseUrl();
    setSubmitting(true);
    try {
      if (isEditMode && editId) {
        await updateMatch(editId, user.id, {
          sport: sportResolved,
          title: form.title.trim(),
          location: form.location.trim(),
          date: form.date.trim(),
          time: form.time.trim(),
          maxPlayers: maxN,
          minSkillLevel: skillResolved,
          description: form.description.trim(),
          rules: form.rules.trim(),
        });
        showAlert('Thành công', 'Đã cập nhật trận đấu.', {
          variant: 'success',
          onConfirm: () => router.back(),
        });
      } else {
        const res = await fetch(`${base}/api/matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostId: user.id,
            sport: sportResolved,
            title: form.title.trim(),
            location: form.location.trim(),
            date: form.date.trim(),
            time: form.time.trim(),
            maxPlayers: maxN,
            minSkillLevel: skillResolved,
            description: form.description.trim(),
            rules: form.rules.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showAlert('Không tạo được trận', data?.error || `Lỗi ${res.status}`, {
            variant: 'error',
          });
          return;
        }
        showAlert('Thành công', 'Đã tạo trận đấu.', {
          variant: 'success',
          onConfirm: () => router.back(),
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Không kết nối được server. Kiểm tra API đang chạy.';
      showAlert('Lỗi', msg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWinner = (pid: string) => {
    setWinnerIds((prev) => {
      if (prev.includes(pid)) return prev.filter((x) => x !== pid);
      return [...prev, pid];
    });
  };

  const confirmFinish = async () => {
    if (!user?.id || !editId) return;
    const participantIds = matchParticipants.map((p) => p.id);
    if (winnerIds.length === 0) {
      showAlert('Người thắng', 'Vui lòng chọn ít nhất 1 người thắng.', {
        variant: 'error',
      });
      return;
    }
    const invalid = winnerIds.filter((wid) => !participantIds.includes(wid));
    if (invalid.length > 0) {
      showAlert('Người thắng', 'Người thắng phải thuộc danh sách người tham gia.', {
        variant: 'error',
      });
      return;
    }

    setResultSubmitting(true);
    try {
      await updateMatch(editId, user.id, {
        status: 'finished',
        winners: winnerIds,
      });
      showAlert('Thành công', 'Đã cập nhật kết quả trận đấu.', {
        variant: 'success',
        onConfirm: () =>
          router.replace({
            pathname: '/match',
            params: { id: editId, refresh: String(Date.now()) },
          }),
      });
    } catch (e) {
      showAlert(
        'Lỗi',
        e instanceof Error ? e.message : 'Không cập nhật được kết quả trận.',
        { variant: 'error' },
      );
    } finally {
      setResultSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    if (!user?.id || !editId) return;
    const reason = cancelReasonDraft.trim();
    if (reason.length < 5) {
      showAlert('Lý do hủy', 'Vui lòng nhập lý do (ít nhất 5 ký tự).', {
        variant: 'error',
      });
      return;
    }
    setResultSubmitting(true);
    try {
      await updateMatch(editId, user.id, {
        status: 'cancelled',
        cancelReason: reason,
      });
      showAlert('Thành công', 'Đã hủy trận và gửi lý do cho người tham gia.', {
        variant: 'success',
        onConfirm: () =>
          router.replace({
            pathname: '/match',
            params: { id: editId, refresh: String(Date.now()) },
          }),
      });
    } catch (e) {
      showAlert(
        'Lỗi',
        e instanceof Error ? e.message : 'Không hủy được trận.',
        { variant: 'error' },
      );
    } finally {
      setResultSubmitting(false);
    }
  };

  const handlePlayerCountSelect = (n: string) => {
    setForm((prev) => ({
      ...prev,
      maxPlayers: n,
      ...(n !== 'Khác' ? { maxPlayersOther: '' } : {}),
    }));
  };

  const handleSkillSelect = (level: string) => {
    setForm((prev) => ({
      ...prev,
      minSkillLevel: level,
      ...(level !== 'Khác' ? { skillOther: '' } : {}),
    }));
  };

  const showSportOther = form.sport === 'Khác';
  const showPlayerOther = form.maxPlayers === 'Khác';
  const showSkillOther = form.minSkillLevel === 'Khác';

  const openDateModal = () => {
    const base = form.date.trim() ? parseDateFromForm(form.date) : new Date();
    const today = startOfToday();
    const b = new Date(base);
    b.setHours(0, 0, 0, 0);
    setTempDate(b < today ? new Date() : base);
    setDateModalOpen(true);
  };

  const confirmDate = () => {
    const sel = new Date(tempDate);
    sel.setHours(0, 0, 0, 0);
    const today = startOfToday();
    if (sel < today) {
      const n = new Date();
      setTempDate(n);
      handleChange('date', formatDateStore(n));
    } else {
      handleChange('date', formatDateStore(tempDate));
    }
    setDateModalOpen(false);
  };

  const onDatePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setDateModalOpen(false);
        return;
      }
      if (event.type === 'set' && date) {
        const sel = new Date(date);
        sel.setHours(0, 0, 0, 0);
        const today = startOfToday();
        if (sel < today) {
          const n = new Date();
          setTempDate(n);
          handleChange('date', formatDateStore(n));
        } else {
          setTempDate(date);
          handleChange('date', formatDateStore(date));
        }
        setDateModalOpen(false);
      }
      return;
    }
    if (date) {
      const sel = new Date(date);
      sel.setHours(0, 0, 0, 0);
      const today = startOfToday();
      if (sel < today) {
        setTempDate(new Date());
      } else {
        setTempDate(date);
      }
    }
  };

  const openTimeModal = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim())) {
      showAlert('Chọn ngày', 'Vui lòng chọn ngày trước khi chọn giờ.', { variant: 'error' });
      return;
    }
    let { start, end } = parseTimeRangeForDay(form.date, form.time);
    const minClock = getMinimumClockForDate(form.date);
    if (start < minClock) {
      start = new Date(minClock);
      end = new Date(minClock.getTime() + 60 * 60 * 1000);
    }
    if (end <= start) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    setTempTimeStart(start);
    setTempTimeEnd(end);
    setTimePickStep('start');
    setTimeModalOpen(true);
  };

  const closeTimeModal = () => {
    setTimePickStep('start');
    setTimeModalOpen(false);
  };

  const goToEndStep = () => {
    const minClock = getMinimumClockForDate(form.date);
    if (tempTimeStart < minClock) {
      showAlert('Giờ', 'Không thể chọn giờ trong quá khứ.', { variant: 'error' });
      return;
    }
    setTempTimeEnd((prev) => {
      const minEnd = new Date(
        Math.max(tempTimeStart.getTime() + 60 * 1000, minClock.getTime()),
      );
      if (prev <= tempTimeStart) return minEnd;
      return prev < minEnd ? minEnd : prev;
    });
    setTimePickStep('end');
  };

  const confirmTime = () => {
    const minClock = getMinimumClockForDate(form.date);
    if (tempTimeStart < minClock) {
      showAlert('Giờ', 'Không thể chọn giờ trong quá khứ.', { variant: 'error' });
      return;
    }
    if (tempTimeEnd <= tempTimeStart) {
      showAlert('Giờ', 'Giờ kết thúc phải sau giờ bắt đầu.', { variant: 'error' });
      return;
    }
    handleChange('time', formatTimeRange(tempTimeStart, tempTimeEnd));
    closeTimeModal();
  };

  const onTimeStartChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') return;
      if (event.type === 'set' && date) {
        const merged = mergeDateAndClock(form.date, date);
        const minClock = getMinimumClockForDate(form.date);
        const next = merged < minClock ? minClock : merged;
        setTempTimeStart(next);
        setTempTimeEnd((prev) =>
          prev <= next ? new Date(next.getTime() + 60 * 60 * 1000) : prev,
        );
      }
      return;
    }
    if (date) {
      const merged = mergeDateAndClock(form.date, date);
      const minClock = getMinimumClockForDate(form.date);
      const next = merged < minClock ? minClock : merged;
      setTempTimeStart(next);
      setTempTimeEnd((prev) =>
        prev <= next ? new Date(next.getTime() + 60 * 60 * 1000) : prev,
      );
    }
  };

  const onTimeEndChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') return;
      if (event.type === 'set' && date) {
        const merged = mergeDateAndClock(form.date, date);
        const minEnd = new Date(
          Math.max(
            tempTimeStart.getTime() + 60 * 1000,
            getMinimumClockForDate(form.date).getTime(),
          ),
        );
        setTempTimeEnd(merged < minEnd ? minEnd : merged);
      }
      return;
    }
    if (date) {
      const merged = mergeDateAndClock(form.date, date);
      const minEnd = new Date(
        Math.max(
          tempTimeStart.getTime() + 60 * 1000,
          getMinimumClockForDate(form.date).getTime(),
        ),
      );
      setTempTimeEnd(merged < minEnd ? minEnd : merged);
    }
  };

  const minEndForPicker = new Date(
    Math.max(
      tempTimeStart.getTime() + 60 * 1000,
      getMinimumClockForDate(form.date).getTime(),
    ),
  );

  const bottomPad = insets.bottom + 280;

  if (loadingMatch) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#050505',
        }}>
        <ActivityIndicator color={PRIMARY} size="large" />
        <Text style={{ color: '#888', marginTop: 14, fontSize: 15 }}>Đang tải trận...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.kavRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
      <View style={styles.headerRow}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.headerBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Sửa trận đấu' : 'Tạo trận đấu'}</Text>
        <View style={styles.headerBtnPlaceholder} />
      </View>
      <Text style={styles.subtitle}>
        {isEditMode
          ? 'Cập nhật thông tin trận. Người đã tham gia vẫn được giữ.'
          : 'Điền thông tin chi tiết để các người chơi khác có thể tham gia dễ dàng.'}
      </Text>

      <View style={styles.sportSection}>
        <View style={styles.sportSectionHeader}>
          <Ionicons name="trophy" size={26} color={PRIMARY} style={styles.sportTrophyIcon} />
          <View style={styles.sportSectionHeaderText}>
            <Text style={styles.sportSectionTitle}>Chọn Môn Thể Thao</Text>
            <Text style={styles.sportSectionSubtitle}>Loại hình thể thao bạn muốn tổ chức</Text>
          </View>
        </View>
        <View style={styles.sportGrid}>
          {SPORTS.map((sport) => {
            const selected = form.sport === sport;
            return (
              <Pressable
                key={sport}
                onPress={() => handleSportSelect(sport)}
                style={({ pressed }) => [
                  styles.sportChip,
                  selected && styles.sportChipSelected,
                  pressed && !selected && styles.sportChipPressed,
                ]}
              >
                <Text style={[styles.sportChipLabel, selected && styles.sportChipLabelSelected]}>
                  {sport}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {showSportOther ? (
          <View style={styles.sportOtherField}>
            <Text style={styles.label}>Nhập môn thể thao</Text>
            <TextInput
              placeholder="VD: Pickleball, Esport..."
              placeholderTextColor="#777"
              style={styles.input}
              value={form.sportOther}
              onChangeText={(text) => handleChange('sportOther', text)}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Tiêu đề trận đấu</Text>
        <TextInput
          placeholder="VD: Giao hữu bóng đá tối thứ 6"
          placeholderTextColor="#777"
          style={styles.input}
          value={form.title}
          onChangeText={(text) => handleChange('title', text)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Địa điểm</Text>
        <TextInput
          placeholder="VD: Sân Hoa Lư, Quận 1"
          placeholderTextColor="#777"
          style={styles.input}
          value={form.location}
          onChangeText={(text) => handleChange('location', text)}
        />
      </View>

      <Modal
        visible={dateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalOpen(false)}
      >
        <Pressable style={styles.dateModalBackdrop} onPress={() => setDateModalOpen(false)}>
          <View style={styles.dateModalCard}>
            <Text style={styles.dateModalTitle}>Chọn ngày</Text>
            {Platform.OS === 'web' ? (
              <>
                <Text style={styles.dateModalHint}>Nhập ngày (YYYY-MM-DD)</Text>
                <TextInput
                  placeholder="2026-03-22"
                  placeholderTextColor="#666"
                  style={styles.dateWebInput}
                  value={formatDateStore(tempDate)}
                  onChangeText={(t) => {
                    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.trim());
                    if (m) {
                      setTempDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={styles.dateModalBtn}
                  onPress={() => {
                    if (formatDateStore(tempDate) < formatDateStore(startOfToday())) {
                      showAlert('Ngày', 'Không chọn ngày trong quá khứ.', { variant: 'error' });
                      return;
                    }
                    confirmDate();
                  }}
                >
                  <Text style={styles.dateModalBtnText}>Xong</Text>
                </Pressable>
              </>
            ) : (
              <>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                  onChange={onDatePickerChange}
                  themeVariant="dark"
                  locale="vi-VN"
                  minimumDate={startOfToday()}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable style={styles.dateModalBtn} onPress={confirmDate}>
                    <Text style={styles.dateModalBtnText}>Xong</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={timeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTimeModal}
      >
        <Pressable style={styles.dateModalBackdrop} onPress={closeTimeModal}>
          <View style={styles.dateModalCard}>
            <Text style={styles.dateModalTitle}>
              {timePickStep === 'start' ? 'Giờ bắt đầu' : 'Giờ kết thúc'}
            </Text>
            {Platform.OS === 'web' ? (
              timePickStep === 'start' ? (
                <>
                  <Text style={styles.dateModalHint}>Nhập HH:mm</Text>
                  <TextInput
                    placeholder="20:00"
                    placeholderTextColor="#666"
                    style={styles.dateWebInput}
                    value={`${String(tempTimeStart.getHours()).padStart(2, '0')}:${String(tempTimeStart.getMinutes()).padStart(2, '0')}`}
                    onChangeText={(t) => {
                      const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
                      if (m) {
                        const d = mergeDateAndClock(
                          form.date,
                          new Date(2000, 0, 1, parseInt(m[1], 10), parseInt(m[2], 10)),
                        );
                        const minClock = getMinimumClockForDate(form.date);
                        setTempTimeStart(d < minClock ? minClock : d);
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable style={styles.dateModalBtn} onPress={goToEndStep}>
                    <Text style={styles.dateModalBtnText}>Tiếp</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.dateModalHint}>Nhập HH:mm</Text>
                  <TextInput
                    placeholder="21:30"
                    placeholderTextColor="#666"
                    style={styles.dateWebInput}
                    value={`${String(tempTimeEnd.getHours()).padStart(2, '0')}:${String(tempTimeEnd.getMinutes()).padStart(2, '0')}`}
                    onChangeText={(t) => {
                      const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
                      if (m) {
                        const d = mergeDateAndClock(
                          form.date,
                          new Date(2000, 0, 1, parseInt(m[1], 10), parseInt(m[2], 10)),
                        );
                        const minEnd = new Date(
                          Math.max(
                            tempTimeStart.getTime() + 60 * 1000,
                            getMinimumClockForDate(form.date).getTime(),
                          ),
                        );
                        setTempTimeEnd(d < minEnd ? minEnd : d);
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.timeModalActions}>
                    <Pressable
                      style={styles.timeModalSecondaryBtn}
                      onPress={() => setTimePickStep('start')}
                    >
                      <Text style={styles.timeModalSecondaryBtnText}>Quay lại</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.dateModalBtn, styles.timeModalPrimaryBtnFlex]}
                      onPress={confirmTime}
                    >
                      <Text style={styles.dateModalBtnText}>Xong</Text>
                    </Pressable>
                  </View>
                </>
              )
            ) : timePickStep === 'start' ? (
              <>
                <Text style={styles.dateModalHint}>Chọn giờ bắt đầu</Text>
                <DateTimePicker
                  value={tempTimeStart}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  onChange={onTimeStartChange}
                  themeVariant="dark"
                  locale="vi-VN"
                  minimumDate={getMinimumClockForDate(form.date)}
                  {...(Platform.OS === 'android' ? { is24Hour: true as const } : {})}
                />
                <Pressable style={styles.dateModalBtn} onPress={goToEndStep}>
                  <Text style={styles.dateModalBtnText}>Tiếp</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.dateModalHint}>Chọn giờ kết thúc</Text>
                <DateTimePicker
                  value={tempTimeEnd}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  onChange={onTimeEndChange}
                  themeVariant="dark"
                  locale="vi-VN"
                  minimumDate={minEndForPicker}
                  {...(Platform.OS === 'android' ? { is24Hour: true as const } : {})}
                />
                <View style={styles.timeModalActions}>
                  <Pressable
                    style={styles.timeModalSecondaryBtn}
                    onPress={() => setTimePickStep('start')}
                  >
                    <Text style={styles.timeModalSecondaryBtnText}>Quay lại</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateModalBtn, styles.timeModalPrimaryBtnFlex]}
                    onPress={confirmTime}
                  >
                    <Text style={styles.dateModalBtnText}>Xong</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.row}>
        <View style={[styles.field, styles.rowItem]}>
          <Text style={styles.label}>Ngày</Text>
          <View style={styles.dateRow}>
            {/* <Ionicons name="calendar-outline" size={20} color="#888" style={styles.dateRowOuterIcon} /> */}
            <Pressable
              onPress={openDateModal}
              style={({ pressed }) => [styles.dateInputWrap, pressed && styles.dateInputWrapPressed]}
            >
              <Text
                style={form.date ? styles.dateInputText : styles.dateInputPlaceholder}
                numberOfLines={1}
              >
                {form.date ? formatDateDisplay(parseDateFromForm(form.date)) : 'mm/dd/yyyy'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#555" />
            </Pressable>
          </View>
        </View>
        <View style={[styles.field, styles.rowItem]}>
          <Text style={styles.label}>Giờ</Text>
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={20} color="#888" style={styles.dateRowOuterIcon} />
            <Pressable
              onPress={openTimeModal}
              style={({ pressed }) => [styles.dateInputWrap, pressed && styles.dateInputWrapPressed]}
            >
              <Text
                style={form.time.trim() ? styles.dateInputText : styles.dateInputPlaceholder}
                numberOfLines={1}
              >
                {form.time.trim() ? form.time : 'Chọn giờ'}
              </Text>
              <Ionicons name="time-outline" size={18} color="#555" />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeader}>
          <Ionicons name="people-outline" size={26} color={PRIMARY} style={styles.settingsIcon} />
          <View style={styles.settingsHeaderText}>
            <Text style={styles.settingsTitle}>Cài Đặt Trận Đấu</Text>
            <Text style={styles.settingsSubtitle}>Số lượng người chơi và yêu cầu kỹ năng</Text>
          </View>
        </View>

        <Text style={styles.settingsBlockLabel}>Số Lượng Người Chơi Tối Đa</Text>
        <View style={styles.playerCountRow}>
          {PLAYER_COUNTS.map((n) => {
            const selected = form.maxPlayers === n;
            const isOther = n === 'Khác';
            return (
              <Pressable
                key={n}
                onPress={() => handlePlayerCountSelect(n)}
                style={({ pressed }) => [
                  styles.playerCountChip,
                  isOther ? styles.playerCountChipWide : styles.playerCountChipNum,
                  selected && styles.optionChipSelected,
                  pressed && !selected && styles.optionChipPressed,
                ]}
              >
                <Text style={[styles.playerCountText, selected && styles.optionChipTextSelected]}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {showPlayerOther ? (
          <View style={styles.playerOtherField}>
            <Text style={styles.label}>Nhập số người</Text>
            <TextInput
              placeholder="VD: 14, 18..."
              placeholderTextColor="#777"
              style={styles.input}
              keyboardType="number-pad"
              value={form.maxPlayersOther}
              onChangeText={(text) => handleChange('maxPlayersOther', text)}
            />
          </View>
        ) : null}

        <Text style={[styles.settingsBlockLabel, styles.settingsBlockLabelSpaced]}>
          Yêu Cầu Kỹ Năng Tối Thiểu
        </Text>
        <View style={styles.skillGrid}>
          {SKILL_LEVELS.map((level) => {
            const selected = form.minSkillLevel === level;
            return (
              <Pressable
                key={level}
                onPress={() => handleSkillSelect(level)}
                style={({ pressed }) => [
                  styles.skillChip,
                  selected && styles.optionChipSelected,
                  pressed && !selected && styles.optionChipPressed,
                ]}
              >
                <Text style={[styles.skillChipLabel, selected && styles.optionChipTextSelected]}>
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {showSkillOther ? (
          <View style={styles.skillOtherField}>
            <Text style={styles.label}>Nhập mức kỹ năng</Text>
            <TextInput
              placeholder="VD: Semi-pro, rating 1500..."
              placeholderTextColor="#777"
              style={styles.input}
              value={form.skillOther}
              onChangeText={(text) => handleChange('skillOther', text)}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mô tả</Text>
        <TextInput
          placeholder="Giới thiệu ngắn về trận đấu, mục tiêu, không khí..."
          placeholderTextColor="#777"
          style={[styles.input, styles.inputArea]}
          multiline
          value={form.description}
          onChangeText={(text) => handleChange('description', text)}
          onFocus={scrollMultilineIntoView}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Luật chơi & lưu ý</Text>
        <TextInput
          placeholder="Các luật riêng, yêu cầu trang phục, giờ check-in..."
          placeholderTextColor="#777"
          style={[styles.input, styles.inputArea]}
          multiline
          value={form.rules}
          onChangeText={(text) => handleChange('rules', text)}
          onFocus={scrollMultilineIntoView}
        />
      </View>

      {isEditMode ? (
        <View style={styles.resultSection}>
          <Text style={styles.resultTitle}>Kết thúc / Hủy trận đấu</Text>
          <Text style={styles.resultSubtitle}>
            Chỉ host mới có thể cập nhật kết quả. Người tham gia sẽ thấy trạng thái này ngay.
          </Text>

          {matchStatus === 'active' ? (
            <>
              <View style={styles.resultActionRow}>
                <Pressable
                  style={[
                    styles.resultActionBtn,
                    resultAction === 'finish' && styles.resultActionBtnSelected,
                  ]}
                  onPress={() => setResultAction('finish')}>
                  <Text style={styles.resultActionBtnText}>Đã xong</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.resultActionBtn,
                    resultAction === 'cancel' && styles.resultActionBtnSelected,
                  ]}
                  onPress={() => setResultAction('cancel')}>
                  <Text style={styles.resultActionBtnText}>Hủy trận</Text>
                </Pressable>
              </View>

              {resultAction === 'finish' ? (
                <View style={styles.resultInner}>
                  <Text style={styles.resultInnerTitle}>Chọn người thắng</Text>
                  {matchParticipants.length === 0 ? (
                    <Text style={styles.muted}>Chưa có người tham gia.</Text>
                  ) : (
                    <View style={styles.winnersGrid}>
                      {matchParticipants.map((p) => {
                        const selected = winnerIds.includes(p.id);
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => toggleWinner(p.id)}
                            style={({ pressed }) => [
                              styles.winnerPickCard,
                              selected && styles.winnerPickCardSelected,
                              pressed && { opacity: 0.85 },
                            ]}>
                            <Text style={styles.winnerPickName}>
                              {p.name || p.username || 'Người chơi'}
                            </Text>
                            <Ionicons
                              name={
                                selected ? 'checkmark-circle' : 'radio-button-off'
                              }
                              size={20}
                              color={selected ? '#ff4d4f' : '#888'}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <Text style={styles.resultHint}>
                    Đã chọn: {winnerIds.length}
                  </Text>
                  <Pressable
                    style={[styles.confirmBtn, resultSubmitting && styles.confirmBtnDisabled]}
                    onPress={confirmFinish}
                    disabled={resultSubmitting || matchParticipants.length === 0}>
                    <Text style={styles.confirmBtnText}>
                      {resultSubmitting ? 'Đang cập nhật...' : 'Xác nhận kết thúc'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {resultAction === 'cancel' ? (
                <View style={styles.resultInner}>
                  <Text style={styles.resultInnerTitle}>Nhập lý do hủy</Text>
                  <TextInput
                    style={[styles.input, styles.cancelReasonInput]}
                    value={cancelReasonDraft}
                    onChangeText={setCancelReasonDraft}
                    placeholder="VD: Trận bị mưa lớn, sân không đảm bảo..."
                    placeholderTextColor="#777"
                    multiline
                    onFocus={scrollMultilineIntoView}
                  />
                  <Pressable
                    style={[styles.confirmBtnDanger, resultSubmitting && styles.confirmBtnDisabled]}
                    onPress={confirmCancel}
                    disabled={resultSubmitting}>
                    <Text style={styles.confirmBtnText}>Xác nhận hủy</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : matchStatus === 'finished' ? (
            <View style={styles.resultReadonly}>
              <Text style={styles.resultInnerTitle}>Đã kết thúc</Text>
              <Text style={styles.bodyText}>
                {winnerIds.length > 0
                  ? winnerIds
                      .map(
                        (wid) =>
                          matchParticipants.find((p) => p.id === wid)?.name ||
                          matchParticipants.find((p) => p.id === wid)?.username ||
                          wid,
                      )
                      .join(', ')
                  : 'Chưa có người thắng.'}
              </Text>
            </View>
          ) : (
            <View style={styles.resultReadonly}>
              <Text style={styles.resultInnerTitle}>Đã hủy</Text>
              <Text style={styles.bodyText}>{cancelReasonDraft || '—'}</Text>
            </View>
          )}
        </View>
      ) : null}

      <Pressable
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>{isEditMode ? 'Lưu thay đổi' : 'Tạo trận đấu'}</Text>
        )}
      </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {AppAlertNode}
    </>
  );
}

const styles = StyleSheet.create({
  kavRoot: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  headerBtnText: {
    color: '#aaa',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 18,
  },
  sportSection: {
    marginBottom: 20,
  },
  sportOtherField: {
    marginTop: 14,
  },
  sportSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sportTrophyIcon: {
    marginRight: 12,
  },
  sportSectionHeaderText: {
    flex: 1,
  },
  sportSectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sportSectionSubtitle: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  sportChip: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportChipSelected: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderColor: PRIMARY,
  },
  sportChipPressed: {
    opacity: 0.85,
  },
  sportChipLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  sportChipLabelSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsIcon: {
    marginRight: 12,
  },
  settingsHeaderText: {
    flex: 1,
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingsSubtitle: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  settingsBlockLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  settingsBlockLabelSpaced: {
    marginTop: 18,
  },
  playerCountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerCountChip: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCountChipNum: {
    width: 44,
  },
  playerCountChipWide: {
    minWidth: 76,
    paddingHorizontal: 12,
  },
  playerOtherField: {
    marginTop: 12,
  },
  playerCountText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  skillChipLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  skillOtherField: {
    marginTop: 14,
  },
  optionChipSelected: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderColor: PRIMARY,
  },
  optionChipPressed: {
    opacity: 0.85,
  },
  optionChipTextSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: '#ddd',
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  inputArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateRowOuterIcon: {
    marginRight: 8,
  },
  dateInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  dateInputWrapPressed: {
    opacity: 0.85,
  },
  dateInputText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  dateInputPlaceholder: {
    color: '#777',
    fontSize: 13,
    flex: 1,
  },
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dateModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  dateModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  dateModalHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  timeModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignSelf: 'stretch',
  },
  timeModalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeModalSecondaryBtnText: {
    color: '#ccc',
    fontWeight: '600',
    fontSize: 15,
  },
  timeModalPrimaryBtnFlex: {
    flex: 1,
    marginTop: 0,
  },
  dateWebInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    marginBottom: 8,
  },
  dateModalBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateModalBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  resultSection: {
    marginTop: 18,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  resultSubtitle: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  resultActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultActionBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultActionBtnSelected: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
  },
  resultActionBtnText: {
    color: '#ddd',
    fontWeight: '700',
  },
  resultInner: {
    marginTop: 14,
  },
  resultInnerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  winnersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  winnerPickCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#111',
    marginBottom: 10,
  },
  winnerPickCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
  },
  winnerPickName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginRight: 8,
  },
  resultHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  cancelReasonInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDanger: {
    backgroundColor: '#884444',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.75,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  resultReadonly: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#111',
  },
  bodyText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  muted: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.75,
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

