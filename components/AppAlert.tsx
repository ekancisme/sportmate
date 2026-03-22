import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ModalProps,
} from 'react-native';

export type AppAlertVariant = 'success' | 'error' | 'info';

export type AppAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  variant?: AppAlertVariant;
  /** Mặc định: OK */
  confirmLabel?: string;
  /** Màu chủ đạo (nút + icon). Mặc định #ff4d4f */
  accentColor?: string;
  /**
   * Bấm nền có đóng không.
   * Mặc định: false với variant success, true với error/info.
   */
  backdropDismissable?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  animationType?: ModalProps['animationType'];
};

const DEFAULT_ACCENT = '#ff4d4f';

export function AppAlert({
  visible,
  title,
  message,
  variant = 'info',
  confirmLabel = 'OK',
  accentColor = DEFAULT_ACCENT,
  backdropDismissable,
  onConfirm,
  onDismiss,
  animationType = 'fade',
}: AppAlertProps) {
  const canDismissBackdrop = backdropDismissable ?? variant !== 'success';

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onDismiss}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (canDismissBackdrop) onDismiss();
        }}
      >
        <View style={styles.card}>
          {variant === 'success' ? (
            <Ionicons name="checkmark-circle" size={48} color={accentColor} style={styles.icon} />
          ) : variant === 'error' ? (
            <Ionicons name="alert-circle" size={48} color={accentColor} style={styles.icon} />
          ) : (
            <Ionicons name="information-circle-outline" size={48} color={accentColor} style={styles.icon} />
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={[styles.btn, { backgroundColor: accentColor }]} onPress={onConfirm}>
            <Text style={styles.btnText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 40,
    minWidth: 120,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
