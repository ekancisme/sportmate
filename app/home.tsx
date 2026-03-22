import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  fetchMatches,
  formatMatchListSubtitle,
  type ApiMatch,
} from "@/lib/matchApi";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type SuggestedPlayer = {
  id: string;
  name: string;
  sport: string;
  level: string;
  distance: number | string | null;
  winRate: number;
  bio?: string;
  age?: number;
  location?: string;
  avatar?: string;
};

const SUGGESTED_PLAYERS: SuggestedPlayer[] = [
  {
    id: "p1",
    name: "Minh Trần",
    sport: "Football",
    level: "Intermediate",
    distance: "1.2 km",
    winRate: 61,
  },
  {
    id: "p2",
    name: "Lan Nguyễn",
    sport: "Badminton",
    level: "Advanced",
    distance: "2.5 km",
    winRate: 74,
  },
  {
    id: "p3",
    name: "Hoàng Lê",
    sport: "Tennis",
    level: "Beginner",
    distance: "3.1 km",
    winRate: 48,
  },
  {
    id: "p4",
    name: "Phạm Thị C",
    sport: "Cầu Lông",
    level: "Trung bình",
    distance: "1.8 km",
    winRate: 55,
  },
  {
    id: "p5",
    name: "Đỗ Văn D",
    sport: "Bóng đá",
    level: "Cao",
    distance: "0.9 km",
    winRate: 68,
  },
  {
    id: "p6",
    name: "Ngô Thị E",
    sport: "Chạy bộ",
    level: "Sơ cấp",
    distance: "2.2 km",
    winRate: 42,
  },
  {
    id: "p7",
    name: "Vũ Minh F",
    sport: "Bóng rổ",
    level: "Trung bình",
    distance: "3.0 km",
    winRate: 59,
  },
  {
    id: "p8",
    name: "Trần Hải G",
    sport: "Pickleball",
    level: "Advanced",
    distance: "1.5 km",
    winRate: 71,
  },
  {
    id: "p9",
    name: "Lê Thu H",
    sport: "Yoga",
    level: "Tất cả",
    distance: "2.8 km",
    winRate: 52,
  },
];

const PARTNERS_PER_PAGE = 1;

