import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  age: number;
  location: string;
  bio: string;
  email: string;
  avatar: string;
  stats: UserStats;
  sports: UserSport[];
  schedule: UserScheduleItem[];
};

const MOCK_PUBLIC_USERS: UserProfile[] = [
  {
    id: "p1",
    name: "Minh Trần",
    age: 25,
    location: "Quận 1, TP.HCM",
    bio: "Tiền vệ trung tâm, ưu tiên các trận giao hữu vui vẻ nhưng quyết liệt.",
    email: "minh.tran@example.com",
    avatar: "",
    stats: { matchesPlayed: 64, winRate: 61, hoursActive: 180, followers: 54 },
    sports: [{ name: "Football", level: "Intermediate" }],
    schedule: [
      { day: "Thứ 2", time: "19:00", activity: "Đá bóng 7 người" },
      { day: "Thứ 6", time: "20:00", activity: "Giao hữu nội bộ" },
    ],
  },
  {
    id: "p2",
    name: "Lan Nguyễn",
    age: 23,
    location: "Quận 3, TP.HCM",
    bio: "Cầu lông trình độ cao, thích tham gia các kèo đôi nam nữ.",
    email: "lan.nguyen@example.com",
    avatar: "",
    stats: { matchesPlayed: 88, winRate: 74, hoursActive: 220, followers: 132 },
    sports: [
      { name: "Badminton", level: "Advanced" },
      { name: "Tennis", level: "Intermediate" },
    ],
    schedule: [
      { day: "Thứ 4", time: "19:30", activity: "Cầu lông" },
      { day: "Chủ nhật", time: "09:00", activity: "Tennis" },
    ],
  },
  {
    id: "p3",
    name: "Hoàng Lê",
    age: 21,
    location: "Quận 7, TP.HCM",
    bio: "Mới bắt đầu chơi tennis và bóng rổ, muốn tìm bạn tập cùng.",
    email: "hoang.le@example.com",
    avatar: "",
    stats: { matchesPlayed: 24, winRate: 48, hoursActive: 60, followers: 18 },
    sports: [
      { name: "Tennis", level: "Beginner" },
      { name: "Basketball", level: "Beginner" },
    ],
    schedule: [
      { day: "Thứ 3", time: "18:00", activity: "Tennis" },
      { day: "Thứ 7", time: "17:00", activity: "Bóng rổ" },
    ],
  },
];

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [favorited, setFavorited] = useState(false);
  const [following, setFollowing] = useState(false);

  const user =
    MOCK_PUBLIC_USERS.find((u) => u.id === params.id) ?? MOCK_PUBLIC_USERS[1]; // default user

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
          <Text style={styles.avatarInitial}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.meta}>
          {user.age} tuổi • {user.location}
        </Text>
        <Text style={styles.bio}>{user.bio}</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Môn thể thao</Text>
        {user.sports.map((s, idx) => (
          <Text key={`${s.name}-${idx}`} style={styles.listItem}>
            • {s.name} ({s.level})
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lịch tập luyện</Text>
        {user.schedule.map((s, idx) => (
          <Text key={`${s.day}-${idx}`} style={styles.listItem}>
            • {s.day} • {s.time} • {s.activity}
          </Text>
        ))}
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
