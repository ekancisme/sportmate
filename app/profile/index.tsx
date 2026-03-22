import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type UserSport = {
  name: string;
  level: string;
};

type UserScheduleItem = {
  day: string;
  time: string;
  activity: string;
};

type UserStats = {
  matchesPlayed: number;
  winRate: number;
  hoursActive: number;
  followers: number;
};

type UserProfile = {
  id: string;
  name: string;
  age: number | null;
  location: string;
  bio: string;
  avatar: string | null;
  stats: UserStats;
  sports: UserSport[];
  schedule: UserScheduleItem[];
};

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

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [favorited, setFavorited] = useState(false);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!params.id) {
      setError("Không có ID người dùng");
      setLoading(false);
      return;
    }

    async function fetchUser() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/users/${params.id}`);
        if (!res.ok) {
          throw new Error("Không tìm thấy người dùng");
        }
        const data = await res.json();
        setUser(data);
      } catch (err: any) {
        setError(err.message || "Lỗi khi tải thông tin");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [params.id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff4d4f" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>
          {error || "Không tìm thấy người dùng"}
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.headerBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerBtnPlaceholder} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>
              {user.name?.charAt(0) || "?"}
            </Text>
          )}
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.meta}>
          {user.age ? `${user.age} tuổi • ` : ""}
          {user.location}
        </Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionBtn, styles.actionPrimary]}>
          <Text style={styles.actionPrimaryText}>Nhắn tin</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            favorited ? styles.actionSecondaryActive : styles.actionSecondary,
          ]}
          onPress={() => setFavorited((v) => !v)}
        >
          <Text
            style={
              favorited
                ? styles.actionSecondaryTextActive
                : styles.actionSecondaryText
            }
          >
            {favorited ? "Đã yêu thích" : "Yêu thích"}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            following ? styles.actionSecondaryActive : styles.actionSecondary,
          ]}
          onPress={() => setFollowing((v) => !v)}
        >
          <Text
            style={
              following
                ? styles.actionSecondaryTextActive
                : styles.actionSecondaryText
            }
          >
            {following ? "Đang follow" : "Follow"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thống kê</Text>
        <View style={styles.statsRow}>
          <Stat label="Trận đã chơi" value={user.stats.matchesPlayed} />
          <Stat label="Tỷ lệ thắng (%)" value={user.stats.winRate} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Giờ hoạt động" value={user.stats.hoursActive} />
          <Stat label="Người theo dõi" value={user.stats.followers} />
        </View>
      </View>

      {user.sports && user.sports.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Môn thể thao</Text>
          {user.sports.map((s, idx) => (
            <Text key={`${s.name}-${idx}`} style={styles.listItem}>
              • {s.name} ({s.level})
            </Text>
          ))}
        </View>
      )}

      {user.schedule && user.schedule.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch tập luyện</Text>
          {user.schedule.map((s, idx) => (
            <Text key={`${s.day}-${idx}`} style={styles.listItem}>
              • {s.day} • {s.time} • {s.activity}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 120,
  },
  loadingText: {
    color: "#aaa",
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: "#ff4d4f",
    fontSize: 14,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: "#ff4d4f",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  headerBtnText: {
    color: "#aaa",
    fontSize: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 20,
    borderRadius: 24,
    backgroundColor: "#101010",
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#ff4d4f55",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
  },
  name: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  meta: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 2,
  },
  bio: {
    color: "#ddd",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  actionPrimary: {
    backgroundColor: "#ff4d4f",
  },
  actionPrimaryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: "#444",
  },
  actionSecondaryActive: {
    borderWidth: 1,
    borderColor: "#ff4d4f",
    backgroundColor: "#111",
  },
  actionSecondaryText: {
    color: "#ccc",
    fontSize: 12,
  },
  actionSecondaryTextActive: {
    color: "#ff4d4f",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#101010",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statLabel: {
    color: "#888",
    fontSize: 11,
  },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  listItem: {
    color: "#ccc",
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
});
