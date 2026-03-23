import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchUserById, type ApiUser } from "@/lib/userApi";

const MOCK_PUBLIC_USERS: ApiUser[] = [];

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [favorited, setFavorited] = useState(false);
  const [following, setFollowing] = useState(false);
  
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      setError("Không có ID người dùng");
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchUserById(params.id!);
        setUser(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được thông tin");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [params.id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <Text style={styles.headerBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#ff4d4f" size="large" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <Text style={styles.headerBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || "Không tìm thấy người dùng"}</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>Quay lại</Text>
          </Pressable>
        </View>
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
          <Text style={styles.avatarInitial}>{user.name?.charAt(0) || "?"}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.meta}>
          {user.location || "Chưa cập nhật vị trí"}
        </Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
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
          <Stat label="Trận đã chơi" value={user.matchesPlayed || 0} />
          <Stat label="Tỷ lệ thắng (%)" value={user.winRate || 0} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Môn thể thao</Text>
        {user.sport ? (
          <Text style={styles.listItem}>• {user.sport} ({user.level || "Tất cả"})</Text>
        ) : (
          <Text style={styles.listItem}>Chưa cập nhật môn thể thao</Text>
        )}
      </View>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    color: "#888888",
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  errorText: {
    color: "#ff8888",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ff4d4f",
  },
  retryText: {
    color: "#ff4d4f",
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  listItem: {
    color: "#ddd",
    fontSize: 13,
    lineHeight: 18,
  },
});
