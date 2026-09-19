import { useEffect } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

/**
 * Không dùng <Redirect> đồng bộ — dễ race với AsyncStorage.
 * Chờ nav + authReady rồi router.replace.
 */
export default function RootIndex() {
  const { isAuthenticated, authReady } = useAuth();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key || !authReady) return;
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)');
    }
  }, [navState?.key, authReady, isAuthenticated, router]);

  return null;
}