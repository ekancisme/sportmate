import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchUserById, type ApiUser } from '@/lib/userApi';

// ─── Design tokens (đồng bộ màu chủ đạo app) ────────────────────────────────
const PRIMARY  = '#ff4d4f';
const PRIMARY2 = '#ff6b6b';
const BG       = '#050505';
const HEADER   = '#100808';          // nền banner — tối ấm hơn BG
const CARD     = '#0f0f0f';
const CARD2    = '#141414';
const BORDER   = '#1f1f1f';
const TEXT     = '#ffffff';
const MUTED    = '#777777';
const TEAL     = '#2dd4c0';          // accent phụ cho lịch trình
const EMPTY    = '#3a3a3a';

// ─── Level badge colour ──────────────────────────────────────────────────────
function levelColor(level = ''): string {
  const l = level.toLowerCase();
  if (l.includes('cao') || l.includes('advanced') || l.includes('chuyên')) return '#f59e0b';
  if (l.includes('trung') || l.includes('intermediate')) return '#38bdf8';
  return '#6b7280';
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [user, setUser]           = useState<ApiUser | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Không có ID người dùng');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchUserById(id);
        if (!cancelled) setUser(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Không tải được thông tin');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── TopBar ──
  function TopBar({ showFav = false }: { showFav?: boolean }) {
    return (
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={PRIMARY2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Hồ Sơ Người Chơi</Text>
        {showFav ? (
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={() => setFavorited((v) => !v)}>
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={21}
              color={favorited ? PRIMARY : '#aaa'}
            />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <TopBar />
        <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 60 }} />
        <Text style={styles.hintText}>Đang tải hồ sơ...</Text>
      </View>
    );
  }

  // ── Error ──
  if (error || !user) {
    return (
      <View style={styles.container}>
        <TopBar />
        <View style={styles.centerBlock}>
          <Ionicons name="person-remove-outline" size={72} color={EMPTY} />
          <Text style={styles.errorText}>{error ?? 'Không tìm thấy người dùng'}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Quay lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Derived ──
  const initials     = user.name?.charAt(0)?.toUpperCase() ?? '?';
  const hasSports    = (user.sports && user.sports.length > 0) || !!user.sport;
  const sportsToShow = user.sports && user.sports.length > 0
    ? user.sports
    : user.sport
      ? [{ name: user.sport, level: user.level ?? '' }]
      : [];
  const scheduleList = (user.schedule ?? []).filter((s) => !s.matchId);

  return (
    <View style={styles.container}>
      {/* ══ Banner header - layout ngang (khác my-profile dùng card căn giữa) ══ */}
      <View style={styles.banner}>
        <TopBar showFav />

        <View style={styles.bannerBody}>
          {/* Avatar hình vuông bo góc + viền gradient đỏ */}
          <View style={styles.avatarFrame}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Info bên phải */}
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerName} numberOfLines={1}>{user.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={MUTED} />
              <Text style={styles.locationText}>
                {user.location?.trim() || 'Chưa cập nhật vị trí'}
              </Text>
            </View>
            {/* Quick sport chips */}
            {sportsToShow.length > 0 && (
              <View style={styles.miniChipRow}>
                {sportsToShow.slice(0, 2).map((s, i) => (
                  <View key={i} style={styles.miniChip}>
                    <Text style={styles.miniChipText}>{s.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Nút hành động: Nhắn Tin + Yêu Thích ── */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.msgBtn, pressed && styles.pressed]}
            onPress={() =>
              Alert.alert('Nhắn Tin', `Chức năng nhắn tin với ${user.name} sẽ sớm ra mắt!`)
            }>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />
            <Text style={styles.msgBtnText}>Nhắn Tin</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.favBtn,
              favorited && styles.favBtnActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setFavorited((v) => !v)}>
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={17}
              color={favorited ? '#fff' : PRIMARY}
            />
            <Text style={[styles.favBtnText, favorited && styles.favBtnTextActive]}>
              {favorited ? 'Đã Yêu Thích' : 'Yêu Thích'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ══ Scrollable body ══ */}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>

        {/* ── Bio ── */}
        <InfoBlock icon="chatbubble-outline" title="Giới Thiệu">
          <Text style={user.bio?.trim() ? styles.bioText : styles.emptyText}>
            {user.bio?.trim() || 'Chưa cập nhật giới thiệu bản thân.'}
          </Text>
        </InfoBlock>

        {/* ── Thống kê dạng lưới 2×2 (khác my-profile dùng row 4 ô ngang) ── */}
        <View style={styles.statsGrid}>
          <StatBox icon="trophy-outline"       label="Trận Đã Chơi" value={String(user.matchesPlayed ?? 0)} />
          <StatBox icon="flash-outline"         label="Tỷ Lệ Thắng"  value={`${user.winRate ?? 0}%`} />
          <StatBox icon="time-outline"          label="Giờ Hoạt Động" value={String(user.hoursActive ?? 0)} />
          <StatBox icon="people-circle-outline" label="Người Theo Dõi" value={String(user.followers ?? 0)} />
        </View>

        {/* ── Môn thể thao ── (luôn hiện) */}
        <InfoBlock icon="barbell-outline" title="Môn Thể Thao">
          {!hasSports ? (
            <EmptyState label="Chưa cập nhật môn thể thao" />
          ) : (
            sportsToShow.map((s, i) => (
              <View key={i} style={styles.sportRow}>
                <View style={styles.sportLeft}>
                  <View style={[styles.sportDot, { backgroundColor: levelColor(s.level) }]} />
                  <Text style={styles.sportName}>{s.name}</Text>
                </View>
                <View style={[
                  styles.levelBadge,
                  { backgroundColor: levelColor(s.level) + '1a', borderColor: levelColor(s.level) + '55' },
                ]}>
                  <Text style={[styles.levelBadgeText, { color: levelColor(s.level) }]}>
                    {s.level || 'Chưa rõ'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </InfoBlock>

        {/* ── Lịch trình ── (luôn hiện, timeline style) */}
        <InfoBlock icon="calendar-outline" title="Lịch Trình">
          {scheduleList.length === 0 ? (
            <EmptyState label="Chưa cập nhật lịch trình" />
          ) : (
            scheduleList.map((s, i) => (
              <View key={i} style={styles.schedRow}>
                {/* Cột thời gian bên trái */}
                <View style={styles.schedTime}>
                  <Text style={styles.schedDay}>{s.day || '—'}</Text>
                  <Text style={styles.schedHour}>{s.time || ''}</Text>
                </View>
                {/* Đường kẻ + chấm (timeline) */}
                <View style={styles.timelineCol}>
                  <View style={styles.timelineDot} />
                  {i < scheduleList.length - 1 && <View style={styles.timelineLine} />}
                </View>
                {/* Hoạt động */}
                <View style={styles.schedContent}>
                  <Text style={styles.schedActivity}>{s.activity || '—'}</Text>
                </View>
              </View>
            ))
          )}
        </InfoBlock>

        {/* ── Liên hệ ── (luôn hiện, gợi ý bảo mật) */}
        <InfoBlock icon="mail-outline" title="Liên Hệ">
          <View style={styles.contactRow}>
            <Ionicons name="lock-closed-outline" size={14} color={MUTED} />
            <Text style={styles.contactText}>
              Thông tin liên hệ được bảo mật. Hãy dùng nút{' '}
              <Text style={{ color: PRIMARY, fontWeight: '600' }}>Nhắn Tin</Text> để kết nối.
            </Text>
          </View>
        </InfoBlock>

      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBlock({
  icon,
  title,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.infoBlock}>
      <View style={styles.infoBlockHeader}>
        <Ionicons name={icon} size={15} color={PRIMARY} />
        <Text style={styles.infoBlockTitle}>{title}</Text>
      </View>
      <View style={styles.infoBlockBody}>{children}</View>
    </View>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={PRIMARY} style={{ marginBottom: 5 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="alert-circle-outline" size={16} color={EMPTY} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  pressed:   { opacity: 0.75 },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },

  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 0,       // override bằng insets.top + 6 ở runtime
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topBarTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1a1010',
    borderWidth: 1,
    borderColor: '#2a1515',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // banner (màu tối ấm, layout ngang — khác my-profile căn giữa)
  banner: {
    backgroundColor: HEADER,
    borderBottomWidth: 1,
    borderBottomColor: '#1e0e0e',
    paddingBottom: 16,
  },
  bannerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 14,
  },
  // Avatar VUÔNG (my-profile dùng tròn)
  avatarFrame: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: `${PRIMARY}77`,
  },
  avatarImg:      { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#1e0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: PRIMARY, fontSize: 30, fontWeight: '800' },
  bannerInfo:    { flex: 1, gap: 4 },
  bannerName:    { color: TEXT, fontSize: 20, fontWeight: '800' },
  locationRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText:  { color: MUTED, fontSize: 12 },
  miniChipRow:   { flexDirection: 'row', gap: 6, marginTop: 4 },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}18`,
    borderWidth: 1,
    borderColor: `${PRIMARY}44`,
  },
  miniChipText: { color: PRIMARY2, fontSize: 10, fontWeight: '600' },

  // action buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  msgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 11,
  },
  msgBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  favBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    backgroundColor: 'transparent',
  },
  favBtnActive:     { backgroundColor: PRIMARY, borderColor: PRIMARY },
  favBtnText:       { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  favBtnTextActive: { color: '#fff' },

  // scroll body
  body: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 100, gap: 12 },

  // bio
  bioText: { color: '#cccccc', fontSize: 13, lineHeight: 20 },

  // stats grid 2×2 (khác my-profile dùng 4 ô hàng ngang)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '47.5%',
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statValue: { color: TEXT, fontSize: 20, fontWeight: '800' },
  statLabel: { color: MUTED, fontSize: 11, marginTop: 3, textAlign: 'center' },

  // info block
  infoBlock: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  infoBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD2,
  },
  infoBlockTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  infoBlockBody:  { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },

  // empty state
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyText:  { color: EMPTY, fontSize: 13, fontStyle: 'italic' },

  // sports
  sportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181818',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  sportLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sportDot:  { width: 8, height: 8, borderRadius: 4 },
  sportName: { color: TEXT, fontSize: 14, fontWeight: '600' },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  levelBadgeText: { fontSize: 11, fontWeight: '700' },

  // schedule (timeline style)
  schedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
    minHeight: 42,
  },
  schedTime: {
    width: 72,
    paddingTop: 2,
    alignItems: 'flex-end',
    paddingRight: 12,
    gap: 2,
  },
  schedDay:  { color: PRIMARY2, fontSize: 11, fontWeight: '700' },
  schedHour: { color: TEAL,    fontSize: 11 },
  timelineCol: { width: 20, alignItems: 'center', paddingTop: 4 },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    borderWidth: 1.5,
    borderColor: '#500',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: `${PRIMARY}33`,
    marginTop: 2,
    minHeight: 28,
  },
  schedContent: { flex: 1, paddingLeft: 12, paddingTop: 2 },
  schedActivity: { color: TEXT, fontSize: 13, fontWeight: '500', lineHeight: 19 },

  // contact
  contactRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  contactText: { flex: 1, color: MUTED, fontSize: 13, lineHeight: 19 },

  // loading / error
  hintText:     { color: MUTED, fontSize: 14, marginTop: 14 },
  errorText:    { color: '#f87171', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  retryBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
});
