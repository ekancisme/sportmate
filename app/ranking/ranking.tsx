import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Player = {
  id: string;
  name: string;
  sport: string;
  rating: number;
  matches: number;
};

type SportStat = {
  sport: string;
  players: number;
  weeklyMatches: number;
};

type RegionStat = {
  region: string;
  players: number;
  weeklyMatches: number;
};

const topPlayers: Player[] = [
  {
    id: "1",
    name: "Nguyễn Văn A",
    sport: "Football",
    rating: 4.9,
    matches: 132,
  },
  { id: "2", name: "Trần Thị B", sport: "Badminton", rating: 4.8, matches: 98 },
  { id: "3", name: "Lê Văn C", sport: "Basketball", rating: 4.7, matches: 87 },
];

const sportStats: SportStat[] = [
  { sport: "Football", players: 640, weeklyMatches: 52 },
  { sport: "Badminton", players: 420, weeklyMatches: 38 },
  { sport: "Tennis", players: 210, weeklyMatches: 18 },
];

const regionStats: RegionStat[] = [
  { region: "Quận 1", players: 230, weeklyMatches: 20 },
  { region: "Quận 3", players: 190, weeklyMatches: 16 },
  { region: "Quận 7", players: 160, weeklyMatches: 14 },
];

export default function Ranking() {
  const [tab, setTab] = useState<"players" | "sports" | "regions">("players");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.badge}>Season 2026</Text>
        <Text style={styles.title}>Bảng xếp hạng SportMate</Text>
        <Text style={styles.subtitle}>
          Theo dõi phong độ người chơi, độ hot của từng môn và khu vực thi đấu
          sôi động.
        </Text>
      </View>

      <View style={styles.tabsRow}>
        <TabButton
          label="Người chơi"
          active={tab === "players"}
          onPress={() => setTab("players")}
        />
        <TabButton
          label="Môn thể thao"
          active={tab === "sports"}
          onPress={() => setTab("sports")}
        />
        <TabButton
          label="Khu vực"
          active={tab === "regions"}
          onPress={() => setTab("regions")}
        />
      </View>

      <View style={styles.cardWrapper}>
        {tab === "players" &&
          topPlayers.map((p, index) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.ribbon} />
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.name.charAt(0)}</Text>
                </View>
                <View style={styles.cardMain}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.rank}>#{index + 1}</Text>
                    <Text style={styles.cardTitle}>{p.name}</Text>
                  </View>
                  <Text style={styles.cardMeta}>
                    {p.sport} • {p.matches} trận
                  </Text>
                  <View style={styles.chipRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>
                        ⭐ {p.rating.toFixed(1)}
                      </Text>
                    </View>
                    <View style={[styles.chip, styles.chipGhost]}>
                      <Text style={styles.chipGhostText}>Top player</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}

        {tab === "sports" &&
          sportStats.map((s) => (
            <View key={s.sport} style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{s.sport}</Text>
                <Text style={styles.cardMeta}>
                  Người chơi: {s.players} • Trận/tuần: {s.weeklyMatches}
                </Text>
                <View style={styles.progressBarOuter}>
                  <View
                    style={[
                      styles.progressBarInner,
                      {
                        width: `${Math.min(100, (s.weeklyMatches / 60) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}

        {tab === "regions" &&
          regionStats.map((r) => (
            <View key={r.region} style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{r.region}</Text>
                <Text style={styles.cardMeta}>
                  Người chơi: {r.players} • Trận/tuần: {r.weeklyMatches}
                </Text>
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Hot zone</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabBtn,
        active ? styles.tabBtnActive : styles.tabBtnInactive,
      ]}
    >
      <Text
        style={[
          styles.tabText,
          active ? styles.tabTextActive : styles.tabTextInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 18,
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
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#ff4d4f",
  },
  tabBtnInactive: {
    backgroundColor: "#111",
  },
  tabText: {
    fontSize: 13,
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  tabTextInactive: {
    color: "#aaa",
  },
  cardWrapper: {
    gap: 10,
  },
  card: {
    backgroundColor: "#101010",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rank: {
    color: "#ff4d4f",
    fontWeight: "700",
    fontSize: 16,
    width: 30,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  cardMeta: {
    color: "#aaa",
    fontSize: 13,
  },
  rating: {
    color: "#fff",
    fontWeight: "600",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff4d4f22",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ff4d4f",
    fontWeight: "700",
  },
  cardMain: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  chipRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ff4d4f",
  },
  chipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  chipGhost: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#ff4d4f33",
  },
  chipGhostText: {
    color: "#ffb3b3",
    fontSize: 11,
    fontWeight: "500",
  },
  ribbon: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#ff4d4f",
  },
  progressBarOuter: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#1a1a1a",
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    backgroundColor: "#ff4d4f",
  },
});
