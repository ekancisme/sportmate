import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

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

type UpcomingMatch = {
  id: string;
  title: string;
  sport: string;
  location: string;
  time: string;
  players: string;
};

// Mock data for upcoming matches (có thể thay bằng API sau)
const UPCOMING_MATCHES: UpcomingMatch[] = [
  {
    id: "m1",
    title: "Giao hữu bóng đá tối thứ 6",
    sport: "Football",
    location: "Sân Hoa Lư, Quận 1",
    time: "20:00 hôm nay",
    players: "14/20",
  },
  {
    id: "m2",
    title: "Cầu lông sáng cuối tuần",
    sport: "Badminton",
    location: "CLB Cầu Lông Phú Nhuận",
    time: "09:00 Thứ 7",
    players: "6/8",
  },
  {
    id: "m3",
    title: "Pick-up basketball",
    sport: "Basketball",
    location: "Sân ngoài trời Thảo Điền",
    time: "18:30 Thứ 5",
    players: "8/10",
  },
];

export default function HomeScreen() {
  const { fetchSuggestedPartners, user } = useAuth();
  const [partners, setPartners] = useState<SuggestedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const [likedPartners, setLikedPartners] = useState<Set<string>>(new Set());
  const [skippedPartners, setSkippedPartners] = useState<Set<string>>(new Set());

  // Fetch partners từ API khi component mount
  useEffect(() => {
    loadPartners();
  }, [user]);

  const loadPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSuggestedPartners({ maxDistance: 10, limit: 20 });
      if (result.partners.length > 0) {
        setPartners(result.partners);
      } else {
        setError("Không có partner nào gần bạn");
      }
    } catch (err) {
      console.error("Failed to load partners:", err);
      setError("Không thể tải danh sách partner");
    } finally {
      setLoading(false);
    }
  };

  const visiblePartners = partners.filter(
    (p) => !likedPartners.has(p.id) && !skippedPartners.has(p.id)
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        swipeAnim.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right - like
          Animated.spring(swipeAnim, {
            toValue: SCREEN_WIDTH + 100,
            useNativeDriver: true,
          }).start(() => {
            if (visiblePartners[currentIndex]) {
              setLikedPartners((prev) => new Set([...prev, visiblePartners[currentIndex].id]));
            }
            swipeAnim.setValue(0);
            setCurrentIndex((prev) => prev + 1);
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left - skip
          Animated.spring(swipeAnim, {
            toValue: -SCREEN_WIDTH - 100,
            useNativeDriver: true,
          }).start(() => {
            if (visiblePartners[currentIndex]) {
              setSkippedPartners((prev) => new Set([...prev, visiblePartners[currentIndex].id]));
            }
            swipeAnim.setValue(0);
            setCurrentIndex((prev) => prev + 1);
          });
        } else {
          // Return to center
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const rotateCard = swipeAnim.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-10deg", "0deg", "10deg"],
  });

  const likeOpacity = swipeAnim.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
  });

  const skipOpacity = swipeAnim.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
  });

  const currentPartner = visiblePartners[0];

  const handleLike = () => {
    Animated.timing(swipeAnim, {
      toValue: SCREEN_WIDTH + 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (currentPartner) {
        setLikedPartners((prev) => new Set([...prev, currentPartner.id]));
      }
      swipeAnim.setValue(0);
      setCurrentIndex((prev) => prev + 1);
    });
  };

  const handleSkip = () => {
    Animated.timing(swipeAnim, {
      toValue: -SCREEN_WIDTH - 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (currentPartner) {
        setSkippedPartners((prev) => new Set([...prev, currentPartner.id]));
      }
      swipeAnim.setValue(0);
      setCurrentIndex((prev) => prev + 1);
    });
  };

  const resetAll = () => {
    setLikedPartners(new Set());
    setSkippedPartners(new Set());
    setCurrentIndex(0);
    loadPartners();
  };

  // Format distance để hiển thị
  const formatDistance = (distance: number | string | null): string => {
    if (distance === null || distance === undefined) return "Không xác định";
    const numDist = typeof distance === 'string' ? parseFloat(distance) : distance;
    if (isNaN(numDist)) return "Không xác định";
    if (numDist <= 1) return "Rất gần";
    if (numDist <= 3) return `${numDist} km`;
    if (numDist <= 5) return `${numDist} km`;
    return `~${numDist} km`;
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
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
          <Text style={styles.statValue}>{partners.length || "..."}</Text>
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
        <Text style={styles.sectionSubtitle}>
          Vuốt sang phải để thích • Vuốt sang trái để bỏ qua
        </Text>

        {/* Loading state */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#ff4d4f" />
            <Text style={styles.loadingText}>Đang tìm partner gần bạn...</Text>
          </View>
        ) : error ? (
          /* Error state */
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{error}</Text>
            <Text style={styles.errorSubtitle}>
              Hãy cập nhật location trong hồ sơ để được gợi ý partner phù hợp
            </Text>
            <Pressable style={styles.retryButton} onPress={loadPartners}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : visiblePartners.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Đã xem hết các partner!</Text>
            <Text style={styles.emptySubtitle}>
              Hãy quay lại sau để khám phá thêm
            </Text>
            <Pressable style={styles.resetButton} onPress={resetAll}>
              <Text style={styles.resetButtonText}>Xem lại từ đầu</Text>
            </Pressable>
          </View>
        ) : currentPartner ? (
          <View style={styles.swipeContainer}>
            <Animated.View
              style={[
                styles.swipeCard,
                {
                  transform: [
                    { translateX: swipeAnim },
                    { rotate: rotateCard },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* Like indicator */}
              <Animated.View style={[styles.likeIndicator, { opacity: likeOpacity }]}>
                <Text style={styles.likeText}>THÍCH</Text>
              </Animated.View>

              {/* Skip indicator */}
              <Animated.View style={[styles.skipIndicator, { opacity: skipOpacity }]}>
                <Text style={styles.skipText}>BỎ QUA</Text>
              </Animated.View>

              {/* Partner avatar */}
              <View style={styles.swipeAvatar}>
                {currentPartner.avatar ? (
                  <Text style={styles.swipeAvatarText}>
                    {currentPartner.name.charAt(0)}
                  </Text>
                ) : (
                  <Text style={styles.swipeAvatarText}>
                    {currentPartner.name.charAt(0)}
                  </Text>
                )}
              </View>

              {/* Partner info */}
              <Text style={styles.swipeName}>{currentPartner.name}</Text>
              <Text style={styles.swipeMeta}>
                {currentPartner.age || "?"} tuổi • {currentPartner.sport} • {currentPartner.level}
              </Text>

              {currentPartner.bio && (
                <Text style={styles.swipeBio}>{currentPartner.bio}</Text>
              )}

              <View style={styles.swipeChipsRow}>
                <View style={styles.partnerChip}>
                  <Text style={styles.partnerChipText}>
                    {formatDistance(currentPartner.distance)} gần bạn
                  </Text>
                </View>
                <View style={[styles.partnerChip, styles.partnerChipGhost]}>
                  <Text style={styles.partnerChipGhostText}>
                    Win rate {currentPartner.winRate}%
                  </Text>
                </View>
              </View>

              {currentPartner.location && (
                <Text style={styles.swipeLocation}>
                  📍 {currentPartner.location}
                </Text>
              )}

              {/* Progress dots */}
              <View style={styles.progressDots}>
                {partners.slice(0, 10).map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.progressDot,
                      idx === 0 && styles.progressDotActive,
                    ]}
                  />
                ))}
                {partners.length > 10 && (
                  <Text style={styles.moreCount}>+{partners.length - 10}</Text>
                )}
              </View>
            </Animated.View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              <Pressable style={styles.actionButtonSkip} onPress={handleSkip}>
                <Text style={styles.actionButtonSkipText}>✕</Text>
              </Pressable>
              <Pressable
                style={styles.actionButtonLike}
                onPress={handleLike}
              >
                <Text style={styles.actionButtonLikeText}>♥</Text>
              </Pressable>
            </View>

            {/* Stats */}
            <View style={styles.likeStats}>
              <Text style={styles.likeStatsText}>
                Đã thích: {likedPartners.size} • Đã bỏ qua: {skippedPartners.size}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trận đấu sắp diễn ra</Text>
        {UPCOMING_MATCHES.map((m) => (
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
            <Text style={styles.matchMeta}>{m.time}</Text>
            <Text style={styles.matchPlayers}>Người chơi: {m.players}</Text>
          </Pressable>
        ))}
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
});
