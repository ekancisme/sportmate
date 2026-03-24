import { Redirect, useRootNavigationState } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function RootIndex() {
  const { isAuthenticated } = useAuth();
  const navState = useRootNavigationState();

  // Chờ cho root navigation mount xong rồi mới redirect để tránh lỗi "navigate before mounting"
  if (!navState?.key) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return <Redirect href="/(tabs)" />;
}

