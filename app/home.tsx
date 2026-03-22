import { StyleSheet, Text, View, Pressable, FlatList, Dimensions } from 'react-native';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SuggestedPlayer = {
  id: string;
  name: string;
  sport: string;
  level: string;
  distance: string;
  winRate: number;
};

type UpcomingMatch = {
  id: string;
  title: string;
  sport: string;
  location: string;
  time: string;
  players: string;
};

const SUGGESTED_PLAYERS: SuggestedPlayer[] = [
  {
    id: 'p1',
    name: 'Minh Trần',
    sport: 'Football',
    level: 'Intermediate',
    distance: '1.2 km',
    winRate: 61,
  },
  {
    id: 'p2',
    name: 'Lan Nguyễn',
    sport: 'Badminton',
    level: 'Advanced',
    distance: '2.5 km',
    winRate: 74,
  },
  {
    id: 'p3',
    name: 'Hoàng Lê',
    sport: 'Tennis',
    level: 'Beginner',
    distance: '3.1 km',
    winRate: 48,
  },
  {
    id: 'p4',
    name: 'Thu Hà',
    sport: 'Football',
    level: 'Advanced',
    distance: '4.0 km',
    winRate: 82,
  },
  {
    id: 'p5',
    name: 'Nam Phạm',
    sport: 'Basketball',
    level: 'Intermediate',
    distance: '1.8 km',
    winRate: 65,
  },
  {
    id: 'p6',
    name: 'Anh Đỗ',
    sport: 'Swimming',
    level: 'Beginner',
    distance: '5.2 km',
    winRate: 55,
  },
];

const ITEMS_PER_PAGE = 3;
const PARTNER_ITEM_WIDTH = (SCREEN_WIDTH - 40 - 20) / 3; // screen width - padding - gaps
const PARTNER_PAGE_WIDTH = SCREEN_WIDTH - 40;

const UPCOMING_MATCHES: UpcomingMatch[] = [
  {
    id: 'm1',
    title: 'Giao hữu bóng đá tối thứ 6',
    sport: 'Football',
    location: 'Sân Hoa Lư, Quận 1',
    time: '20:00 hôm nay',
    players: '14/20',
  },
  {
    id: 'm2',
    title: 'Cầu lông sáng cuối tuần',
    sport: 'Badminton',
    location: 'CLB Cầu Lông Phú Nhuận',
    time: '09:00 Thứ 7',
    players: '6/8',
  },
  {
    id: 'm3',
    title: 'Pick-up basketball',
    sport: 'Basketball',
    location: 'Sân ngoài trời Thảo Điền',
    time: '18:30 Thứ 5',
    players: '8/10',
  },
];

export default function HomeScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerSpacer} />

      <View style={styles.heroCard}>
        <Text style={styles.badge}>Welcome to</Text>
        <Text style={styles.logo}>SportMate</Text>
        <Text style={styles.title}>Tìm đồng đội thể thao dễ dàng.</Text>
        <Text style={styles.subtitle}>
          Khởi động nhanh một trận đấu mới hoặc khám phá các trận đang diễn ra xung quanh bạn.
        </Text>

        <View style={styles.heroButtons}>
          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => router.push('/match/create-match')}>
            <Text style={styles.buttonPrimaryText}>Tạo trận đấu</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonGhost]}
            onPress={() => router.push('/ranking')}>
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
        <Pressable style={styles.quickCard} onPress={() => router.push('/my-profile')}>
          <Text style={styles.quickTitle}>Hồ sơ của bạn</Text>
          <Text style={styles.quickSubtitle}>Cập nhật môn thể thao và lịch tập</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/match')}>
          <Text style={styles.quickTitle}>Trận nổi bật</Text>
          <Text style={styles.quickSubtitle}>Xem chi tiết các trận đang mở</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Những partner tuyệt vời</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.partnerScrollContent}>
          {SUGGESTED_PLAYERS.map((p) => (
            <Pressable
              key={p.id}
              style={styles.partnerCard}
              onPress={() => router.push({ pathname: '/profile', params: { id: p.id } })}>
              <View style={styles.partnerAvatar}>
                <Text style={styles.partnerAvatarText}>{p.name.charAt(0)}</Text>
              </View>
              <View style={styles.partnerMain}>
                <Text style={styles.partnerName}>{p.name}</Text>
                <Text style={styles.partnerMeta}>
                  {p.sport} • {p.level}
                </Text>
                <View style={styles.partnerChipsRow}>
                  <View style={styles.partnerChip}>
                    <Text style={styles.partnerChipText}>{p.distance} gần bạn</Text>
                  </View>
                  <View style={[styles.partnerChip, styles.partnerChipGhost]}>
                    <Text style={styles.partnerChipGhostText}>Win rate {p.winRate}%</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trận đấu sắp diễn ra</Text>
        {UPCOMING_MATCHES.map((m) => (
          <Pressable
            key={m.id}
            style={styles.matchCard}
            onPress={() => router.push({ pathname: '/match', params: { id: m.id } })}>
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
    backgroundColor: '#050505',
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
    backgroundColor: '#101010',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ff4d4f33',
    color: '#ffb3b3',
    fontSize: 11,
    marginBottom: 6,
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ff4d4f',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#bbbbbb',
    marginBottom: 18,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#ff4d4f',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: '#ff4d4f',
  },
  buttonGhostText: {
    color: '#ff4d4f',
    fontWeight: '600',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statLabel: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#111111',
  },
  quickTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickSubtitle: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  partnerScrollContent: {
    gap: 10,
    paddingRight: 20,
  },
  partnerCard: {
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff4d4f22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerAvatarText: {
    color: '#ff4d4f',
    fontWeight: '700',
  },
  partnerMain: {
    flex: 1,
  },
  partnerName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  partnerMeta: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  partnerChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  partnerChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#ff4d4f',
  },
  partnerChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  partnerChipGhost: {
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#ff4d4f55',
  },
  partnerChipGhostText: {
    color: '#ffb3b3',
    fontSize: 11,
    fontWeight: '500',
  },
  matchCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  matchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  matchTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  matchSport: {
    color: '#ffb3b3',
    fontSize: 12,
    fontWeight: '500',
  },
  matchMeta: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  matchPlayers: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
});

