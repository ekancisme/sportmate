import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';

import { formatDateChip, getUpcomingDateKeys } from '@/lib/courtCalendar';

const PRIMARY = '#ff4d4f';

export default function CourtDateStrip({
  selectedDate,
  onSelect,
  days = 7,
}: {
  selectedDate: string;
  onSelect: (dateKey: string) => void;
  days?: number;
}) {
  const dateKeys = getUpcomingDateKeys(days);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {dateKeys.map((dateKey) => {
        const active = dateKey === selectedDate;
        const label = formatDateChip(dateKey);

        return (
          <Pressable
            key={dateKey}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(dateKey)}>
            <Text style={[styles.weekday, active && styles.textActive]}>{label.weekday}</Text>
            <Text style={[styles.dayLabel, active && styles.textActive]}>{label.dayLabel}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingRight: 4,
  },
  chip: {
    minWidth: 78,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderColor: PRIMARY,
  },
  weekday: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  dayLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  textActive: {
    color: PRIMARY,
  },
});
