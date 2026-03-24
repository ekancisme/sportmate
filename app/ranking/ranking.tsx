import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '@/lib/apiBase';

// ─── Types ────────────────────────────────────────────────────────────────────
type RankEntry = {
  id: string;
  name: string;
  avatar: string | null;
  location: string;
  sport: string | null;
  level: string | null;
  matchesWon: number;
  matchesPlayed: number;
  winRate: number;
  hoursActive: number;
};

// ─── Colour tokens ────────────────────────────────────────────────────────────
const PRIMARY  = '#ff4d4f';
const GOLD     = '#f59e0b';
const SILVER   = '#94a3b8';
const BRONZE   = '#cd7c3a';
const BG       = '#050505';
const CARD     = '#0f0f0f';
const CARD2    = '#141414';
const BORDER   = '#1f1f1f';
const TEXT     = '#ffffff';
const MUTED    = '#777777';

const MEDAL_COLORS = [GOLD, SILVER, BRONZE];
const MEDAL_LABELS = ['🥇', '🥈', '🥉'];
const RANK_BG = [
  'rgba(245,158,11,0.08)',
  'rgba(148,163,184,0.06)',
  'rgba(205,124,58,0.06)',
];

function resolveAvatar(avatar: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${getApiBaseUrl()}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RankingScreen() {
  const insets = useSafeAreaInsets();

  const [data, setData]         = useState<RankEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh]= useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Trophy pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fetchRanking = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefresh(true);
      else setLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/api/users/ranking`);
      if (!res.ok) throw new Error('Không tải được bảng xếp hạng');
      const json: RankEntry[] = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  };

  useEffect(() => { fetchRanking(); }, []);

  const top3 = data.slice(0, 3);
  const rest  = data.slice(3);

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={PRIMARY} size="large" />
        <Text style={styles.loadingText}>Đang tải bảng xếp hạng...</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={56} color="#333" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.75 }]}
          onPress={() => fetchRanking()}>
          <Text style={styles.retryBtnText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="trophy-outline" size={56} color="#333" />
        <Text style={styles.emptyText}>Chưa có dữ liệu xếp hạng</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchRanking(true)}
          tintColor={PRIMARY}
          colors={[PRIMARY]}
        />
      }
      showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.pageHeader}>
        {/* Trophy icon with pulse */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={styles.trophyIconBox}>
            <Ionicons name="trophy" size={46} color={GOLD} />
          </View>
        </Animated.View>

        {/* Season badge */}
        <View style={styles.badgePill}>
          <Ionicons name="star" size={9} color="#ffb3b3" />
          <Text style={styles.badgePillText}>Season 2026</Text>
          <Ionicons name="star" size={9} color="#ffb3b3" />
        </View>

        <Text style={styles.pageTitle}>Bảng Xếp Hạng</Text>
        <Text style={styles.pageSubtitle}>
          Sắp xếp theo số trận thắng · tỉ lệ thắng
        </Text>

        {/* Divider with glow */}
        <View style={styles.headerDivider}>
          <View style={styles.headerDividerLine} />
          <View style={styles.headerDividerDot} />
          <View style={styles.headerDividerLine} />
        </View>

        {/* Criteria pills */}
        <View style={styles.legendRow}>
          <View style={styles.legendPill}>
            <Ionicons name="trophy" size={12} color={GOLD} />
            <Text style={styles.legendPillText}>Số trận thắng</Text>
          </View>
          <View style={styles.legendPill}>
            <Ionicons name="trending-up-outline" size={12} color={PRIMARY} />
            <Text style={styles.legendPillText}>Tỉ lệ thắng</Text>
          </View>
          <View style={styles.legendPill}>
            <Ionicons name="people-outline" size={12} color={MUTED} />
            <Text style={[styles.legendPillText, { color: MUTED }]}>Số trận</Text>
          </View>
        </View>
      </View>

      {/* ── Podium (top 3) ── */}
      {top3.length > 0 && (
        <View style={styles.podiumSection}>
          <Text style={styles.sectionLabel}>Top 3 Người Chơi</Text>
          {top3.map((p, i) => (
            <PodiumCard
              key={p.id}
              rank={i + 1}
              entry={p}
              onPress={() => router.push({ pathname: '/profile', params: { id: p.id } })}
            />
          ))}
        </View>
      )}

      {/* ── Rest of leaderboard ── */}
      {rest.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Bảng Xếp Hạng</Text>
          {rest.map((p, i) => (
            <LeaderRow
              key={p.id}
              rank={i + 4}
              entry={p}
              onPress={() => router.push({ pathname: '/profile', params: { id: p.id } })}
            />
          ))}
        </View>
      )}

    </ScrollView>
  );
}

// ─── Podium card (rank 1-3) ───────────────────────────────────────────────────
function PodiumCard({
  rank,
  entry,
  onPress,
}: {
  rank: number;
  entry: RankEntry;
  onPress: () => void;
}) {
  const mc   = MEDAL_COLORS[rank - 1];
  const bg   = RANK_BG[rank - 1];
  const init = entry.name.charAt(0).toUpperCase();
  const avatarUri = resolveAvatar(entry.avatar);

  return (
    <Pressable
      style={({ pressed }) => [styles.podiumCard, { backgroundColor: bg, borderColor: mc + '44' }, pressed && styles.pressed]}
      onPress={onPress}>
      {/* Left ribbon */}
      <View style={[styles.podiumRibbon, { backgroundColor: mc }]} />

      {/* Medal */}
      <Text style={styles.podiumMedal}>{MEDAL_LABELS[rank - 1]}</Text>

      {/* Avatar */}
      <View style={[styles.podiumAvatar, { borderColor: mc + '88' }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
        ) : (
          <Text style={[styles.avatarInitial, { color: mc }]}>{init}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.podiumInfo}>
        <Text style={styles.podiumName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.podiumSub} numberOfLines={1}>
          {entry.sport ?? 'Nhiều môn'}
          {entry.location ? ` · ${entry.location}` : ''}
        </Text>
        <View style={styles.podiumStats}>
          <StatChip icon="trophy" value={`${entry.matchesWon} thắng`} color={mc} />
          <StatChip icon="pulse-outline" value={`${entry.winRate}%`} color={PRIMARY} />
          <StatChip icon="game-controller-outline" value={`${entry.matchesPlayed} trận`} color={MUTED} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={MUTED} style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

// ─── Leaderboard row (rank 4+) ───────────────────────────────────────────────
function LeaderRow({
  rank,
  entry,
  onPress,
}: {
  rank: number;
  entry: RankEntry;
  onPress: () => void;
}) {
  const init = entry.name.charAt(0).toUpperCase();
  const avatarUri = resolveAvatar(entry.avatar);

  return (
    <Pressable
      style={({ pressed }) => [styles.leadRow, pressed && styles.pressed]}
      onPress={onPress}>
      {/* Rank number */}
      <Text style={styles.leadRank}>#{rank}</Text>

      {/* Avatar */}
      <View style={styles.leadAvatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.leadAvatarText}>{init}</Text>
        )}
      </View>

      {/* Name + sport */}
      <View style={styles.leadInfo}>
        <Text style={styles.leadName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.leadSub} numberOfLines={1}>
          {entry.sport ?? 'Nhiều môn'}
          {entry.winRate > 0 ? ` · ${entry.winRate}% thắng` : ''}
        </Text>
      </View>

      {/* Win count badge */}
      <View style={styles.winBadge}>
        <Text style={styles.winBadgeVal}>{entry.matchesWon}</Text>
        <Text style={styles.winBadgeLabel}>thắng</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color="#333" />
    </Pressable>
  );
}

// ─── Micro component ──────────────────────────────────────────────────────────
function StatChip({
  icon,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.statChipText, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content:   { paddingHorizontal: 16, paddingBottom: 120 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  pressed:   { opacity: 0.76 },

  // loading / error
  loadingText: { color: MUTED, fontSize: 14 },
  errorText:   { color: '#f87171', fontSize: 14, textAlign: 'center' },
  emptyText:   { color: MUTED, fontSize: 14 },
  retryBtn: {
    paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: 999, borderWidth: 1.5, borderColor: PRIMARY,
  },
  retryBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },

  // page header — căn giữa, có trophy + glow
  pageHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: `${GOLD}22`,
    overflow: 'hidden',
    position: 'relative',
  },
  trophyIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${GOLD}18`,
    borderWidth: 2,
    borderColor: `${GOLD}55`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
    borderColor: `${PRIMARY}55`,
    backgroundColor: `${PRIMARY}12`,
    marginBottom: 10,
  },
  badgePillText: { color: '#ffb3b3', fontSize: 11, fontWeight: '700' },
  pageTitle: {
    color: TEXT, fontSize: 26, fontWeight: '900',
    letterSpacing: 0.5, textAlign: 'center',
    marginBottom: 4,
  },
  pageSubtitle: { color: MUTED, fontSize: 12, textAlign: 'center' },

  // header divider
  headerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 14,
    paddingHorizontal: 10,
    gap: 8,
  },
  headerDividerLine: { flex: 1, height: 1, backgroundColor: `${GOLD}33` },
  headerDividerDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },

  // criteria legend pills
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  legendPillText: { color: '#ffb3b3', fontSize: 11, fontWeight: '600' },
  // (keep old keys as aliases so PodiumCard/LeaderRow don't break)
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { color: MUTED, fontSize: 11 },
  legendDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: '#333' },

  // section label
  sectionLabel: {
    color: MUTED, fontSize: 12, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 10,
  },
  podiumSection: { marginBottom: 20, gap: 10 },
  listSection:   { gap: 8 },

  // podium card
  podiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 10,
  },
  podiumRibbon: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  podiumMedal: { fontSize: 20, width: 28, textAlign: 'center' },
  podiumAvatar: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  podiumInfo:  { flex: 1, gap: 3 },
  podiumName:  { color: TEXT, fontSize: 15, fontWeight: '700' },
  podiumSub:   { color: MUTED, fontSize: 12 },
  podiumStats: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },

  // stat chip
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999, backgroundColor: CARD2,
  },
  statChipText: { fontSize: 11, fontWeight: '600' },

  // leaderboard row
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  leadRank: { color: MUTED, fontSize: 13, fontWeight: '700', width: 28 },
  leadAvatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: `${PRIMARY}15`,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  leadAvatarText: { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  leadInfo: { flex: 1, gap: 2 },
  leadName: { color: TEXT, fontSize: 14, fontWeight: '600' },
  leadSub:  { color: MUTED, fontSize: 12 },
  winBadge: {
    alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: `${PRIMARY}18`,
    borderWidth: 1,
    borderColor: `${PRIMARY}33`,
    minWidth: 52,
  },
  winBadgeVal:   { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  winBadgeLabel: { color: PRIMARY, fontSize: 9, fontWeight: '600', marginTop: 1 },

  // shared avatar
  avatarImg:     { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 20, fontWeight: '800' },
});
