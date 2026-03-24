import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/apiBase';
import { fetchUserById, type ApiUser } from '@/lib/userApi';

// ── Design tokens ──────────────────────────────────────────────────────────
const PRIMARY  = '#ff4d4f';
const PRIMARY2 = '#ff6b6b';
const BG       = '#050505';
const HEADER   = '#100808';
const CARD     = '#0f0f0f';
const CARD2    = '#141414';
const BORDER   = '#1f1f1f';
const TEXT     = '#ffffff';
const MUTED    = '#777777';

// ── Types ──────────────────────────────────────────────────────────────────
type Message = {
  _id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
};

/** Sort a message array chronologically. Returns a new array. */
function sortByTime(msgs: Message[]): Message[] {
  return [...msgs].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (diff !== 0) return diff;
    // Tiebreaker: MongoDB ObjectId strings are lexicographically monotone
    return a._id.localeCompare(b._id);
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { user: currentUser } = useAuth();

  // ── FIX: Normalize id — useLocalSearchParams may return string | string[]
  const params = useLocalSearchParams<{ id: string }>();
  const otherId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<ApiUser | null>(null);
  const [loading,   setLoading]   = useState(true);

  const socketRef   = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ── FIX: Store current IDs in refs to avoid stale closures in socket callbacks
  const currentUserIdRef = useRef(currentUser?.id ?? '');
  const otherIdRef       = useRef(otherId ?? '');
  // A set of temp IDs waiting to be replaced by confirmed server messages
  const pendingIds       = useRef<Set<string>>(new Set());

  // Keep refs in sync with latest values
  useEffect(() => {
    currentUserIdRef.current = currentUser?.id ?? '';
  }, [currentUser?.id]);

  useEffect(() => {
    otherIdRef.current = otherId ?? '';
  }, [otherId]);

  // ── Scroll helper ──────────────────────────────────────────────────────
  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  // ── Initial load + socket setup ────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id || !otherId) return;

    // Fetch other user's name/avatar
    fetchUserById(otherId).then(setOtherUser).catch(console.error);

    // Fetch message history via REST (sorted from server)
    const base = getApiBaseUrl();
    fetch(`${base}/api/messages/${currentUser.id}/${otherId}`)
      .then((r) => r.json())
      .then((data: Message[]) => {
        // Sort again on client as a safety net (server already sorts, but network may reorder)
        setMessages(sortByTime(data || []));
        setLoading(false);
        scrollToBottom(false);
      })
      .catch((err) => {
        console.error('Failed to fetch messages:', err);
        setLoading(false);
      });

    // ── Socket connect ─────────────────────────────────────────────────
    const socket = io(base, {
      transports: ['websocket'], // avoid polling fallback delay
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Join the current user's personal room
      socket.emit('join_room', currentUser.id);
    });

    socket.on('reconnect', () => {
      // Re-join room after reconnect
      socket.emit('join_room', currentUserIdRef.current);
    });

    // ── FIX: Read IDs from refs (not closure) to avoid stale values ───
    socket.on('receive_message', (msg: Message) => {
      const myId    = currentUserIdRef.current;
      const theirId = otherIdRef.current;

      if (!myId || !theirId) return;

      const isMine   = msg.senderId === myId   && msg.receiverId === theirId;
      const isTheirs = msg.senderId === theirId && msg.receiverId === myId;

      if (!isMine && !isTheirs) return; // belongs to a different conversation

      if (isMine) {
        // Replace the optimistic temp message that was shown immediately on send
        setMessages((prev) => {
          const tempIdx = prev.findIndex(
            (m) => m._id.startsWith('temp_') && pendingIds.current.size > 0
          );
          if (tempIdx !== -1) {
            const tempId = prev[tempIdx]._id;
            pendingIds.current.delete(tempId);
            const updated = [...prev];
            updated[tempIdx] = msg;
            return sortByTime(updated); // re-sort after replace
          }
          // Shouldn't normally reach here, but handle gracefully
          return sortByTime([...prev, msg]);
        });
      } else {
        // Incoming message from the other person
        setMessages((prev) => {
          // Dedup: skip if we already have this _id
          if (prev.some((m) => m._id === msg._id)) return prev;
          return sortByTime([...prev, msg]);
        });
      }

      scrollToBottom();
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, otherId]);

  // ── Send message with optimistic update ───────────────────────────────
  const sendMessage = () => {
    if (!inputText.trim() || !currentUser?.id || !otherId) return;

    const socket = socketRef.current;
    if (!socket?.connected) return;

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMsg: Message = {
      _id: tempId,
      senderId: currentUser.id,
      receiverId: otherId,
      text: inputText.trim(),
      createdAt: new Date().toISOString(),
    };

    pendingIds.current.add(tempId);

    // Show immediately (optimistic UI)
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    socket.emit('send_message', {
      senderId: currentUser.id,
      receiverId: otherId,
      text: inputText.trim(),
    });
    setInputText('');
  };

  // ── Render single message bubble ───────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMe     = item.senderId === currentUser?.id;
    const isPending = item._id.startsWith('temp_');
    return (
      <View style={[styles.messageRow, isMe ? styles.messageMe : styles.messageOther]}>
        <View style={[
          styles.messageBubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
          isPending && { opacity: 0.7 },
        ]}>
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      </View>
    );
  }, [currentUser?.id]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={PRIMARY2} />
        </Pressable>
        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {otherUser?.name ?? 'Đang tải...'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Messages list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => scrollToBottom(false)}
          onLayout={() => scrollToBottom(false)}
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={MUTED}
          value={inputText}
          onChangeText={setInputText}
          multiline
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <Pressable
          style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}
          onPress={sendMessage}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: HEADER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  topBarTitleContainer: { flex: 1, alignItems: 'center' },
  topBarTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1a1010',
    borderWidth: 1,
    borderColor: '#2a1515',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // message list
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageMe:    { justifyContent: 'flex-end' },
  messageOther: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMe: {
    backgroundColor: PRIMARY,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: CARD2,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },

  // input bar
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: TEXT,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
