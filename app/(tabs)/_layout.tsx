import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#050505' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#050505',
          borderTopColor: '#333333',
        },
        tabBarActiveTintColor: '#ff4d4f',
        tabBarInactiveTintColor: '#888888',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-matches"
        options={{
          title: 'Trận của tôi',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Bảng xếp hạng',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null,
        }}
      /> 
    </Tabs>
  );
}