function chunkPlayers<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const partnerPageWidth = windowWidth - 40;
  const partnerPages = useMemo(
    () => chunkPlayers(SUGGESTED_PLAYERS, PARTNERS_PER_PAGE),
    [],
  );
  const [partnerPageIndex, setPartnerPageIndex] = useState(0);

  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    setMatchesError(null);
    try {
      const list = await fetchMatches();
      setMatches(list);
    } catch (e) {
      setMatchesError(e instanceof Error ? e.message : "Không tải được trận");
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [loadMatches]),
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      nestedScrollEnabled
    >
      <View style={styles.headerSpacer} />

      <View style={styles.heroCard}>
        <Text style={styles.badge}>Welcome to</Text>
        <Text style={styles.logo}>SportMate</Text>
        <Text style={styles.title}>Tìm đồng đội thể thao dễ dàng.</Text>
        <Text style={styles.subtitle}>
          Khởi động nhanh một trận đấu mới hoặc khám phá các trận đang diễn ra
          xung quanh bạn.
        </Text>

        <View style={styles.heroButtons}>
          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => router.push("/match/create-match")}
          >
            <Text style={styles.buttonPrimaryText}>Tạo trận đấu</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonGhost]}
            onPress={() => router.push("/ranking")}
          >
            <Text style={styles.buttonGhostText}>Xem bảng xếp hạng</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Trận tuần này</Text>
          <Text style={styles.statValue}>24</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Đồng đội quanh bạn</Text>
          <Text style={styles.statValue}>{SUGGESTED_PLAYERS.length || "..."}</Text>
        </View>
      </View>

      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickCard}
          onPress={() => router.push("/my-profile")}
        >
          <Text style={styles.quickTitle}>Hồ sơ của bạn</Text>
          <Text style={styles.quickSubtitle}>
            Cập nhật môn thể thao và lịch tập
          </Text>
        </Pressable>
        <Pressable
          style={styles.quickCard}
          onPress={() => router.push("/match")}
        >
          <Text style={styles.quickTitle}>Trận nổi bật</Text>
          <Text style={styles.quickSubtitle}>
            Xem chi tiết các trận đang mở
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Những partner tuyệt vời</Text>
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          style={[styles.partnerPager, { width: partnerPageWidth }]}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const page = Math.round(x / partnerPageWidth);
            const last = partnerPages.length - 1;
            setPartnerPageIndex(Math.min(Math.max(0, page), last));
          }}
        >
          {partnerPages.map((page, pageIdx) => (
            <View
              key={`partner-page-${pageIdx}`}
              style={[styles.partnerPage, { width: partnerPageWidth }]}
            >
              {page.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.partnerCard}
                  onPress={() =>
                    router.push({ pathname: "/profile", params: { id: p.id } })
                  }
                >
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.partnerAvatarText}>
                      {p.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.partnerMain}>
                    <Text style={styles.partnerName}>{p.name}</Text>
                    <Text style={styles.partnerMeta}>
                      {p.sport} • {p.level}
                    </Text>
                    <View style={styles.partnerChipsRow}>
                      <View style={styles.partnerChip}>
                        <Text style={styles.partnerChipText}>
                          {p.distance} gần bạn
                        </Text>
                      </View>
                      <View
                        style={[styles.partnerChip, styles.partnerChipGhost]}
                      >
                        <Text style={styles.partnerChipGhostText}>
                          Win rate {p.winRate}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
        {partnerPages.length > 1 ? (
          <View style={styles.partnerDots}>
            {partnerPages.map((_, i) => (
              <View
                key={`partner-dot-${i}`}
                style={[
                  styles.partnerDot,
                  i === partnerPageIndex && styles.partnerDotActive,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trận đấu sắp diễn ra</Text>
        {matchesLoading ? (
          <View style={styles.matchesLoading}>
            <ActivityIndicator color="#ff4d4f" />
            <Text style={styles.matchesLoadingText}>Đang tải...</Text>
          </View>
        ) : matchesError ? (
          <View style={styles.matchesErrorBox}>
            <Text style={styles.matchesErrorText}>{matchesError}</Text>
            <Pressable style={styles.matchesRetry} onPress={loadMatches}>
              <Text style={styles.matchesRetryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : matches.length === 0 ? (
          <Text style={styles.matchesEmpty}>
            Chưa có trận nào. Tạo trận mới để bắt đầu.
          </Text>
        ) : (
          matches.map((m) => {
            const cur = Number(m.currentPlayers ?? 0);
            const playersStr = `${cur}/${m.maxPlayers}`;
            return (
              <Pressable
                key={m.id}
                style={styles.matchCard}
                onPress={() =>
                  router.push({ pathname: "/match", params: { id: m.id } })
                }
              >
                <View style={styles.matchHeaderRow}>
                  <Text style={styles.matchTitle}>{m.title}</Text>
                  <Text style={styles.matchSport}>{m.sport}</Text>
                </View>
                <Text style={styles.matchMeta}>{m.location}</Text>
                <Text style={styles.matchMeta}>
                  {formatMatchListSubtitle(m)}
                </Text>
                <Text style={styles.matchPlayers}>
                  Người chơi: {playersStr}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 120,
  },
  headerSpacer: {
    height: 8,
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#101010",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: 20,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ff4d4f33",
    color: "#ffb3b3",
    fontSize: 11,
    marginBottom: 6,
  },
  logo: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ff4d4f",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#bbbbbb",
    marginBottom: 18,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#ff4d4f",
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: "#ff4d4f",
  },
  buttonGhostText: {
    color: "#ff4d4f",
    fontWeight: "600",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statLabel: {
    color: "#aaaaaa",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#111111",
  },
  quickTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  quickSubtitle: {
    color: "#aaaaaa",
    fontSize: 12,
  },
  section: {
    marginTop: 20,
    gap: 10,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  partnerPager: {
    alignSelf: "center",
  },
  partnerPage: {
    gap: 10,
    paddingBottom: 4,
  },
  partnerDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  partnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#444",
  },
  partnerDotActive: {
    backgroundColor: "#ff4d4f",
    width: 18,
  },
  partnerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111111",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff4d4f22",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerAvatarText: {
    color: "#ff4d4f",
    fontWeight: "700",
  },
  partnerMain: {
    flex: 1,
  },
  partnerName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  partnerMeta: {
    color: "#aaaaaa",
    fontSize: 12,
  },
  partnerChipsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  partnerChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ff4d4f",
  },
  partnerChipText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  partnerChipGhost: {
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#ff4d4f55",
  },
  partnerChipGhostText: {
    color: "#ffb3b3",
    fontSize: 11,
    fontWeight: "500",
  },
  // Swipe card styles
  sectionSubtitle: {
    color: "#888888",
    fontSize: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  swipeContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  swipeCard: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: "#111111",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
    position: "relative",
    overflow: "hidden",
  },
  likeIndicator: {
    position: "absolute",
    top: 30,
    left: 20,
    backgroundColor: "#4ade80",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    transform: [{ rotate: "-15deg" }],
    zIndex: 10,
  },
  likeText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 18,
  },
  skipIndicator: {
    position: "absolute",
    top: 30,
    right: 20,
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    transform: [{ rotate: "15deg" }],
    zIndex: 10,
  },
  skipText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 18,
  },
  swipeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ff4d4f33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#ff4d4f44",
  },
  swipeAvatarText: {
    color: "#ff4d4f",
    fontWeight: "800",
    fontSize: 40,
  },
  swipeName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  swipeMeta: {
    color: "#bbbbbb",
    fontSize: 14,
    marginBottom: 12,
  },
  swipeBio: {
    color: "#cccccc",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  swipeLocation: {
    color: "#888888",
    fontSize: 12,
    marginTop: 8,
  },
  swipeChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  progressDots: {
    flexDirection: "row",
    marginTop: 20,
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333333",
  },
  progressDotActive: {
    backgroundColor: "#ff4d4f",
    width: 24,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 24,
    marginTop: 20,
  },
  actionButtonSkip: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#333333",
  },
  actionButtonSkipText: {
    color: "#666666",
    fontSize: 24,
    fontWeight: "600",
  },
  actionButtonLike: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ff4d4f22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ff4d4f",
  },
  actionButtonLikeText: {
    color: "#ff4d4f",
    fontSize: 26,
  },
  likeStats: {
    marginTop: 12,
  },
  likeStatsText: {
    color: "#666666",
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#888888",
    fontSize: 14,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: "#ff4d4f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  resetButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  loadingCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  loadingText: {
    color: "#888888",
    fontSize: 14,
    marginTop: 16,
  },
  errorCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  errorTitle: {
    color: "#ff4d4f",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    color: "#888888",
    fontSize: 13,
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#ff4d4f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  moreCount: {
    color: "#666666",
    fontSize: 11,
    marginLeft: 8,
    alignSelf: "center",
  },
  matchCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  matchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  matchTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  matchSport: {
    color: "#ffb3b3",
    fontSize: 12,
    fontWeight: "500",
  },
  matchMeta: {
    color: "#aaaaaa",
    fontSize: 12,
  },
  matchPlayers: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "500",
  },
  matchesLoading: {
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  matchesLoadingText: {
    color: "#888",
    fontSize: 13,
  },
  matchesErrorBox: {
    paddingVertical: 8,
  },
  matchesErrorText: {
    color: "#ff8888",
    fontSize: 13,
    marginBottom: 10,
  },
  matchesRetry: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ff4d4f",
  },
  matchesRetryText: {
    color: "#ff4d4f",
    fontSize: 13,
    fontWeight: "600",
  },
  matchesEmpty: {
    color: "#888",
    fontSize: 13,
    lineHeight: 20,
  },
});
