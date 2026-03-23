import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import { deleteCourt, fetchMyCourts, formatCourtPrice, resolveCourtImageUrl, type ApiCourt } from '@/lib/courtApi';

const PRIMARY = '#ff4d4f';

export default function MyCourtsScreen() {
  const { role, user } = useAuth();
  const params = useLocalSearchParams<{ notice?: string | string[] }>();
  const { show, Alert: AppAlertNode } = useAppAlert();
  const [courts, setCourts] = useState<ApiCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const noticeText = useMemo(() => {
    const raw = Array.isArray(params.notice) ? params.notice[0] : params.notice;
    if (raw === 'created') return 'Dang san thanh cong. San cua ban da san sang cho viec dat lich.';
    if (raw === 'updated') return 'Cap nhat san thanh cong.';
    return '';
  }, [params.notice]);

  const loadCourts = useCallback(async () => {
    if (role !== 'owner' || !user?.id) {
      setCourts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyCourts(user.id);
      setCourts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong tai duoc san cua ban');
      setCourts([]);
    } finally {
      setLoading(false);
    }
  }, [role, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadCourts();
    }, [loadCourts]),
  );

  const handleDelete = (court: ApiCourt) => {
    if (!user?.id) return;

    show('Xoa san', `Ban co chac muon xoa "${court.name}"?`, {
      variant: 'error',
      confirmLabel: 'Xoa',
      cancelLabel: 'Huy',
      onConfirm: () => {
        void (async () => {
          setBusyId(court.id);
          try {
            await deleteCourt(court.id, user.id);
            setCourts((prev) => prev.filter((item) => item.id !== court.id));
          } catch (error) {
            show('Khong xoa duoc', error instanceof Error ? error.message : 'Co loi xay ra', {
              variant: 'error',
            });
          } finally {
            setBusyId(null);
          }
        })();
      },
    });
  };

  if (role !== 'owner') {
    return (
      <>
        <View style={styles.deniedWrap}>
          <Text style={styles.deniedTitle}>Khu vuc danh cho owner</Text>
          <Text style={styles.deniedText}>Chi tai khoan owner moi co the dang va quan ly san cua minh.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/courts' as never)}>
            <Text style={styles.secondaryBtnText}>Xem danh sach san</Text>
          </Pressable>
        </View>
        {AppAlertNode}
      </>
    );
  }

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={PRIMARY} />
            <Text style={styles.backText}>Quay lai</Text>
          </Pressable>
        </View>

        <View style={styles.headerCard}>
          <Text style={styles.title}>San cua toi</Text>
          <Text style={styles.subtitle}>
            Dang san moi, chinh sua thong tin va theo doi lich dat cua tung san ngay tren man quan ly.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/courts/create' as never)}>
            <Text style={styles.primaryBtnText}>+ Dang san moi</Text>
          </Pressable>
        </View>

        {noticeText ? (
          <View style={styles.noticeCard}>
            <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
            <Text style={styles.noticeText}>{noticeText}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : courts.length === 0 ? (
          <Text style={styles.emptyText}>Ban chua dang san nao.</Text>
        ) : (
          courts.map((court) => {
            const isBusy = busyId === court.id;
            const coverImage = resolveCourtImageUrl(court.images[0] || court.imageUrl);

            return (
              <View key={court.id} style={styles.card}>
                <Pressable
                  style={styles.cardTop}
                  onPress={() =>
                    router.push({ pathname: '/courts/[id]' as never, params: { id: court.id } })
                  }>
                  {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Ionicons name="business-outline" size={28} color={PRIMARY} />
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{court.name}</Text>
                    <Text style={styles.cardSport}>{court.sportLabel}</Text>
                    <Text style={styles.cardMeta}>{court.address}</Text>
                    <Text style={styles.cardPrice}>{formatCourtPrice(court.pricePerHour)}</Text>
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.secondaryAction}
                    onPress={() =>
                      router.push({ pathname: '/courts/create' as never, params: { editId: court.id } })
                    }
                    disabled={isBusy}>
                    <Text style={styles.secondaryActionText}>Sua</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryAction}
                    onPress={() => router.push(`/courts/bookings?courtId=${court.id}` as never)}
                    disabled={isBusy}>
                    <Text style={styles.primaryActionText}>Lich dat</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteAction}
                    onPress={() => handleDelete(court)}
                    disabled={isBusy}>
                    <Text style={styles.deleteActionText}>{isBusy ? '...' : 'Xoa'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      {AppAlertNode}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  topRow: {
    marginBottom: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  backText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '500',
  },
  headerCard: {
    backgroundColor: '#101010',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 77, 79, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4a2222',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    color: '#ffd1d1',
    fontSize: 13,
    lineHeight: 18,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff8888',
    fontSize: 13,
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  coverImage: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: '#151515',
  },
  coverFallback: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSport: {
    color: '#ffb3b3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardMeta: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 18,
  },
  cardPrice: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 12,
  },
  primaryAction: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  deleteAction: {
    borderWidth: 1,
    borderColor: '#884444',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  deleteActionText: {
    color: '#f08080',
    fontWeight: '600',
    fontSize: 12,
  },
  deniedWrap: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deniedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  deniedText: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  secondaryBtnText: {
    color: PRIMARY,
    fontWeight: '600',
  },
});
