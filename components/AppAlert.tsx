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
  /** Nút phụ (ví dụ Hủy) — gọi onDismiss */
  cancelLabel?: string;
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
  cancelLabel,
  accentColor = DEFAULT_ACCENT,
  backdropDismissable,
  onConfirm,
  onDismiss,
  animationType = 'fade',
}: AppAlertProps) {
  const canDismissBackdrop = backdropDismissable ?? variant !== 'success';
  const safeConfirmLabel = (() => {
    if (confirmLabel === null || confirmLabel === undefined) return 'OK';
    const s = String(confirmLabel).trim();
    return s ? s : 'OK';
  })();
  const safeConfirmLabelForSuccess = variant === 'success' ? 'OK' : safeConfirmLabel;

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onDismiss}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (canDismissBackdrop) onDismiss();
        }}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          {variant === 'success' ? (
            <Ionicons name="checkmark-circle" size={48} color={accentColor} style={styles.icon} />
          ) : variant === 'error' ? (
            <Ionicons name="alert-circle" size={48} color={accentColor} style={styles.icon} />
          ) : (
            <Ionicons name="information-circle-outline" size={48} color={accentColor} style={styles.icon} />
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {cancelLabel ? (
            <View style={styles.btnRow}>
              <Pressable style={styles.btnGhost} onPress={onDismiss}>
                <Text style={styles.btnGhostText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: accentColor }]} onPress={onConfirm}>
                <Text style={styles.btnText}>{safeConfirmLabelForSuccess}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[styles.btn, styles.btnSingle, { backgroundColor: accentColor }]} onPress={onConfirm}>
              <Text style={styles.btnText}>{safeConfirmLabelForSuccess}</Text>
            </Pressable>
          )}
        </Pressable>
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
    paddingVertical: 35,
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
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  btnGhost: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    color: '#ccc',
    fontWeight: '600',
    fontSize: 15,
  },
  btnSingle: {
    paddingHorizontal: 40,
    minWidth: 120,
  },
  btn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 100,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
