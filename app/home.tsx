import Constants from "expo-constants";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useSuggestedPartners } from "@/hooks/useSuggestedPartners";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 100;

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:3000`;
  }
  return "http://localhost:3000";
}
const API_BASE_URL = getApiBaseUrl();

type UpcomingMatch = {
  id: string;
  title: string;
  sport: string;
  location: string;
  time: string;
  players: string;
};

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const { user } = useAuth();
  const { partners, loading, error } = useSuggestedPartners(
    user?.id,
    user?.location,
  );

  // Animation refs
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const skipScale = useRef(new Animated.Value(1)).current;
  const profileScale = useRef(new Animated.Value(1)).current;

  const animateSwipeLeft = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(cardTranslateX, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      cardTranslateX.setValue(SCREEN_WIDTH);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(cardTranslateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const animateSwipeRight = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(cardTranslateX, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      cardTranslateX.setValue(-SCREEN_WIDTH);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(cardTranslateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const goToNext = () => {
    if (currentIndex < partners.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSwipeRight = () => {
    const partner = partners[currentIndex];
    if (!partner) return;
    
    // Animate card out to right
    animateSwipeRight(() => {
      router.push({
        pathname: "/profile",
        params: { id: partner.id },
      });
      goToNext();
    });

    // Button press animation
    Animated.sequence([
      Animated.timing(profileScale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(profileScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const handleSwipeLeft = () => {
    // Animate card out to left
    animateSwipeLeft(goToNext);

    // Button press animation
    Animated.sequence([
      Animated.timing(skipScale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(skipScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const currentPartner = partners.length > 0 ? partners[currentIndex] : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
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
          <Text style={styles.statValue}>128</Text>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Những partner tuyệt vời</Text>
          {partners.length > 0 && (
            <Text style={styles.sectionCounter}>
              {currentIndex + 1} / {partners.length}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải partner...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : currentPartner ? (
          <Animated.View
            style={[
              styles.card,
              {
                transform: [
                  { translateX: cardTranslateX },
                  { scale: cardScale },
                ],
                opacity: cardOpacity,
              },
            ]}
          >
            <View style={styles.cardAvatar}>
              {currentPartner.avatar ? (
                <Image
                  source={{ uri: currentPartner.avatar.startsWith("http")
                    ? currentPartner.avatar
                    : `${API_BASE_URL}${currentPartner.avatar}` }}
                  style={styles.cardAvatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cardAvatarPlaceholder}>
                  <Text style={styles.cardAvatarText}>
                    {currentPartner.name?.charAt(0) || "?"}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{currentPartner.name}</Text>
              <Text style={styles.cardMeta}>
                {currentPartner.sport} • {currentPartner.level}
              </Text>
              <View style={styles.cardChips}>
                <View style={styles.cardChip}>
                  <Text style={styles.cardChipText}>
                    {currentPartner.distance}
                  </Text>
                </View>
                <View style={[styles.cardChip, styles.cardChipGhost]}>
                  <Text style={styles.cardChipGhostText}>
                    Win {currentPartner.winRate}%
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <Animated.View style={{ transform: [{ scale: skipScale }] }}>
                <Pressable
                  style={[styles.actionButton, styles.skipButton]}
                  onPress={handleSwipeLeft}
                >
                  <Text style={styles.skipButtonText}>✕ Skip</Text>
                </Pressable>
              </Animated.View>
              <Animated.View style={{ transform: [{ scale: profileScale }] }}>
                <Pressable
                  style={[styles.actionButton, styles.profileButton]}
                  onPress={handleSwipeRight}
                >
                  <Text style={styles.profileButtonText}>→ Profile</Text>
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>Hết rồi!</Text>
            <Text style={styles.emptyCardSubtitle}>
              Không còn partner nào để xem
            </Text>
          </View>
        )}
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
    marginBottom: 16,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionCounter: {
    color: "#ff4d4f",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  loadingContainer: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#aaaaaa",
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: "#1a0000",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: "#ff4d4f",
    fontSize: 14,
  },
  card: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  emptyCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
  },
  emptyCardTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyCardSubtitle: {
    color: "#aaaaaa",
    fontSize: 14,
  },
  cardAvatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#ff4d4f22",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#ff4d4f44",
  },
  cardAvatarImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  cardAvatarText: {
    color: "#ff4d4f",
    fontWeight: "800",
    fontSize: 44,
  },
  cardAvatarPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#ff4d4f22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#ff4d4f44",
  },
  debugText: {
    color: "#888",
    fontSize: 10,
    marginTop: 4,
  },
  cardInfo: {
    alignItems: "center",
    width: "100%",
  },
  cardName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardMeta: {
    color: "#aaaaaa",
    fontSize: 15,
    marginBottom: 12,
  },
  cardChips: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  cardChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ff4d4f",
  },
  cardChipText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  cardChipGhost: {
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#ff4d4f55",
  },
  cardChipGhostText: {
    color: "#ffb3b3",
    fontSize: 13,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#222222",
    width: "100%",
  },
  actionButton: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    backgroundColor: "#222222",
    borderWidth: 2,
    borderColor: "#ff4d4f",
  },
  skipButtonText: {
    color: "#ff4d4f",
    fontSize: 18,
    fontWeight: "700",
  },
  profileButton: {
    backgroundColor: "#ff4d4f",
  },
  profileButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
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
