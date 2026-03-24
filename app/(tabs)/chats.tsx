import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/apiBase';
import { resolveAvatarUrl } from '@/lib/userApi';

// Design tokens
const PRIMARY = '#ff4d4f';
const BG = '#050505';
const HEADER = '#100808';
const CARD = '#0f0f0f';
const BORDER = '#1f1f1f';
const TEXT = '#ffffff';
const MUTED = '#777777';

type Conversation = {
  _id: string; // The ID of the other user in the group stage
  lastMessage: string;
  lastMessageAt: string;
  otherUser: {
    _id: string;
    name: string;
    avatar?: string;
  };
};

export default function ChatsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async () => {
    if (!currentUser?.id) return;
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/messages/conversations/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách trò chuyện:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    // Using interval to periodically refresh chat list as a fallback for missing sockets here
    // In a fully robust app, socket.io should manage this state instead.
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const TopBar = () => (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      <Text style={styles.topBarTitle}>Nhắn tin</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const avatarUrl = resolveAvatarUrl(item.otherUser.avatar);
    const initials = item.otherUser.name?.charAt(0)?.toUpperCase() || '?';
    
    // Simple format for the date
    const dateObj = new Date(item.lastMessageAt);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Pressable
        style={({ pressed }) => [styles.chatItem, pressed && { opacity: 0.7 }]}
        onPress={() => router.push(`/chat/${item.otherUser._id}` as any)}>
        <View style={styles.avatarFrame}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.otherUser.name}
            </Text>
            <Text style={styles.chatTime}>{timeString}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <TopBar />
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={48} color={MUTED} />
          <Text style={styles.hintText}>Vui lòng đăng nhập để xem tin nhắn</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar />
      
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={64} color={MUTED} style={{ opacity: 0.5, marginBottom: 16 }} />
          <Text style={styles.hintText}>Bạn chưa có cuộc trò chuyện nào</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // top bar
  topBar: {
    backgroundColor: HEADER,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  topBarTitle: { color: TEXT, fontSize: 24, fontWeight: '800' },

  // list
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  
  // avatar
  avatarFrame: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1e0a0a',
    marginRight: 14,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: PRIMARY, fontSize: 20, fontWeight: '800' },

  // info
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    color: MUTED,
    fontSize: 12,
  },
  lastMessage: {
    color: MUTED,
    fontSize: 14,
  },

  hintText: { color: MUTED, fontSize: 15, marginTop: 8 },
});
