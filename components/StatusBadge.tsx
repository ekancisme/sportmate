import { View, Text, StyleSheet } from 'react-native';
import type { DisplayStatus } from '@/lib/matchStatus';

/**
 * StatusBadge – hiển thị badge trạng thái trận đấu.
 * Nhận DisplayStatus từ computeDisplayStatus() và render badge tương ứng.
 */
export function StatusBadge({ status, size = 'md' }: { status: DisplayStatus; size?: 'sm' | 'md' }) {
  const isLive = status.key === 'live';
  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        { backgroundColor: status.bg, borderColor: status.border },
      ]}
    >
      {/* Dot – pulse effect for live */}
      <View style={[styles.dot, { backgroundColor: status.dot }]}>
        {isLive && <View style={[styles.dotPulse, { borderColor: status.dot }]} />}
      </View>
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: status.color }]}>
        {status.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    position: 'relative',
  },
  dotPulse: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    top: -3,
    left: -3,
    opacity: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelSm: {
    fontSize: 10,
  },
});
