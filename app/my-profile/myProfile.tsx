import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { fetchMyMatches, formatDateVi, type ApiMatch } from '@/lib/matchApi';

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
  name: string;
  age: number;
  location: string;
  bio: string;
  email: string;
  phone: string;
  avatar: string;
  stats: UserStats;
  sports: UserSport[];
  schedule: UserScheduleItem[];
};

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  return 'http://localhost:3000';
}

const EMPTY_PROFILE: UserProfile = {
  name: '',
  age: 0,
  location: '',
  bio: '',
  email: '',
  phone: '',
  avatar: '',
  stats: {
    matchesPlayed: 0,
    winRate: 0,
    hoursActive: 0,
    followers: 0,
  },
  sports: [],
  schedule: [],
};

export default function MyProfile() {
  const { logout, user: authUser, role } = useAuth();
  const apiBase = getApiBaseUrl();
  const [user, setUser] = useState<UserProfile>(EMPTY_PROFILE);

  const [myMatches, setMyMatches] = useState<ApiMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesErr, setMatchesErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;

    setUser({
      name: authUser.name || '',
      age: authUser.age || 0,
      location: authUser.location || '',
      bio: authUser.bio || '',
      email: authUser.email || '',
      phone: authUser.phone || '',
      avatar: authUser.avatar || '',
      stats: {
        matchesPlayed: authUser.stats?.matchesPlayed ?? 32,
        winRate: authUser.stats?.winRate ?? 58,
        hoursActive: authUser.stats?.hoursActive ?? 120,
        followers: authUser.stats?.followers ?? 24,
      },
      sports:
        authUser.sports && authUser.sports.length ? authUser.sports : [],
      schedule:
        (authUser.schedule && authUser.schedule.length ? authUser.schedule : []).map(
          (it) => ({
            day: it.day,
            time: it.time ?? '',
            activity: it.activity,
          }),
        ),
    });
  }, [authUser]);

  useEffect(() => {
    async function loadMatches() {
      if (!authUser?.id) {
        setMyMatches([]);
        return;
      }

      setMatchesLoading(true);
      setMatchesErr(null);

      try {
        const rows = await fetchMyMatches(authUser.id);
        setMyMatches(rows);

        // Tính lại số trận đã chơi & tỷ lệ thắng dựa trên các trận finished
        const finished = rows.filter((m) => m.status === 'finished');
        const matchesPlayed = finished.length;
        const won = finished.filter((m) => (m.winners ?? []).includes(authUser.id)).length;
        const winRate = matchesPlayed > 0 ? Math.round((won / matchesPlayed) * 100) : 0;

        setUser((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            matchesPlayed,
            winRate,
          },
        }));
      } catch (e) {
        setMatchesErr(e instanceof Error ? e.message : 'Không tải được trận của bạn');
      } finally {
        setMatchesLoading(false);
      }
    }

    void loadMatches();
  }, [authUser?.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.profileCard}>
        <View style={styles.avatarWrapper}>
          <Pressable
            style={styles.avatarCircle}
            onPress={() => router.push('/my-profile/edit')}>
            {user.avatar ? (
              <Image
                source={{
                  uri: user.avatar.startsWith('http') ? user.avatar : apiBase + user.avatar,
                }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitial}>{user.name.charAt(0) || 'S'}</Text>
            )}
          </Pressable>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>⚽</Text>
          </View>
        </View>

        <Text style={styles.profileName}>{user.name}</Text>
        <Text style={styles.profileRole}>Người chơi SportMate</Text>

        {role === 'admin' ? (
          <Pressable
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [styles.adminManageBtn, pressed && styles.adminManageBtnPressed]}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={styles.adminManageBtnText}>Trang Quản Lý</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.push('/my-profile/edit')}
          style={styles.changeProfileBtn}
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa hồ sơ"
        >
          <Ionicons name="settings" size={22} color="#ff4d4f" />
        </Pressable>

        <View style={styles.chipGroup}>
          {user.sports.map((s) => (
            <View key={`${s.name}-${s.level}`} style={styles.chip}>
              <Text style={styles.chipText}>
                {s.name} • {s.level}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Trận đấu" value={user.stats.matchesPlayed} />
        <Stat label="Tỷ lệ thắng (%)" value={user.stats.winRate} />
        <Stat label="Giờ hoạt động" value={user.stats.hoursActive} />
        <Stat label="Người theo dõi" value={user.stats.followers} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Giới thiệu</Text>
        <Text style={styles.aboutText}>{user.bio}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lịch tập luyện</Text>
        <View style={styles.scheduleGrid}>
          {user.schedule.map((s, idx) => (
            <View key={`${s.day}-${idx}`} style={styles.scheduleCard}>
              <Text style={styles.scheduleDay}>{s.day}</Text>
              <Text style={styles.scheduleTime}>{s.time}</Text>
              <Text style={styles.scheduleActivity}>{s.activity}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.secondaryBtn, styles.actionBtn]}
          onPress={() => router.push('/(tabs)/my-matches')}>
          <Text style={styles.secondaryBtnText}>Trận của tôi</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, styles.actionBtn]}
          onPress={() => router.push('/match/create-match')}>
          <Text style={styles.primaryBtnText}>+ Tạo trận đấu</Text>
        </Pressable>
      </View>
      <View style={styles.actionsRowSingle}>
        <Pressable
          style={[styles.secondaryBtn, styles.actionBtn]}
          onPress={() => {
            logout();
            router.replace('/(auth)');
          }}>
          <Text style={styles.secondaryBtnText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  editable,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'number-pad'
    | 'decimal-pad';
}) {
  if (!editable) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor="#777"
      />
    </View>
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
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    color: '#aaa',
    fontSize: 16,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#444',
  },
  editBtnActive: {
    borderColor: '#ff4d4f',
    backgroundColor: '#111',
  },
  editText: {
    color: '#aaa',
    fontSize: 12,
  },
  editTextActive: {
    color: '#ff4d4f',
    fontWeight: '600',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
    borderRadius: 28,
    backgroundColor: '#101010',
    position: 'relative',
  },
  avatarWrapper: {
    marginBottom: 12,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    borderWidth: 3,
    borderColor: '#ff4d4f55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  avatarBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff4d4f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#050505',
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 14,
  },
  profileName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileRole: {
    color: '#bbbbff',
    fontSize: 13,
    marginTop: 2,
  },
  profileLink: {
    marginTop: 6,
    color: '#ff4d4f',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  changeProfileBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  adminManageBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.6)',
    backgroundColor: 'rgba(255,77,79,0.12)',
  },
  adminManageBtnPressed: {
    opacity: 0.85,
  },
  adminManageBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#ff4d4f55',
  },
  chipText: {
    color: '#ffb3b3',
    fontSize: 11,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  mutedText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#ff8888',
    fontSize: 13,
    lineHeight: 18,
  },
  matchPreviewCard: {
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  pressedCard: {
    opacity: 0.85,
  },
  matchPreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  matchPreviewTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  matchPreviewMeta: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleBadgeHost: {
    backgroundColor: 'rgba(255, 77, 79, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 79, 0.45)',
  },
  roleBadgeJoin: {
    backgroundColor: 'rgba(120, 180, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(120, 180, 255, 0.4)',
  },
  roleBadgeText: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '700',
  },
  aboutText: {
    color: '#dddddd',
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 2,
  },
  fieldValue: {
    color: '#ddd',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  listItem: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 18,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  addInput: {
    flex: 1,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff4d4f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: '#ff4d4f',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionsRowSingle: {
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#ff4d4f',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  secondaryBtnText: {
    color: '#aaa',
    fontWeight: '500',
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scheduleCard: {
    flexBasis: '48%',
    backgroundColor: '#111',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scheduleDay: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleTime: {
    color: '#ffb3b3',
    fontSize: 12,
    marginBottom: 2,
  },
  scheduleActivity: {
    color: '#ddd',
    fontSize: 12,
  },
});

