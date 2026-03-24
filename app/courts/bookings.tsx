import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CourtDateStrip from '@/components/courts/CourtDateStrip';
import CourtSlotGrid from '@/components/courts/CourtSlotGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
  cancelCourtBooking,
  fetchCourtBookings,
  formatCourtPrice,
  type ApiCourt,
  type ApiCourtBooking,
  type CourtAvailabilityResponse,
} from '@/lib/courtApi';
import { getUpcomingDateKeys } from '@/lib/courtCalendar';

const PRIMARY = '#ff4d4f';

function normalizeParam(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
}

export default function CourtBookingsScreen() {
  const params = useLocalSearchParams<{ courtId?: string | string[] }>();
  const courtId = normalizeParam(params.courtId);
  const { role, user } = useAuth();
  const { show, Alert: AppAlertNode } = useAppAlert();
  const [selectedDate, setSelectedDate] = useState(getUpcomingDateKeys(7)[0]);
  const [court, setCourt] = useState<ApiCourt | null>(null);
  const [availability, setAvailability] = useState<CourtAvailabilityResponse | null>(null);
  const [bookings, setBookings] = useState<ApiCourtBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    if (!courtId || !user?.id) {
      setError('Thiếu dữ liệu để xem lịch đặt');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchCourtBookings(courtId, user.id, selectedDate);
      setCourt(result.court);
      setAvailability(result.availability);
      setBookings(result.bookings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được lịch đặt sân');
      setCourt(null);
      setBookings([]);
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  }, [courtId, selectedDate, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleCancelBooking = (booking: ApiCourtBooking) => {
    if (!user?.id) return;

    show('Hủy lịch đặt', `Bạn có chắc muốn hủy lịch ${booking.startTime} - ${booking.endTime}?`, {
      variant: 'error',
      confirmLabel: 'Hủy lịch',
      cancelLabel: 'Đóng',
      onConfirm: () => {
        void (async () => {
          try {
            await cancelCourtBooking(booking.id, user.id);
            setNotice(`Đã hủy lịch đặt ${booking.startTime} - ${booking.endTime}.`);
            await loadData();
          } catch (e) {
            show('Không hủy được', e instanceof Error ? e.message : 'Có lỗi xảy ra', {
              variant: 'error',
            });
          }
        })();
      },
    });
  };

  if (role !== 'owner') {
    return (
      <>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Chỉ owner mới có thể xem lịch đặt của sân.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/courts' as never)}>
            <Text style={styles.secondaryBtnText}>Về danh sách sân</Text>
          </Pressable>
        </View>
        {AppAlertNode}
      </>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
        <Text style={styles.loadingText}>Đang tải lịch đặt...</Text>
      </View>
    );
  }

  if (error || !court || !availability) {
    return (
      <>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Không tải được lịch đặt của sân'}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Quay lại</Text>
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
            <Text style={styles.backText}>Quay lại</Text>
          </Pressable>
        </View>

        <View style={styles.headerCard}>
          <Text style={styles.title}>Lịch đặt của sân</Text>
          <Text style={styles.courtName}>{court.name}</Text>
          <Text style={styles.subtitle}>
            Theo dõi slot nào đã được đặt, xem thông tin người đặt và chủ động hủy lịch khi cần.
          </Text>
          <Text style={styles.summaryText}>{court.sportLabel} • {formatCourtPrice(court.pricePerHour)}</Text>
        </View>

        {notice ? (
          <View style={styles.noticeCard}>
            <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Chọn ngày xem lịch</Text>
          <CourtDateStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tổng quan slot trong ngày</Text>
          <Text style={styles.helperText}>
            Slot đỏ là đã được đặt, slot tối là chưa có ai đặt trong ngày bạn đang xem.
          </Text>
          <CourtSlotGrid slots={availability.slots} readOnly />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Danh sách người đã đặt</Text>
          {bookings.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có ai đặt sân trong ngày này.</Text>
          ) : (
            bookings.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingTopRow}>
                  <View>
                    <Text style={styles.bookingTime}>{booking.startTime} - {booking.endTime}</Text>
                    <Text style={styles.bookingName}>{booking.contactName || booking.user?.name || booking.user?.username || 'Nguoi dung SportMate'}</Text>
                  </View>
                  <Pressable style={styles.cancelBtn} onPress={() => handleCancelBooking(booking)}>
                    <Text style={styles.cancelBtnText}>Hủy lịch</Text>
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={15} color={PRIMARY} />
                  <Text style={styles.metaText}>{booking.contactPhone || booking.user?.phone || 'Đang cập nhật'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="cash-outline" size={15} color={PRIMARY} />
                  <Text style={styles.metaText}>{formatCourtPrice(booking.priceSnapshot)}</Text>
                </View>
                {booking.note ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="document-text-outline" size={15} color={PRIMARY} />
                    <Text style={styles.metaText}>{booking.note}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
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
    marginBottom: 4,
  },
  courtName: {
    color: '#ffb3b3',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
  },
  summaryText: {
    color: '#ddd',
    fontSize: 12,
    marginTop: 10,
  },
  sectionCard: {
    backgroundColor: '#101010',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  helperText: {
    color: '#888',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
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
  bookingCard: {
    backgroundColor: '#141414',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242424',
  },
  bookingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  bookingTime: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bookingName: {
    color: '#ffb3b3',
    fontSize: 13,
    marginTop: 4,
  },
  cancelBtn: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#884444',
  },
  cancelBtnText: {
    color: '#f08080',
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  metaText: {
    flex: 1,
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
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
