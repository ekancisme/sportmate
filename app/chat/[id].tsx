import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
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

// Design tokens
const PRIMARY = '#ff4d4f';
const PRIMARY2 = '#ff6b6b';
const BG = '#050505';
const HEADER = '#100808';
const CARD = '#0f0f0f';
const CARD2 = '#141414';
const BORDER = '#1f1f1f';
const TEXT = '#ffffff';
const MUTED = '#777777';

type Message = {
  _id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); // other user's ID
  const { user: currentUser } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!currentUser?.id || !id) return;
    
    // Fetch other user profile
    fetchUserById(id).then(setOtherUser).catch(console.error);

    // Fetch initial message history
    const base = getApiBaseUrl();
    fetch(`${base}/api/messages/${currentUser.id}/${id}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch messages:", err);
        setLoading(false);
      });

    // Initialize socket connection
    const socket = io(base);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket, joining room:', currentUser.id);
      socket.emit('join_room', currentUser.id);
    });

    socket.on('receive_message', (msg: Message) => {
      // Allow only messages related to this conversation
      if (
        (msg.senderId === currentUser.id && msg.receiverId === id) ||
        (msg.senderId === id && msg.receiverId === currentUser.id)
      ) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser?.id, id]);

  const sendMessage = () => {
    if (!inputText.trim() || !currentUser?.id || !id) return;

    const socket = socketRef.current;
    if (socket) {
      const newMsgObj = {
        senderId: currentUser.id,
        receiverId: id,
        text: inputText.trim(),
      };
      // Optimistic update isn't strictly necessary since backend emits to sender too, 
      // but waiting for receive_message provides better consistency. Let's just emit.
      socket.emit('send_message', newMsgObj);
      setInputText('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.id;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageMe : styles.messageOther]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={PRIMARY2} />
        </Pressable>
        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {otherUser?.name || 'Đang tải...'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item._id || String(index)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={MUTED}
          value={inputText}
          onChangeText={setInputText}
          multiline
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

  // chat list
  listContent: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageMe: {
    justifyContent: 'flex-end',
  },
  messageOther: {
    justifyContent: 'flex-start',
  },
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

  // input
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
    transform: [{ translateX: -2 }, { translateY: -2 }],
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
