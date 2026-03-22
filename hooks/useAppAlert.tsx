import { useCallback, useState } from 'react';

import { AppAlert, type AppAlertVariant } from '@/components/AppAlert';

type AlertPayload = {
  title: string;
  message: string;
  variant: AppAlertVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

/**
 * Alert tùy chỉnh (theme tối + nút accent).
 *
 * @example
 * const { show, hide, Alert } = useAppAlert();
 * return (
 *   <>
 *     <YourScreen />
 *     {Alert}
 *   </>
 * );
 * show('Lỗi', 'Nội dung', { variant: 'error' });
 */
export function useAppAlert() {
  const [payload, setPayload] = useState<AlertPayload | null>(null);

  const hide = useCallback(() => setPayload(null), []);

  const show = useCallback(
    (
      title: string,
      message: string,
      options?: {
        variant?: AppAlertVariant;
        onConfirm?: () => void;
        confirmLabel?: string;
        cancelLabel?: string;
      },
    ) => {
      setPayload({
        title,
        message,
        variant: options?.variant ?? 'info',
        onConfirm: options?.onConfirm,
        confirmLabel: options?.confirmLabel,
        cancelLabel: options?.cancelLabel,
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    setPayload((current) => {
      if (current?.onConfirm) {
        current.onConfirm();
      }
      return null;
    });
  }, []);

  const Alert = (
    <AppAlert
      visible={payload !== null}
      title={payload?.title ?? ''}
      message={payload?.message ?? ''}
      variant={payload?.variant ?? 'info'}
      confirmLabel={payload?.confirmLabel ?? 'OK'}
      cancelLabel={payload?.cancelLabel}
      onConfirm={handleConfirm}
      onDismiss={hide}
    />
  );

  return { show, hide, Alert, visible: payload !== null };
}
