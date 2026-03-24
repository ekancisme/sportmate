import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
  fetchMatchById,
  formatDateVi,
  joinMatch,
  checkJoinMatch,
  leaveMatch,
  mapApiMatchToDetail,
  type MatchDetail,
} from '@/lib/matchApi';
import { computeDisplayStatus } from '@/lib/matchStatus';
import { StatusBadge } from '@/components/StatusBadge';

const PRIMARY = '#ff4d4f';
const HEADER_MAROON = '#3d1419';
const BACK_ACCENT = '#ff6b9d';
const CARD_BG = '#1c1c1e';
const TEXT_DIM = '#a8a8a8';
const BADGE_RED = '#6b1c24';
const SKILL_HIGH = '#e6c200';
const SKILL_MID = '#5dd5e8';
const SKILL_LOW = '#9ca3af';

function skillColor(level: 'Beginner' | 'Intermediate' | 'Advanced') {
  if (level === 'Advanced') return SKILL_HIGH;
  if (level === 'Intermediate') return SKILL_MID;
  return SKILL_LOW;
}

function skillLabelVi(level: 'Beginner' | 'Intermediate' | 'Advanced') {
  if (level === 'Advanced') return 'Cao';
  if (level === 'Intermediate') return 'Trung Bình';
  return 'Sơ cấp';
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export default function MatchDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; refresh?: string }>();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { show, Alert: AppAlertNode } = useAppAlert();
  const [baseMatch, setBaseMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const rawId = params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        setFetchError('Thiếu mã trận');
        setBaseMatch(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const raw = await fetchMatchById(id, { userId: user?.id });
        if (cancelled) return;
        setBaseMatch(mapApiMatchToDetail(raw));
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : 'Lỗi tải trận');
          setBaseMatch(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id, params.refresh, user?.id]);

  const match = baseMatch ?? undefined;

  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth - 32;
  const participantCardWidth = (pageWidth - 12) / 2;

  const participantPages = useMemo(
    () => chunkArray(match?.participants ?? [], 4),
    [match?.participants],
  );

  const [participantPageIndex, setParticipantPageIndex] = useState(0);

  useEffect(() => {
    setParticipantPageIndex(0);
  }, [match?.id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Đang tải trận...</Text>
      </View>
    );
  }

  if (fetchError || !match) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{fetchError ?? 'Không tìm thấy trận đấu.'}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
          <Text style={styles.retryBtnText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const isFavorite = favorites[match.id] ?? false;
  const isJoined = Boolean(match.viewerJoined);
  const spotsLeft = Math.max(0, match.maxPlayers - match.currentPlayers);
  const matchStatus = match.status ?? 'active';
  const isHost = Boolean(user?.id && match.hostId && user.id === match.hostId);

  const toggleFavorite = () => {
    setFavorites((prev) => ({ ...prev, [match.id]: !isFavorite }));
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `${match.title}\n${match.location}\n${match.date}`,
        title: match.title,
      });
    } catch {
      /* ignore */
    }
  };

  const toggleJoin = async () => {
    if (!user?.id) {
      show('Đăng nhập', 'Vui lòng đăng nhập để tham gia trận.', { variant: 'info' });
      return;
    }
    if (matchStatus === 'finished') {
      show('Trận đã kết thúc', 'Bạn không thể tham gia hoặc rời trận này nữa.', {
        variant: 'info',
      });
      return;
    }
    if (matchStatus === 'cancelled') {
      show('Trận đã bị hủy', 'Bạn không thể tham gia hoặc rời trận này nữa.', {
        variant: 'info',
      });
      return;
    }
    if (isJoined) {
      show('Xác nhận rời trận', `Bạn có chắc muốn hủy tham gia "${match.title}" không?`, {
        variant: 'info',
        confirmLabel: 'Rời trận',
        cancelLabel: 'Hủy',
        onConfirm: () => {
          void (async () => {
            setJoinBusy(true);
            try {
              const raw = await leaveMatch(match.id, user.id);
              setBaseMatch(mapApiMatchToDetail(raw));
              // Cập nhật lịch trình trong AuthContext
              void refreshUser();
            } catch (e) {
              show(
                'Lỗi',
                e instanceof Error ? e.message : 'Thao tác thất bại',
                { variant: 'error' },
              );
            } finally {
              setJoinBusy(false);
            }
          })();
        },
      });
      return;
    }

    const doJoin = async () => {
      setJoinBusy(true);
      try {
        const raw = await joinMatch(match.id, user.id);
        setBaseMatch(mapApiMatchToDetail(raw));
      } catch (e) {
        show('Lỗi', e instanceof Error ? e.message : 'Thao tác thất bại', {
          variant: 'error',
        });
      } finally {
        setJoinBusy(false);
      }
    };

    try {
<<<<<<< HEAD
      const check = await checkJoinMatch(match.id, user.id);

      if (!check.allow && check.reason === 'overlap') {
        show(
          'Trùng khung giờ',
          'Bạn đã có trận khác trùng khung giờ trong ngày này. Không thể tham gia.',
          { variant: 'error' },
        );
        return;
      }

      if (check.reason === 'hasOtherMatch') {
        show(
          'Trong ngày hôm nay',
          'Bạn đang có trận khác (không trùng giờ). Bạn có muốn tham gia trận này không?',
          {
            variant: 'info',
            confirmLabel: 'Tham gia',
            cancelLabel: 'Hủy',
            onConfirm: () => {
              void doJoin();
            },
          },
        );
        return;
      }

      await doJoin();
=======
      const raw = await joinMatch(match.id, user.id);
      setBaseMatch(mapApiMatchToDetail(raw));
      // Cập nhật lịch trình trong AuthContext để profile hiển thị ngay
      void refreshUser();
>>>>>>> main
    } catch (e) {
      show(
        'Lỗi',
        e instanceof Error ? e.message : 'Không thể kiểm tra lịch tham gia',
        { variant: 'error' },
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={BACK_ACCENT} />
            <Text style={styles.backText}></Text>
          </Pressable>
          <View style={styles.heroTitleRow}>
            <View style={styles.heroTitleBlock}>
              <Text style={styles.heroTitle}>{match.title}</Text>
              <Text style={styles.heroSubtitle}>{match.sportLabelVi}</Text>
            </View>
            <View style={styles.heroActions}>
              {isHost ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/match/create-match',
                      params: { editId: match.id },
                    })
                  }
                  style={({ pressed }) => [styles.iconBox, pressed && styles.pressed]}>
                  <Ionicons name="create-outline" size={22} color={PRIMARY} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={toggleFavorite}
                style={({ pressed }) => [styles.iconBox, pressed && styles.pressed]}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFavorite ? PRIMARY : '#fff'}
                />
              </Pressable>
              <Pressable
                onPress={onShare}
                style={({ pressed }) => [styles.iconBox, pressed && styles.pressed]}>
                <Ionicons name="share-social-outline" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.bodyPad}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông Tin Trận Đấu</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoCol}>
                <View style={styles.infoCell}>
                  <View style={styles.infoLabelRow}>
                    <Ionicons name="time-outline" size={16} color={PRIMARY} />
                    <Text style={styles.infoLabel}>Thời gian</Text>
                  </View>
                  <Text style={styles.infoValue}>{match.timeRange}</Text>
                  <Text style={styles.infoSub}>{formatDateVi(match.date)}</Text>
                </View>
                <View style={styles.infoCell}>
                  <View style={styles.infoLabelRow}>
                    <Ionicons name="people-outline" size={16} color={PRIMARY} />
                    <Text style={styles.infoLabel}>Người chơi</Text>
                  </View>
                  <Text style={styles.infoValue}>
                    {match.currentPlayers}/{match.maxPlayers}
                  </Text>
                  <Text style={styles.spotsLeft}>
                    {spotsLeft > 0 ? `${spotsLeft} chỗ trống` : 'Đã đủ người'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoCol}>
                <View style={styles.infoCell}>
                  <View style={styles.infoLabelRow}>
                    <Ionicons name="location-outline" size={16} color={PRIMARY} />
                    <Text style={styles.infoLabel}>Địa điểm</Text>
                  </View>
                  <Text style={styles.infoValue}>{match.venueName}</Text>
                  <Text style={styles.infoSub}>{match.venueCity}</Text>
                </View>
                <View style={styles.infoCell}>
                  <View style={styles.infoLabelRow}>
                    <Ionicons name="trophy-outline" size={16} color={PRIMARY} />
                    <Text style={styles.infoLabel}>Trình độ</Text>
                  </View>
                  <Text style={styles.infoValue}>{match.skillLevelVi}</Text>
                  <Text style={styles.infoSub}>{match.priceLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.statusLabel}>Tình trạng</Text>
            {/* Badge trạng thái thời gian */}
            <StatusBadge
              status={computeDisplayStatus(match.status ?? 'active', match.date, match.timeRange)}
              size="md"
            />
            <View style={{ height: 14 }} />
            <Pressable
              onPress={toggleJoin}
              disabled={joinBusy || matchStatus !== 'active' || (!isJoined && spotsLeft <= 0)}
              style={({ pressed }) => [
                styles.joinCta,
                isJoined && styles.joinCtaOutline,
                (pressed || joinBusy) && styles.pressed,
                (joinBusy || matchStatus !== 'active') && styles.joinCtaDisabled,
              ]}>
              {joinBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.joinCtaText, isJoined && styles.joinCtaTextOutline]}>
                  {isJoined ? 'Hủy tham gia' : 'Tham Gia Ngay'}
                </Text>
              )}
            </Pressable>
          </View>

          {matchStatus === 'finished' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Người thắng</Text>
              <Text style={styles.bodyText}>
                {match.winners && match.winners.length > 0
                  ? match.winners
                      .map((wid) => match.participants.find((p) => p.id === wid)?.name || wid)
                      .join(', ')
                  : 'Chưa được chọn.'}
              </Text>
            </View>
          ) : null}

          {matchStatus === 'cancelled' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lý do hủy trận</Text>
              <Text style={styles.bodyText}>{match.cancelReason || '—'}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Người Tổ Chức</Text>
            <View style={styles.orgRow}>
              <View style={styles.orgAvatar}>
                {match.organizer.avatarUrl ? (
                  <Image
                    source={{ uri: match.organizer.avatarUrl }}
                    style={styles.orgAvatarImg}
                  />
                ) : (
                  <Ionicons name="person" size={28} color={TEXT_DIM} />
                )}
              </View>
              <View style={styles.orgMeta}>
                <Text style={styles.orgName}>{match.organizer.name}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color={SKILL_HIGH} />
                  <Text style={styles.ratingText}>
                    {match.organizer.rating.toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.orgDivider} />
            <Text style={styles.orgStats}>
              Đã tổ chức <Text style={styles.orgStatsBold}>{match.organizer.matchesPlayed}</Text>{' '}
              trận đấu
            </Text>
            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && styles.pressed]}>
              <Text style={styles.contactBtnText}>Liên Hệ</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mô Tả</Text>
            <Text style={styles.bodyText}>{match.description}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Yêu Cầu</Text>
            {match.requirements.length > 0 ? (
              match.requirements.map((r, ri) => (
                <View key={`req-${ri}-${r.slice(0, 20)}`} style={styles.listRow}>
                  <View style={styles.iconCircleCheck}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                  <Text style={styles.listText}>{r}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.mutedLine}>Không có yêu cầu bổ sung.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quy Tắc</Text>
            {match.rules.map((r, ri) => (
              <View key={`rule-${ri}-${r.slice(0, 20)}`} style={styles.listRow}>
                <View style={styles.iconCircleWarn}>
                  <Text style={styles.warnMark}>!</Text>
                </View>
                <Text style={styles.listText}>{r}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading}>
            Những Người Tham Gia ({match.participants.length})
          </Text>
          {participantPages.length > 0 ? (
            <>
              <ScrollView
                key={`participants-${match.id}`}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                style={[styles.participantPager, { width: pageWidth }]}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const page = Math.round(x / pageWidth);
                  const last = participantPages.length - 1;
                  setParticipantPageIndex(Math.min(Math.max(0, page), last));
                }}>
                {participantPages.map((page, pageIdx) => (
                  <View
                    key={pageIdx}
                    style={[styles.participantPage, { width: pageWidth }]}>
                    <View style={styles.participantGridPage}>
                      {page.map((p) => (
                        <View
                          key={p.id}
                          style={[styles.participantCard, { width: participantCardWidth }]}>
                          {p.avatarUrl ? (
                            <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Ionicons name="image-outline" size={28} color={TEXT_DIM} />
                            </View>
                          )}
                          <Text style={styles.participantName} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text
                            style={[styles.participantSkill, { color: skillColor(p.level) }]}>
                            {skillLabelVi(p.level)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
              {participantPages.length > 1 ? (
                <View style={styles.pageDots}>
                  {participantPages.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pageDot,
                        i === participantPageIndex && styles.pageDotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyParticipants}>Chưa có người tham gia.</Text>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bản đồ</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.mapContainer}>
                {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
                <iframe
                  src={match.mapUrl}
                  style={
                    {
                      width: '100%',
                      height: 260,
                      border: 'none',
                    } as CSSProperties
                  }
                  loading="lazy"
                />
              </View>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>
                  Bản đồ Google Maps chỉ hiển thị trên web trong bản demo này.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {AppAlertNode}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: HEADER_MAROON,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 2,
  },
  backText: {
    color: BACK_ACCENT,
    fontSize: 16,
    fontWeight: '500',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  heroSubtitle: {
    color: TEXT_DIM,
    fontSize: 15,
    marginTop: 6,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyPad: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  hostEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.35)',
  },
  hostEditText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  infoCol: {
    flex: 1,
    gap: 18,
  },
  infoCell: {
    gap: 4,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    color: TEXT_DIM,
    fontSize: 13,
  },
  infoValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  infoSub: {
    color: TEXT_DIM,
    fontSize: 13,
  },
  spotsLeft: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
  },
  bodyText: {
    color: '#eee',
    fontSize: 14,
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconCircleCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconCircleWarn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  warnMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  listText: {
    flex: 1,
    color: '#eee',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 10,
  },
  participantPager: {
    alignSelf: 'center',
  },
  participantPage: {
    paddingBottom: 4,
  },
  participantGridPage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
  },
  pageDotActive: {
    backgroundColor: PRIMARY,
    width: 18,
    borderRadius: 3,
  },
  emptyParticipants: {
    color: TEXT_DIM,
    fontSize: 14,
    marginBottom: 8,
  },
  participantCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2a2a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  participantName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  participantSkill: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusLabel: {
    color: TEXT_DIM,
    fontSize: 14,
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BADGE_RED,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  joinCta: {
    backgroundColor: '#ff4d4f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinCtaOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  joinCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  joinCtaTextOutline: {
    color: PRIMARY,
  },
  joinCtaDisabled: {
    opacity: 0.45,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2a2a2e',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orgAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  orgMeta: {
    flex: 1,
  },
  orgName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    color: TEXT_DIM,
    fontSize: 14,
  },
  orgDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 14,
  },
  orgStats: {
    color: TEXT_DIM,
    fontSize: 14,
    marginBottom: 14,
  },
  orgStatsBold: {
    color: '#fff',
    fontWeight: '700',
  },
  contactBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  mapPlaceholder: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
  },
  mapPlaceholderText: {
    color: TEXT_DIM,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: TEXT_DIM,
    marginTop: 12,
    fontSize: 15,
  },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  retryBtnText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 15,
  },
  mutedLine: {
    color: TEXT_DIM,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
});
