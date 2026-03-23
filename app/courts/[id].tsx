import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CourtDateStrip from '@/components/courts/CourtDateStrip';
import CourtGallery from '@/components/courts/CourtGallery';
import CourtSlotGrid from '@/components/courts/CourtSlotGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import { getUpcomingDateKeys } from '@/lib/courtCalendar';
import {
  createCourtBooking,
  fetchCourtAvailability,
  fetchCourtById,
  formatCourtPrice,
  type ApiCourt,
  type CourtAvailabilitySlot,
} from '@/lib/courtApi';

const PRIMARY = '#ff4d4f';
const DEFAULT_DATE = getUpcomingDateKeys(7)[0];

function normalizeParam(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
}

export default function CourtDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = normalizeParam(params.id);
  const { user } = useAuth();
  const { show, Alert: AppAlertNode } = useAppAlert();
  const [court, setCourt] = useState<ApiCourt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(DEFAULT_DATE);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slots, setSlots] = useState<CourtAvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<CourtAvailabilitySlot | null>(null);
  const [bookingNotice, setBookingNotice] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);

  const isOwnerOfCourt = Boolean(user?.id && court?.ownerId === user.id);

  const loadCourt = useCallback(async () => {
    if (!id) {
      setError('Thieu ID san');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const row = await fetchCourtById(id);
      setCourt(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong tai duoc thong tin san');
      setCourt(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAvailability = useCallback(async () => {
    if (!id) return;
    setAvailabilityLoading(true);
    try {
      const result = await fetchCourtAvailability(id, selectedDate);
      setSlots(result.slots);
      setSelectedSlot((current) => {
        if (!current) return null;
        const refreshed = result.slots.find((slot) => slot.startTime === current.startTime && slot.available);
        return refreshed || null;
      });
    } catch (e) {
      setSlots([]);
      show('Loi', e instanceof Error ? e.message : 'Khong tai duoc lich trong', { variant: 'error' });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [id, selectedDate, show]);

  useFocusEffect(
    useCallback(() => {
      loadCourt();
    }, [loadCourt]),
  );

  useEffect(() => {
    if (!court) return;
    void loadAvailability();
  }, [court, loadAvailability]);

  const handleBook = async () => {
    if (!court || !selectedSlot || !user?.id) return;

    setBookingBusy(true);
    try {
      await createCourtBooking(court.id, {
        userId: user.id,
        bookingDate: selectedDate,
        startTime: selectedSlot.startTime,
        contactName: user.name,
        contactPhone: user.phone,
      });
      setBookingNotice(
        `Da dat san thanh cong cho khung gio ${selectedSlot.startTime} - ${selectedSlot.endTime} ngay ${selectedDate}.`,
      );
      setSelectedSlot(null);
      await loadAvailability();
    } catch (e) {
      show('Khong dat duoc san', e instanceof Error ? e.message : 'Co loi xay ra', {
        variant: 'error',
      });
    } finally {
      setBookingBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
        <Text style={styles.loadingText}>Dang tai thong tin san...</Text>
      </View>
    );
  }

  if (error || !court) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Khong tim thay san'}</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Quay lai</Text>
        </Pressable>
      </View>
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

        <CourtGallery images={court.images} />

        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View style={styles.titleMain}>
              <Text style={styles.title}>{court.name}</Text>
              <Text style={styles.sport}>{court.sportLabel}</Text>
            </View>
          </View>

          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={PRIMARY} />
              <Text style={styles.metaText}>{court.address}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={16} color={PRIMARY} />
              <Text style={styles.metaText}>{formatCourtPrice(court.pricePerHour)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={PRIMARY} />
              <Text style={styles.metaText}>
                Mo cua {court.openTime} - {court.closeTime} • Moi slot {court.slotMinutes} phut
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={16} color={PRIMARY} />
              <Text style={styles.metaText}>{court.contactPhone || court.owner?.phone || 'Dang cap nhat'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={16} color={PRIMARY} />
              <Text style={styles.metaText}>{court.owner?.name || court.owner?.username || 'Chu san SportMate'}</Text>
            </View>
          </View>

          {isOwnerOfCourt ? (
            <View style={styles.ownerActions}>
              <Pressable
                style={styles.secondaryBtnWide}
                onPress={() =>
                  router.push({ pathname: '/courts/create' as never, params: { editId: court.id } })
                }>
                <Text style={styles.secondaryBtnText}>Chinh sua san</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => router.push(`/courts/bookings?courtId=${court.id}` as never)}>
                <Text style={styles.primaryBtnText}>Xem lich dat</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mo ta san</Text>
          <Text style={styles.sectionText}>{court.description?.trim() || 'Chu san chua cap nhat mo ta chi tiet.'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tien ich</Text>
          {court.amenities.length > 0 ? (
            <View style={styles.amenitiesWrap}>
              {court.amenities.map((item) => (
                <View key={item} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionText}>Chua co thong tin tien ich.</Text>
          )}
        </View>

        {!isOwnerOfCourt ? (
          <View style={styles.bookingCard}>
            <Text style={styles.sectionTitle}>Chon ngay va khung gio</Text>
            <Text style={styles.bookingHint}>Xem slot trong theo ngay, chon khung gio phu hop roi bam thue san.</Text>

            {bookingNotice ? (
              <View style={styles.noticeCard}>
                <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
                <Text style={styles.noticeText}>{bookingNotice}</Text>
              </View>
            ) : null}

            <CourtDateStrip selectedDate={selectedDate} onSelect={setSelectedDate} />

            <View style={styles.slotSection}>
              {availabilityLoading ? (
                <View style={styles.slotLoadingWrap}>
                  <ActivityIndicator color={PRIMARY} />
                </View>
              ) : (
                <CourtSlotGrid
                  slots={slots}
                  selectedStartTime={selectedSlot?.startTime || null}
                  onSelect={(slot) => setSelectedSlot(slot)}
                  emptyText="Chua co khung gio kha dung cho ngay nay"
                />
              )}
            </View>

            <Pressable
              style={[
                styles.primaryBtn,
                (!selectedSlot || bookingBusy) && styles.primaryBtnDisabled,
              ]}
              onPress={handleBook}
              disabled={!selectedSlot || bookingBusy}>
              {bookingBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {selectedSlot
                    ? `Thue san ${selectedSlot.startTime} - ${selectedSlot.endTime}`
                    : 'Chon khung gio de thue san'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
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
  centered: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#888',
    marginTop: 10,
    fontSize: 13,
  },
  errorText: {
    color: '#ff8888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
  },
  topRow: {
    marginBottom: 12,
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
  infoCard: {
    backgroundColor: '#101010',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  titleMain: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  sport: {
    color: '#ffb3b3',
    fontSize: 14,
    fontWeight: '600',
  },
  metaBlock: {
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  metaText: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  secondaryBtnWide: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: PRIMARY,
    fontWeight: '600',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionText: {
    color: '#bbb',
    fontSize: 13,
    lineHeight: 20,
  },
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  amenityText: {
    color: '#ddd',
    fontSize: 12,
  },
  bookingCard: {
    backgroundColor: '#101010',
    borderRadius: 24,
    padding: 18,
  },
  bookingHint: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  slotSection: {
    marginTop: 14,
  },
  slotLoadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
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
});
