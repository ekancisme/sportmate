import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CourtAvailabilitySlot } from '@/lib/courtApi';

const PRIMARY = '#ff4d4f';

export default function CourtSlotGrid({
  slots,
  selectedStartTime,
  onSelect,
  readOnly = false,
  emptyText = 'Chưa có khung giờ',
}: {
  slots: CourtAvailabilitySlot[];
  selectedStartTime?: string | null;
  onSelect?: (slot: CourtAvailabilitySlot) => void;
  readOnly?: boolean;
  emptyText?: string;
}) {
  if (!slots.length) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const selected = selectedStartTime === slot.startTime;
        const booked = !slot.available;

        return (
          <Pressable
            key={`${slot.startTime}-${slot.endTime}`}
            style={[
              styles.card,
              booked && styles.cardBooked,
              selected && styles.cardSelected,
            ]}
            onPress={() => {
              if (!readOnly && slot.available && onSelect) {
                onSelect(slot);
              }
            }}
            disabled={readOnly || booked}>
            <Text style={[styles.timeText, selected && styles.timeTextSelected]}>{slot.startTime}</Text>
            <Text style={[styles.subText, selected && styles.timeTextSelected]}>{slot.endTime}</Text>
            <Text
              style={[
                styles.stateText,
                booked ? styles.stateBooked : styles.stateAvailable,
                selected && styles.stateSelected,
              ]}>
              {booked ? 'Đã đặt' : selected ? 'Đang chọn' : 'Còn trống'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: '3%',
    rowGap: 12,
  },
  card: {
    width: '31.33%',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  cardBooked: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderColor: '#6f3131',
  },
  cardSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  timeTextSelected: {
    color: '#fff',
  },
  subText: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  stateText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stateAvailable: {
    color: '#8dd3a8',
  },
  stateBooked: {
    color: '#ffb0b0',
  },
  stateSelected: {
    color: '#fff',
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
  },
});
