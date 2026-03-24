import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
  approveVenue,
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminVenues,
  fetchPendingVenues,
  rejectVenue,
  setAdminUserBan,
  updateAdminMatch,
  type AdminStats,
  type AdminUser,
  type AdminVenue,
  type AdminVenueStatus,
} from '@/lib/adminApi';
import {
  approveCourtAdmin,
  fetchAllCourtsAdmin,
  rejectCourtAdmin,
  type ApiCourt,
  type CourtApprovalStatus,
} from '@/lib/courtApi';
import { fetchMatches, type ApiMatch, type MatchStatus } from '@/lib/matchApi';

const PRIMARY = '#ff4d4f';

function roleLabel(role: AdminUser['role']) {
  return role === 'admin' ? 'Admin' : 'Người dùng';
}

function statusLabel(s: AdminVenueStatus) {
  if (s === 'pending') return 'Chờ duyệt';
  if (s === 'active') return 'Đã duyệt';
  return 'Từ chối';
}

function courtApprovalLabel(s: CourtApprovalStatus | undefined) {
  if (s === 'pending') return 'Chờ duyệt';
  if (s === 'active') return 'Đã duyệt';
  if (s === 'rejected') return 'Từ chối';
  return 'Chờ duyệt';
}

export default function AdminDashboard() {
  const { role, user: authUser } = useAuth();
  const { show, Alert: AppAlertNode } = useAppAlert();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [pendingVenues, setPendingVenues] = useState<AdminVenue[]>([]);
  const [allCourts, setAllCourts] = useState<ApiCourt[]>([]);

  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectCourtReasons, setRejectCourtReasons] = useState<Record<string, string>>({});

  const [selectedVenue, setSelectedVenue] = useState<AdminVenue | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<ApiCourt | null>(null);

  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesErr, setMatchesErr] = useState<string | null>(null);

  const [matchModal, setMatchModal] = useState<{
    match: ApiMatch;
    mode: 'finished' | 'cancelled';
  } | null>(null);
  const [winnersInput, setWinnersInput] = useState('');
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  const reloadAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const [s, u, v, p, c] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminVenues('active'),
        fetchPendingVenues(),
        fetchAllCourtsAdmin(),
      ]);
      setStats(s);
      setUsers(u);
      setVenues(v);
      setPendingVenues(p);
      setAllCourts(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải admin thất bại');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') void reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const canManage = role === 'admin';
  type AdminSubTab = 'dashboard' | 'users' | 'venues' | 'matches';
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('dashboard');
  const adminId = authUser?.id ?? '';

  useEffect(() => {
    if (role !== 'admin') return;
    if (adminSubTab !== 'matches') return;
    (async () => {
      setMatchesLoading(true);
      setMatchesErr(null);
      try {
        const list = await fetchMatches();
        setMatches(list);
      } catch (e) {
        setMatchesErr(e instanceof Error ? e.message : 'Không tải được danh sách trận');
        setMatches([]);
      } finally {
        setMatchesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSubTab, role]);

  const onBanUser = async (userId: string, nextIsBanned: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await setAdminUserBan(userId, nextIsBanned);
      await reloadAll();
      if (selectedUser?.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, isBanned: nextIsBanned } : prev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không cập nhật ban được');
    } finally {
      setLoading(false);
    }
  };

  const onApproveVenue = async (venueId: string) => {
    setLoading(true);
    setError(null);
    try {
      await approveVenue(venueId);
      await reloadAll();
      if (selectedVenue?.id === venueId) setSelectedVenue(null);
      show('Đã duyệt', 'Sân đã được duyệt.', { variant: 'info' });
    } catch (e) {
      show('Lỗi', e instanceof Error ? e.message : 'Duyệt thất bại', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const onRejectVenue = async (venueId: string) => {
    const reason = (rejectReasons[venueId] ?? '').trim();
    if (reason.length < 3) {
      show('Thiếu lý do', 'Vui lòng nhập lý do từ chối (ít nhất 3 ký tự).', { variant: 'error' });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await rejectVenue(venueId, reason);
      await reloadAll();
      if (selectedVenue?.id === venueId) setSelectedVenue(null);
      show('Đã từ chối', 'Sân đã được từ chối.', { variant: 'info' });
    } catch (e) {
      show('Lỗi', e instanceof Error ? e.message : 'Từ chối thất bại', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const onApproveCourt = async (courtId: string) => {
    setLoading(true);
    setError(null);
    try {
      await approveCourtAdmin(courtId);
      await reloadAll();
      if (selectedCourt?.id === courtId) setSelectedCourt(null);
      show('Đã duyệt', 'Sân đã được duyệt và hiển thị public.', { variant: 'info' });
    } catch (e) {
      show('Lỗi', e instanceof Error ? e.message : 'Duyệt thất bại', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const onRejectCourt = async (courtId: string) => {
    const reason = (rejectCourtReasons[courtId] ?? '').trim();
    if (reason.length < 3) {
      show('Thiếu lý do', 'Vui lòng nhập lý do từ chối (ít nhất 3 ký tự).', { variant: 'error' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await rejectCourtAdmin(courtId, reason);
      await reloadAll();
      if (selectedCourt?.id === courtId) setSelectedCourt(null);
      show('Đã từ chối', 'Sân đã bị từ chối.', { variant: 'info' });
    } catch (e) {
      show('Lỗi', e instanceof Error ? e.message : 'Từ chối thất bại', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const venueCard = useMemo(() => {
    const renderStatusPill = (s: AdminVenueStatus) => (
      <View
        style={[
          styles.pill,
              s === 'active'
                ? styles.pillApproved
                : s === 'rejected'
              ? styles.pillRejected
              : styles.pillPending,
        ]}>
        <Text style={styles.pillText}>{statusLabel(s)}</Text>
      </View>
    );

    return {
      renderStatusPill,
    };
  }, []);

  const courtApprovalPill = (s: CourtApprovalStatus | undefined) => (
    <View
      style={[
        styles.pill,
        s === 'active'
          ? styles.pillApproved
          : s === 'rejected'
          ? styles.pillRejected
          : styles.pillPending,
      ]}>
      <Text style={styles.pillText}>{courtApprovalLabel(s)}</Text>
    </View>
  );

  const allVenues = useMemo(() => [...pendingVenues, ...venues], [pendingVenues, venues]);

  // Sắp xếp: pending lên đầu, sau đó active, cuối cùng rejected
  const sortedCourts = useMemo(() => {
    const order: Record<string, number> = { pending: 0, active: 1, rejected: 2 };
    return [...allCourts].sort(
      (a, b) => (order[a.approvalStatus ?? 'pending'] ?? 0) - (order[b.approvalStatus ?? 'pending'] ?? 0),
    );
  }, [allCourts]);

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Pressable
          onPress={() => router.push('/(tabs)/my-profile')}
          style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={PRIMARY} />
        </Pressable>
        <Text style={styles.deniedTitle}>Trang Quản Lý</Text>
        <Text style={styles.deniedText}>
          Bạn cần đăng nhập với quyền <Text style={{ color: PRIMARY, fontWeight: '700' }}>Admin</Text> để truy cập.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 180 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push('/(tabs)/my-profile')}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
            <Ionicons name="chevron-back" size={20} color={PRIMARY} />
          </Pressable>
          <Ionicons name="shield-checkmark" size={22} color={PRIMARY} />
          <Text style={styles.title}>Trang Quản Lý</Text>
        </View>
      <Text style={styles.subtitle}>Thống kê dữ liệu, quản lý user và sân cho thuê + duyệt sân.</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : null}

      {adminSubTab === 'dashboard' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dữ liệu thống kê</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>User</Text>
              <Text style={styles.statValue}>{stats?.usersCount ?? 0}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Trận đấu</Text>
              <Text style={styles.statValue}>{stats?.matchesCount ?? 0}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Sân chờ duyệt</Text>
              <Text style={[styles.statValue, { color: '#f5a623' }]}>{stats?.courts?.pending ?? 0}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Sân đã duyệt</Text>
              <Text style={[styles.statValue, { color: '#4caf50' }]}>{stats?.courts?.active ?? 0}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {adminSubTab === 'users' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quản lý user</Text>
          {users.length === 0 ? (
            <Text style={styles.mutedText}>Chưa có dữ liệu.</Text>
          ) : (
            users.slice(0, 30).map((u) => (
              <Pressable
                key={u.id}
                onPress={() => setSelectedUser(u)}
                style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.9 }]}>
                <View style={styles.listTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>
                      {u.name || u.username} <Text style={styles.listMeta}>@{u.username}</Text>
                    </Text>
                    <Text style={styles.listMeta}>
                      Vai trò: {roleLabel(u.role)} • Win rate: {u.stats?.winRate ?? 0}% •{' '}
                      {u.isBanned ? 'Đã ban' : 'Đang hoạt động'}
                    </Text>
                  </View>
                  <View style={styles.roleBtns}>
                    {u.role === 'admin' ? null : (
                      <Pressable
                        style={[
                          styles.actionBtn,
                          u.isBanned ? styles.actionBtnSecondary : styles.actionBtnPrimary,
                        ]}
                        onPress={() => onBanUser(u.id, !u.isBanned)}>
                        <Text style={styles.actionBtnText}>{u.isBanned ? 'Gỡ ban' : 'Ban'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {adminSubTab === 'venues' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quản lý sân cho thuê</Text>

          <View style={{ marginTop: 12 }}>
            {sortedCourts.length === 0 ? <Text style={styles.mutedText}>Chưa có sân.</Text> : null}
            {sortedCourts.slice(0, 50).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCourt(c)}
                style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.9 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>
                    {c.name} <Text style={styles.listMeta}>• {c.sportLabel || 'Không rõ môn'}</Text>
                  </Text>
                  <Text style={styles.listMeta}>
                    {c.address || 'Chưa có địa chỉ'} • {c.pricePerHour.toLocaleString()}đ/giờ
                  </Text>
                  {c.owner ? (
                    <Text style={styles.listMeta}>Chủ: {c.owner.name || c.owner.username || '—'}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  {courtApprovalPill(c.approvalStatus)}
                  {c.approvalStatus === 'pending' ? (
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnPrimary, { paddingVertical: 6 }]}
                      onPress={() => onApproveCourt(c.id)}>
                      <Text style={styles.actionBtnText}>Duyệt</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {adminSubTab === 'matches' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quản lý trận đấu</Text>

          {matchesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
          ) : matchesErr ? (
            <Text style={styles.errorText}>{matchesErr}</Text>
          ) : matches.length === 0 ? (
            <Text style={styles.mutedText}>Chưa có trận nào.</Text>
          ) : (
            matches.slice(0, 30).map((m) => {
              const st = m.status ?? 'active';
              const statusText =
                st === 'active' ? 'Đang mở' : st === 'finished' ? 'Đã kết thúc' : 'Đã hủy';

              return (
                <View key={m.id} style={styles.listCard}>
                  <View style={styles.listTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>
                        {m.title} <Text style={styles.listMeta}>• {m.sport}</Text>
                      </Text>
                      <Text style={styles.listMeta}>{m.location}</Text>
                      <Text style={styles.listMeta}>
                        {m.date} • {m.time || '—'} • {statusText}
                      </Text>
                    </View>
                    <View style={styles.matchActions}>
                      <Pressable
                        style={[styles.actionBtn, styles.actionBtnSecondary]}
                        onPress={async () => {
                          try {
                            setLoading(true);
                            await updateAdminMatch(m.id, adminId, { status: 'active' });
                            const list = await fetchMatches();
                            setMatches(list);
                            await reloadAll();
                            show('Thành công', 'Đã đặt trận trạng thái đang mở.', { variant: 'info' });
                          } catch (e) {
                            show('Lỗi', e instanceof Error ? e.message : 'Không cập nhật được', { variant: 'error' });
                          } finally {
                            setLoading(false);
                          }
                        }}>
                        <Text style={styles.actionBtnText}>Đang mở</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() => {
                          setMatchModal({ match: m, mode: 'finished' });
                          setWinnersInput('');
                        }}>
                        <Text style={styles.actionBtnText}>Kết thúc</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionBtn, styles.actionBtnSecondary]}
                        onPress={() => {
                          setMatchModal({ match: m, mode: 'cancelled' });
                          setCancelReasonInput('');
                        }}>
                        <Text style={styles.actionBtnText}>Hủy</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {AppAlertNode}
      </ScrollView>
      <View style={styles.subTabsBar}>
        <Pressable
          onPress={() => setAdminSubTab('dashboard')}
          style={({ pressed }) => [
            styles.subTabBtn,
            adminSubTab === 'dashboard' && styles.subTabBtnActive,
            pressed && { opacity: 0.9 },
          ]}>
          <Ionicons
            name="speedometer-outline"
            size={18}
            color={adminSubTab === 'dashboard' ? PRIMARY : '#888'}
          />
          <Text style={[styles.subTabLabel, adminSubTab === 'dashboard' && styles.subTabLabelActive]}>
            Tổng quan
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setAdminSubTab('users')}
          style={({ pressed }) => [
            styles.subTabBtn,
            adminSubTab === 'users' && styles.subTabBtnActive,
            pressed && { opacity: 0.9 },
          ]}>
          <Ionicons
            name="people-outline"
            size={18}
            color={adminSubTab === 'users' ? PRIMARY : '#888'}
          />
          <Text style={[styles.subTabLabel, adminSubTab === 'users' && styles.subTabLabelActive]}>
            Quản lý user
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setAdminSubTab('venues')}
          style={({ pressed }) => [
            styles.subTabBtn,
            adminSubTab === 'venues' && styles.subTabBtnActive,
            pressed && { opacity: 0.9 },
          ]}>
          <Ionicons
            name="football-outline"
            size={18}
            color={adminSubTab === 'venues' ? PRIMARY : '#888'}
          />
          <Text style={[styles.subTabLabel, adminSubTab === 'venues' && styles.subTabLabelActive]}>
            Sân
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setAdminSubTab('matches')}
          style={({ pressed }) => [
            styles.subTabBtn,
            adminSubTab === 'matches' && styles.subTabBtnActive,
            pressed && { opacity: 0.9 },
          ]}>
          <Ionicons
            name="trophy-outline"
            size={18}
            color={adminSubTab === 'matches' ? PRIMARY : '#888'}
          />
          <Text
            style={[
              styles.subTabLabel,
              adminSubTab === 'matches' && styles.subTabLabelActive,
            ]}>
            Trận đấu
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={selectedUser !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}>
        {selectedUser ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Chi tiết user</Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedUser(null)}>
                  <Text style={styles.modalCloseBtnText}>X</Text>
                </Pressable>
              </View>
              <Text style={styles.modalName}>{selectedUser.name || selectedUser.username}</Text>
              <Text style={styles.modalMeta}>@{selectedUser.username}</Text>
              <Text style={styles.modalMeta}>
                Vai trò: {roleLabel(selectedUser.role)} • Trạng thái:{' '}
                {selectedUser.isBanned ? 'Đã ban' : 'Đang hoạt động'}
              </Text>
              <Text style={styles.modalMeta}>Email: {selectedUser.email || 'Chưa có'}</Text>
              <Text style={styles.modalMeta}>SĐT: {selectedUser.phone || 'Chưa có'}</Text>
              <Text style={styles.modalMeta}>Khu vực: {selectedUser.location || 'Chưa có'}</Text>
              <Text style={styles.modalMeta}>Tuổi: {selectedUser.age ?? 'Chưa có'}</Text>
              <Text style={styles.modalMeta}>Số trận: {selectedUser.stats?.matchesPlayed ?? 0}</Text>
              <Text style={styles.modalMeta}>Win rate: {selectedUser.stats?.winRate ?? 0}%</Text>
              <Text style={styles.modalBodyText}>{selectedUser.bio || 'Chưa có giới thiệu.'}</Text>

              {selectedUser.role !== 'admin' ? (
                <Pressable
                  style={[
                    styles.actionBtn,
                    selectedUser.isBanned ? styles.actionBtnSecondary : styles.actionBtnPrimary,
                  ]}
                  onPress={() => onBanUser(selectedUser.id, !selectedUser.isBanned)}>
                  <Text style={styles.actionBtnText}>
                    {selectedUser.isBanned ? 'Gỡ ban user này' : 'Ban user này'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={selectedVenue !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedVenue(null)}>
        {selectedVenue ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Chi tiết sân</Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedVenue(null)}>
                  <Text style={styles.modalCloseBtnText}>X</Text>
                </Pressable>
              </View>

              <View style={{ marginBottom: 10 }}>
                {venueCard.renderStatusPill(selectedVenue.status)}
              </View>

              <Text style={styles.modalName}>{selectedVenue.name}</Text>
              <Text style={styles.modalMeta}>
                {selectedVenue.sport || 'Không rõ môn'} •{' '}
                {selectedVenue.pricePerHour.toLocaleString()}đ/giờ
              </Text>
              <Text style={styles.modalMeta}>{selectedVenue.address || 'Chưa có địa chỉ'}</Text>
              {selectedVenue.description ? (
                <Text style={styles.modalBodyText}>{selectedVenue.description}</Text>
              ) : (
                <Text style={styles.modalBodyText}>Chưa có mô tả.</Text>
              )}

              {selectedVenue.status === 'pending' ? (
                <>
                  <Text style={styles.modalSectionTitle}>Lý do từ chối (nếu cần)</Text>
                  <TextInput
                    style={[styles.input, styles.rejectInput]}
                    placeholder="Nhập lý do từ chối..."
                    placeholderTextColor="#777"
                    value={rejectReasons[selectedVenue.id] ?? ''}
                    onChangeText={(t) => setRejectReasons((prev) => ({ ...prev, [selectedVenue.id]: t }))}
                  />
                  <View style={styles.modalActionsRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => onApproveVenue(selectedVenue.id)}>
                      <Text style={styles.actionBtnText}>Duyệt</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => onRejectVenue(selectedVenue.id)}>
                      <Text style={styles.actionBtnText}>Từ chối</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <View style={{ height: 6 }} />
              <Pressable style={styles.actionBtn} onPress={() => setSelectedVenue(null)}>
                <Text style={styles.actionBtnText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Modal chi tiết Court */}
      <Modal
        visible={selectedCourt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCourt(null)}>
        {selectedCourt ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Chi tiết sân đăng ký</Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedCourt(null)}>
                  <Text style={styles.modalCloseBtnText}>X</Text>
                </Pressable>
              </View>

              <View style={{ marginBottom: 10 }}>
                {courtApprovalPill(selectedCourt.approvalStatus)}
              </View>

              <Text style={styles.modalName}>{selectedCourt.name}</Text>
              <Text style={styles.modalMeta}>
                {selectedCourt.sportLabel || 'Không rõ môn'} •{' '}
                {selectedCourt.pricePerHour.toLocaleString()}đ/giờ
              </Text>
              <Text style={styles.modalMeta}>{selectedCourt.address || 'Chưa có địa chỉ'}</Text>
              {selectedCourt.owner ? (
                <Text style={styles.modalMeta}>
                  Chủ sân: {selectedCourt.owner.name || selectedCourt.owner.username || '—'}
                </Text>
              ) : null}
              <Text style={styles.modalMeta}>
                Giờ mở: {selectedCourt.openTime} – {selectedCourt.closeTime}
              </Text>
              {selectedCourt.description ? (
                <Text style={styles.modalBodyText}>{selectedCourt.description}</Text>
              ) : (
                <Text style={styles.modalBodyText}>Chưa có mô tả.</Text>
              )}

              {selectedCourt.approvalStatus === 'rejected' && selectedCourt.rejectReason ? (
                <Text style={[styles.modalMeta, { color: '#ff8888', marginTop: 6 }]}>
                  Lý do từ chối: {selectedCourt.rejectReason}
                </Text>
              ) : null}

              {selectedCourt.approvalStatus === 'pending' ? (
                <>
                  <Text style={styles.modalSectionTitle}>Lý do từ chối (nếu cần)</Text>
                  <TextInput
                    style={[styles.input, styles.rejectInput]}
                    placeholder="Nhập lý do từ chối..."
                    placeholderTextColor="#777"
                    value={rejectCourtReasons[selectedCourt.id] ?? ''}
                    onChangeText={(t) =>
                      setRejectCourtReasons((prev) => ({ ...prev, [selectedCourt.id]: t }))
                    }
                  />
                  <View style={styles.modalActionsRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => onApproveCourt(selectedCourt.id)}>
                      <Text style={styles.actionBtnText}>✓ Duyệt</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => onRejectCourt(selectedCourt.id)}>
                      <Text style={styles.actionBtnText}>✕ Từ chối</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <View style={{ height: 6 }} />
              <Pressable style={styles.actionBtn} onPress={() => setSelectedCourt(null)}>
                <Text style={styles.actionBtnText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={matchModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchModal(null)}>
        {matchModal ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Cập nhật trận đấu</Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setMatchModal(null)}>
                  <Text style={styles.modalCloseBtnText}>X</Text>
                </Pressable>
              </View>

              <Text style={styles.modalName}>{matchModal.match.title}</Text>
              <Text style={styles.modalMeta}>{matchModal.match.sport}</Text>

              {matchModal.mode === 'finished' ? (
                <>
                  <Text style={styles.modalSectionTitle}>Người thắng (ID, cách nhau bởi dấu phẩy)</Text>
                  <TextInput
                    style={[styles.input, styles.rejectInput]}
                    placeholder="VD: 64a...1, 64a...2"
                    placeholderTextColor="#777"
                    value={winnersInput}
                    onChangeText={setWinnersInput}
                  />
                  <Text style={styles.modalHintText}>
                    Người tham gia (gợi ý):{' '}
                    {(matchModal.match.participants ?? [])
                      .slice(0, 6)
                      .map((p) => `${p.name}(${p.id})`)
                      .join(', ')}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.modalSectionTitle}>Lý do hủy</Text>
                  <TextInput
                    style={[styles.input, styles.rejectInput]}
                    placeholder="Nhập lý do (ít nhất 5 ký tự)"
                    placeholderTextColor="#777"
                    value={cancelReasonInput}
                    onChangeText={setCancelReasonInput}
                  />
                </>
              )}

              <View style={styles.modalActionsRow}>
                <Pressable style={styles.actionBtn} onPress={() => setMatchModal(null)}>
                  <Text style={styles.actionBtnText}>Đóng</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={async () => {
                    try {
                      setLoading(true);
                      if (matchModal.mode === 'finished') {
                        const winners = winnersInput
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean);
                        if (winners.length === 0) {
                          show('Thiếu dữ liệu', 'Vui lòng nhập người thắng.', { variant: 'error' });
                          return;
                        }
                        await updateAdminMatch(matchModal.match.id, adminId, {
                          status: 'finished',
                          winners,
                        });
                      } else {
                        const reason = cancelReasonInput.trim();
                        await updateAdminMatch(matchModal.match.id, adminId, {
                          status: 'cancelled',
                          cancelReason: reason,
                        });
                      }

                      setMatchModal(null);
                      const list = await fetchMatches();
                      setMatches(list);
                      await reloadAll();
                      show('Thành công', 'Đã cập nhật trận.', { variant: 'info' });
                    } catch (e) {
                      show('Lỗi', e instanceof Error ? e.message : 'Không cập nhật được', { variant: 'error' });
                    } finally {
                      setLoading(false);
                    }
                  }}>
                  <Text style={styles.actionBtnText}>Lưu</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  subTabsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderTopColor: '#222',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  subTabBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 14,
  },
  subTabBtnActive: {
    backgroundColor: 'rgba(255,77,79,0.14)',
  },
  subTabLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  subTabLabelActive: {
    color: PRIMARY,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  backBtnPressed: {
    opacity: 0.85,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff8888',
    fontSize: 13,
    marginBottom: 10,
  },
  loadingBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 13,
  },
  deniedTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 40,
  },
  deniedText: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 13,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  mutedText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  listCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  listTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  listTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listMeta: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  roleBtns: {
    alignItems: 'flex-end',
  },
  matchActions: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
    maxWidth: 120,
  },
  formCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
    gap: 10,
  },
  formTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#050505',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#222',
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnPrimary: {
    backgroundColor: 'rgba(255,77,79,0.18)',
    borderColor: 'rgba(255,77,79,0.9)',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(120,180,255,0.08)',
    borderColor: 'rgba(120,180,255,0.6)',
  },
  actionBtnPrimarySmall: {
    backgroundColor: 'rgba(255,77,79,0.18)',
    borderColor: 'rgba(255,77,79,0.9)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionBtnSecondarySmall: {
    backgroundColor: 'rgba(120,180,255,0.08)',
    borderColor: 'rgba(120,180,255,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  pillPending: {
    backgroundColor: 'rgba(255,180,0,0.12)',
    borderColor: 'rgba(255,180,0,0.65)',
  },
  pillApproved: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(74,222,128,0.65)',
  },
  pillRejected: {
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderColor: 'rgba(255,77,77,0.65)',
  },
  pillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectInput: {
    width: 220,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    color: '#ff8888',
    fontWeight: '800',
    fontSize: 14,
  },
  modalName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalMeta: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 4,
  },
  modalBodyText: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 10,
  },
  modalSectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHintText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});

