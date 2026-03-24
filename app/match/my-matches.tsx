import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
    deleteMatch,
    fetchMyMatches,
    formatDateVi,
    type ApiMatch,
} from '@/lib/matchApi';
import { computeDisplayStatus } from '@/lib/matchStatus';
import { StatusBadge } from '@/components/StatusBadge';

const PRIMARY = '#ff4d4f';

export type MyMatchesScreenProps = {
  /** Khi mở trong tab bar — ẩn nút quay lại */
  embeddedInTab?: boolean;
};

export default function MyMatchesScreen({ embeddedInTab = false }: MyMatchesScreenProps) {
  const { user } = useAuth();
  const { show, Alert: AppAlertNode } = useAppAlert();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<ApiMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const rows = await fetchMyMatches(user.id);
      setList(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onDelete = (m: ApiMatch) => {
    if (!user?.id) return;
    show('Xóa trận', `Bạn có chắc muốn xóa "${m.title}"? Hành động không hoàn tác.`, {
      variant: 'error',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      onConfirm: () => {
        void (async () => {
          try {
            await deleteMatch(m.id, user.id);
            setList((prev) => prev.filter((x) => x.id !== m.id));
          } catch (e) {
            show(
              'Lỗi',
              e instanceof Error ? e.message : 'Không xóa được',
              { variant: 'error' },
            );
          }
        })();
      },
    });
  };

  if (!user?.id) {
    return (
      <Fragment>
        <View style={[styles.centered, { paddingTop: insets.top + 40 }]}>
          <Text style={styles.muted}>Đăng nhập để xem trận bạn tạo và trận bạn tham gia.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(auth)')}>
            <Text style={styles.primaryBtnText}>Đăng nhập</Text>
          </Pressable>
        </View>
        {AppAlertNode}
      </Fragment>
    );
  }

  return (
    <Fragment>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {!embeddedInTab ? (
        <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={PRIMARY} />
            <Text style={styles.backText}>Quay lại</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingTop: insets.top + 8 }} />
      )}
      <Text style={styles.title}>Trận của tôi</Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : err ? (
        <Text style={styles.err}>{err}</Text>
      ) : list.length === 0 ? (
        <Text style={styles.muted}>
          Chưa có trận nào. Tham gia trận trên trang chủ hoặc tạo trận mới.
        </Text>
      ) : (
        list.map((m) => {
          const cur = Number(m.currentPlayers ?? 0);
          const isHost = Boolean(user?.id && m.hostId && user.id === m.hostId);
          return (
            <View key={m.id} style={styles.card}>
              <Pressable
                onPress={() => router.push({ pathname: '/match', params: { id: m.id } })}>
                <View style={[styles.cardTitleRow, { alignItems: 'center' }]}>
                  <Text style={styles.cardTitle}>{m.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <StatusBadge
                      status={computeDisplayStatus(m.status ?? 'active', m.date, m.time)}
                      size="sm"
                    />
                    <View style={[styles.roleBadge, isHost ? styles.roleBadgeHost : styles.roleBadgeJoin]}>
                      <Text style={styles.roleBadgeText}>{isHost ? 'Host' : 'Tham gia'}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {m.sport} • {formatDateVi(m.date)} • {m.time || '—'}
                </Text>
                <Text style={styles.cardMeta}>{m.location}</Text>
                <Text style={styles.cardPlayers}>
                  Người chơi: {cur}/{m.maxPlayers}
                </Text>
              </Pressable>
              {isHost ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/match/create-match',
                        params: { editId: m.id },
                      })
                    }>
                    <Text style={styles.secondaryBtnText}>Sửa</Text>
                  </Pressable>
                  <Pressable style={styles.dangerBtn} onPress={() => onDelete(m)}>
                    <Text style={styles.dangerBtnText}>Xóa</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
    {AppAlertNode}
    </Fragment>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 16,
  },
  topRow: {
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  backText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  sub: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  err: {
    color: '#f88',
    fontSize: 14,
  },
  muted: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
    textTransform: 'uppercase',
  },
  cardMeta: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 2,
  },
  cardPlayers: {
    color: '#ddd',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
  dangerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#884444',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#f08080',
    fontWeight: '600',
    fontSize: 14,
  },
});
