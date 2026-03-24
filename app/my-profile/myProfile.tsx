import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserSport = { name: string; level: string };
type UserScheduleItem = { day: string; time: string; activity: string; matchId?: string };

type UserProfile = {
  name: string;
  email: string;
  phone: string;
  avatar: string;
  bio: string;
  sports: UserSport[];
  stats: {
    matchesPlayed: number;
    matchesWon: number;
    winRate: number;
    hoursActive: number;
    followers: number;
  };
  schedule: UserScheduleItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest?: { hostUri?: string } }).manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  // @ts-ignore old expo
  Constants.manifest?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:3000`;
  return 'http://localhost:3000';
}

const API_BASE = getApiBaseUrl();

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyProfile() {
  const { user: authUser, setUserFromServer, logout, role } = useAuth();

  // ── state ──
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  // add-schedule inputs
  const [newDay, setNewDay] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newActivity, setNewActivity] = useState('');

  // ── populate from authUser ──
  useEffect(() => {
    if (!authUser) return;
    const p: UserProfile = {
      name: authUser.name || '',
      email: authUser.email || '',
      phone: authUser.phone || '',
      avatar: authUser.avatar || '',
      bio: authUser.bio || '',
      sports: authUser.sports ?? [],
      stats: {
        matchesPlayed: authUser.stats?.matchesPlayed ?? 0,
        matchesWon: 0,
        winRate: authUser.stats?.winRate ?? 0,
        hoursActive: authUser.stats?.hoursActive ?? 0,
        followers: authUser.stats?.followers ?? 0,
      },
      schedule: (authUser.schedule ?? []).map((s) => ({
        day: s.day,
        time: s.time ?? '',
        activity: s.activity,
        matchId: s.matchId,
      })),
    };
    setProfile(p);
    setEditData(p);
  }, [authUser]);

  // ── handlers ──
  const handleEdit = () => {
    setEditData(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData(profile);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editData || !authUser?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${authUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          email: editData.email,
          phone: editData.phone,
          bio: editData.bio,
          sports: editData.sports,
          schedule: editData.schedule,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Cập nhật thất bại');

      // sync back to AuthContext so the rest of the app sees fresh data
      setUserFromServer({ ...authUser, ...data });
      setProfile(editData);
      setIsEditing(false);
    } catch (e: unknown) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể lưu thay đổi');
    } finally {
      setSaving(false);
    }
  };

  const addSchedule = () => {
    if (!newDay.trim() || !newTime.trim() || !newActivity.trim() || !editData) return;
    setEditData({
      ...editData,
      schedule: [
        ...editData.schedule,
        { day: newDay.trim(), time: newTime.trim(), activity: newActivity.trim() },
      ],
    });
    setNewDay('');
    setNewTime('');
    setNewActivity('');
  };

  const removeSchedule = (idx: number) => {
    if (!editData) return;
    setEditData({ ...editData, schedule: editData.schedule.filter((_, i) => i !== idx) });
  };

  // ── loading guard ──
  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff4d4f" />
        <Text style={styles.loadingText}>Đang tải hồ sơ…</Text>
      </View>
    );
  }

  const displayData = isEditing ? editData! : profile;
  const avatarUri = displayData.avatar
    ? displayData.avatar.startsWith('http')
      ? displayData.avatar
      : API_BASE + displayData.avatar
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Header ── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Hồ Sơ Của Tôi</Text>
          <Text style={styles.pageSubtitle}>Quản lý thông tin cá nhân</Text>
        </View>
      </View>

      {/* ── Profile Card ── */}
      <View style={styles.profileCard}>
        <Pressable
          onPress={() => router.push('/my-profile/edit')}
          style={({ pressed }) => [styles.changeProfileBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="settings" size={20} color={PRIMARY} />
        </Pressable>
        {/* avatar */}
        <Pressable
          style={styles.avatarWrapper}
          onPress={() => router.push('/my-profile/edit')}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{displayData.name.charAt(0) || 'S'}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </Pressable>

        {/* name / role */}
        {isEditing ? (
          <TextInput
            style={styles.nameInput}
            value={editData!.name}
            onChangeText={(t) => setEditData({ ...editData!, name: t })}
            placeholder="Tên hiển thị"
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.profileName}>{displayData.name}</Text>
        )}
        <Text style={styles.profileRole}>Người chơi SportMate</Text>
        {role === 'admin' ? (
          <Pressable
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [styles.adminManageBtn, pressed && styles.adminManageBtnPressed]}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={styles.adminManageBtnText}>Trang Quản Lý</Text>
          </Pressable>
        ) : null}

        <View style={styles.chipGroup}>
          {displayData.sports.length === 0 ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Chưa thêm môn thể thao</Text>
            </View>
          ) : (
            displayData.sports.map((s, i) => (
              <View key={`${s.name}-${i}`} style={styles.chip}>
                <Text style={styles.chipText}>
                  {s.name} • {s.level}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        <StatCard label="Trận Đấu" value={String(profile.stats.matchesPlayed)} />
        <StatCard label="Tỷ Lệ Thắng" value={`${profile.stats.winRate}%`} />
        <StatCard label="Giờ HĐ" value={String(profile.stats.hoursActive)} />
        <StatCard label="Theo Dõi" value={String(profile.stats.followers)} />
      </View>

      {/* ── Thông Tin Liên Hệ ── */}
      <SectionCard title="Thông Tin Liên Hệ">
        {isEditing ? (
          <>
            <FieldInput
              label="Email"
              value={editData!.email}
              onChangeText={(t) => setEditData({ ...editData!, email: t })}
              keyboardType="email-address"
            />
            <FieldInput
              label="Số Điện Thoại"
              value={editData!.phone}
              onChangeText={(t) => setEditData({ ...editData!, phone: t })}
              keyboardType="phone-pad"
            />
          </>
        ) : (
          <>
            <FieldDisplay label="Email" value={displayData.email} />
            <FieldDisplay label="Số Điện Thoại" value={displayData.phone} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Giới Thiệu Bản Thân">
        {isEditing ? (
          <TextInput
            style={[styles.fieldInput, styles.inputMultiline]}
            value={editData!.bio}
            onChangeText={(t) => setEditData({ ...editData!, bio: t })}
            placeholder="Viết vài dòng giới thiệu về bạn..."
            placeholderTextColor="#555"
            multiline
          />
        ) : (
          <Text style={styles.fieldValue}>{displayData.bio || 'Chưa có giới thiệu bản thân.'}</Text>
        )}
      </SectionCard>

      {/* ── Lịch Trình ── */}
      <SectionCard title="Lịch Trình">
        {displayData.schedule.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có lịch trình nào</Text>
        ) : (
          displayData.schedule.map((s, idx) => (
            <View key={`sched-${idx}`} style={styles.scheduleItem}>
              <View style={styles.scheduleItemLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.scheduleActivity}>{s.activity}</Text>
                  {s.matchId && (
                    <View style={styles.matchBadge}>
                      <Ionicons name="trophy-outline" size={10} color="#ffb347" />
                      <Text style={styles.matchBadgeText}>Trận đấu</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.scheduleDay}>{s.day}</Text>
              </View>
              <View style={styles.scheduleItemRight}>
                <Text style={styles.scheduleTime}>{s.time}</Text>
                {/* Chỉ cho xóa thủ công các lịch không gắn với trận */}
                {isEditing && !s.matchId && (
                  <Pressable onPress={() => removeSchedule(idx)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={14} color="#ff6b6b" />
                  </Pressable>
                )}
                {isEditing && s.matchId && (
                  <Ionicons name="lock-closed-outline" size={13} color="#555" />
                )}
              </View>
            </View>
          ))
        )}

        {isEditing && (
          <View style={styles.addBlock}>
            <Text style={styles.addBlockTitle}>Thêm lịch trình</Text>
            <TextInput
              style={styles.addInput}
              placeholder="Ngày (vd: Thứ 7)"
              placeholderTextColor="#555"
              value={newDay}
              onChangeText={setNewDay}
            />
            <TextInput
              style={styles.addInput}
              placeholder="Giờ (vd: 18:00 - 20:00)"
              placeholderTextColor="#555"
              value={newTime}
              onChangeText={setNewTime}
            />
            <TextInput
              style={styles.addInput}
              placeholder="Hoạt động (vd: Bóng Đá)"
              placeholderTextColor="#555"
              value={newActivity}
              onChangeText={setNewActivity}
            />
            <Pressable style={styles.addBtn} onPress={addSchedule}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Thêm Lịch Trình</Text>
            </Pressable>
          </View>
        )}
      </SectionCard>

      {/* ── Save / Cancel buttons when editing ── */}
      {isEditing && (
        <View style={styles.saveRow}>
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Lưu Thay Đổi</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.cancelBtnFull} onPress={handleCancel}>
            <Ionicons name="close" size={16} color="#aaa" />
            <Text style={styles.cancelBtnText}>Hủy</Text>
          </Pressable>
        </View>
      )}

      {/* ── Action Buttons ── */}
      {!isEditing && (
        <View style={styles.actionsBlock}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/match/create-match')}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Tạo Trận Đấu</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/my-matches' as never)}
          >
            <Ionicons name="trophy-outline" size={16} color="#aaa" />
            <Text style={styles.secondaryBtnText}>Trận Của Tôi</Text>
          </Pressable>

          {role === 'owner' && (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push('/courts/my-courts' as never)}
            >
              <Ionicons name="business-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Quản Lý Sân Của Tôi</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.secondaryBtn, { borderColor: '#ff4d4f55' }]}
            onPress={() => {
              logout();
              router.replace('/(auth)');
            }}
          >
            <Ionicons name="log-out-outline" size={16} color="#ff6b6b" />
            <Text style={[styles.secondaryBtnText, { color: '#ff6b6b' }]}>Đăng Xuất</Text>
          </Pressable>
        </View>
      )}

    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#555"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#ff4d4f';
const BG = '#050505';
const CARD = '#101010';
const CARD2 = '#111';
const BORDER = '#222';
const TEXT = '#ffffff';
const MUTED = '#888';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  loadingText: { color: MUTED, marginTop: 12, fontSize: 14 },

  // page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pageTitle: { color: TEXT, fontSize: 22, fontWeight: '700' },
  pageSubtitle: { color: MUTED, fontSize: 13, marginTop: 2 },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cancelBtn: { backgroundColor: '#333' },
  editToggleBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // profile card
  profileCard: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    marginBottom: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: `${PRIMARY}88`,
  },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1a1a1a',
    borderWidth: 3,
    borderColor: `${PRIMARY}55`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: TEXT, fontSize: 34, fontWeight: '700' },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  profileName: { color: TEXT, fontSize: 20, fontWeight: '700', marginBottom: 2 },
  nameInput: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: PRIMARY,
    paddingVertical: 4,
    textAlign: 'center',
    minWidth: 160,
    marginBottom: 4,
  },
  profileRole: {
    color: '#bbbbff',
    fontSize: 13,
    marginTop: 2,
  },
  bioWrap: {
    marginTop: 12,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bioText: {
    color: '#d5d5d5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
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
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: `${PRIMARY}55`,
  },
  chipText: { color: '#ffb3b3', fontSize: 11 },

  // stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD2,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statValue: { color: PRIMARY, fontSize: 18, fontWeight: '700' },
  statLabel: { color: MUTED, fontSize: 10, marginTop: 2, textAlign: 'center' },

  // section card
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },

  // fields
  fieldRow: { marginBottom: 10 },
  fieldLabel: { color: MUTED, fontSize: 12, marginBottom: 4 },
  fieldValue: { color: '#ddd', fontSize: 14, fontWeight: '500' },
  fieldInput: {
    backgroundColor: '#181818',
    color: TEXT,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },

  // list items (sports)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181818',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listItemTitle: { color: TEXT, fontSize: 14, fontWeight: '600' },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}22`,
    borderWidth: 1,
    borderColor: `${PRIMARY}55`,
  },
  levelBadgeText: { color: PRIMARY, fontSize: 11, fontWeight: '600' },
  removeBtn: { padding: 4 },

  // schedule items
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181818',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  scheduleItemLeft: { flex: 1 },
  scheduleItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduleActivity: { color: TEXT, fontSize: 13, fontWeight: '600' },
  scheduleDay: { color: MUTED, fontSize: 12, marginTop: 2 },
  scheduleTime: { color: PRIMARY, fontSize: 13, fontWeight: '600' },

  // add block
  addBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 8,
  },
  addBlockTitle: { color: '#ccc', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  addInput: {
    backgroundColor: '#181818',
    color: TEXT,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  levelPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181818',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  levelPickerBtnText: { color: TEXT, fontSize: 13 },
  levelOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: BORDER,
  },
  levelOptionActive: { borderColor: PRIMARY, backgroundColor: `${PRIMARY}18` },
  levelOptionText: { color: MUTED, fontSize: 13 },
  levelOptionTextActive: { color: PRIMARY, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  emptyText: { color: MUTED, fontSize: 13 },

  // save row
  saveRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 999,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtnFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    borderRadius: 999,
  },
  cancelBtnText: { color: '#aaa', fontWeight: '600', fontSize: 14 },

  // actions
  actionsBlock: { gap: 10, marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 13,
    borderRadius: 999,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    borderRadius: 999,
  },
  secondaryBtnText: { color: '#aaa', fontWeight: '600', fontSize: 14 },

  // match badge on schedule items
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,179,71,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,179,71,0.4)',
  },
  matchBadgeText: { color: '#ffb347', fontSize: 9, fontWeight: '700' },
});
