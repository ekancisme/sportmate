import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COURT_SPORT_OPTIONS, getCourtSportLabel, type CourtSportKey } from '@/constants/courtSports';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCourts, formatCourtPrice, resolveCourtImageUrl, type ApiCourt } from '@/lib/courtApi';

const PRIMARY = '#ff4d4f';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function CourtsScreen() {
  const { role } = useAuth();
  const [courts, setCourts] = useState<ApiCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<'all' | CourtSportKey>('all');

  const loadCourts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCourts();
      setCourts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách sân');
      setCourts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCourts();
    }, [loadCourts]),
  );

  const filteredCourts = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    return courts.filter((court) => {
      if (selectedSport !== 'all' && court.sportKey !== selectedSport) {
        return false;
      }
      if (!query) return true;

      const searchable = normalizeSearchText(
        [court.name, court.sportLabel, court.address, court.owner?.name, court.owner?.username]
          .filter(Boolean)
          .join(' '),
      );

      return searchable.includes(query);
    });
  }, [courts, searchQuery, selectedSport]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>Sân thể thao</Text>
        <Text style={styles.logo}>SportMate Courts</Text>
        <Text style={styles.title}>Tìm sân phù hợp và đặt lịch theo từng khung giờ trống.</Text>
        <Text style={styles.subtitle}>
          Tìm theo tên sân, bộ môn, địa chỉ và chọn nhanh bằng tag để xem các sân đang hoạt động.
        </Text>

        {role === 'owner' ? (
          <Pressable style={styles.ownerButton} onPress={() => router.push('/courts/my-courts' as never)}>
            <Ionicons name="settings-outline" size={18} color="#fff" />
            <Text style={styles.ownerButtonText}>Quản lý sân của tôi</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterCard}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm sân, bộ môn, địa chỉ..."
            placeholderTextColor="#777"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tagsWrap}>
          <Pressable
            style={[styles.tagChip, selectedSport === 'all' && styles.tagChipActive]}
            onPress={() => setSelectedSport('all')}>
            <Text style={[styles.tagText, selectedSport === 'all' && styles.tagTextActive]}>Tất cả</Text>
          </Pressable>

          {COURT_SPORT_OPTIONS.map((sport) => {
            const active = selectedSport === sport.key;
            return (
              <Pressable
                key={sport.key}
                style={[styles.tagChip, active && styles.tagChipActive]}
                onPress={() => setSelectedSport(sport.key)}>
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{sport.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.loadingText}>Đang tải danh sách sân...</Text>
        </View>
      ) : error ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadCourts}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : filteredCourts.length === 0 ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.emptyTitle}>
            {courts.length === 0 ? 'Chưa có sân nào được đăng.' : 'Không tìm thấy sân phù hợp.'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {courts.length === 0
              ? 'Hãy quay lại sau hoặc đăng sân nếu bạn là owner.'
              : 'Hãy thử đổi từ khóa tìm kiếm hoặc chọn tag bộ môn khác.'}
          </Text>
        </View>
      ) : (
        filteredCourts.map((court) => {
          const imageUri = resolveCourtImageUrl(court.images[0] || court.imageUrl);

          return (
            <Pressable
              key={court.id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/courts/[id]' as never, params: { id: court.id } })
              }>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.cardImage} />
              ) : (
                <View style={styles.cardImageFallback}>
                  <Ionicons name="business-outline" size={34} color={PRIMARY} />
                </View>
              )}

              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{court.name}</Text>
                  <View style={styles.sportBadge}>
                    <Text style={styles.sportBadgeText}>{getCourtSportLabel(court.sportKey)}</Text>
                  </View>
                </View>

                <Text style={styles.cardMeta}>{court.address}</Text>
                <Text style={styles.cardHours}>Mở cửa {court.openTime} - {court.closeTime}</Text>

                <View style={styles.cardInfoRow}>
                  <Text style={styles.cardPrice}>{formatCourtPrice(court.pricePerHour)}</Text>
                  <Text style={styles.cardOwner}>{court.owner?.name || court.owner?.username || 'Chủ sân SportMate'}</Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
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
    paddingTop: 24,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#101010',
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
    color: PRIMARY,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#bbb',
    fontSize: 13,
    lineHeight: 20,
  },
  ownerButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  ownerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterCard: {
    backgroundColor: '#101010',
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#181818',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    paddingVertical: 10,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#2c2c2c',
  },
  tagChipActive: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderColor: PRIMARY,
  },
  tagText: {
    color: '#bbb',
    fontSize: 12,
    fontWeight: '500',
  },
  tagTextActive: {
    color: PRIMARY,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#888',
    fontSize: 13,
  },
  feedbackCard: {
    backgroundColor: '#111',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff8888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  retryButtonText: {
    color: PRIMARY,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1d1d1d',
  },
  cardImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#0f0f0f',
  },
  cardImageFallback: {
    width: '100%',
    height: 150,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderWidth: 1,
    borderColor: '#4a2222',
  },
  sportBadgeText: {
    color: '#ffb3b3',
    fontSize: 11,
    fontWeight: '600',
  },
  cardMeta: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
  },
  cardHours: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  cardPrice: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  cardOwner: {
    color: '#888',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
});
