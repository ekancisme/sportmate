import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';

import { useAuth, AuthUser } from '@/contexts/AuthContext';

type EditableSport = {
  name: string;
  level: string;
};

type EditableScheduleItem = {
  day: string;
  time?: string;
  activity: string;
};

type EditableProfile = {
  name: string;
  location: string;
  email: string;
  phone: string;
  bio: string;
  avatar: string;
  sports: EditableSport[];
  schedule: EditableScheduleItem[];
};

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    // @ts-expect-error support older expo manifest
    Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  return 'http://localhost:3000';
}

export default function EditProfileScreen() {
  const { user: authUser, setUserFromServer } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<EditableProfile>({
    name: '',
    location: '',
    email: '',
    phone: '',
    bio: '',
    avatar: '',
    sports: [],
    schedule: [],
  });
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    if (!authUser) return;
    setProfile({
      name: authUser.name || '',
      location: authUser.location || '',
      email: authUser.email || '',
      phone: authUser.phone || '',
      bio: authUser.bio || '',
      avatar: authUser.avatar || '',
      sports: authUser.sports ?? [],
      schedule: authUser.schedule ?? [],
    });
  }, [authUser]);

  if (!authUser) {
    return null;
  }

  const handleChange = (key: keyof EditableProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${apiBase}/api/users/${authUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('Failed to save profile', await res.text());
        return;
      }
      const updated = (await res.json()) as AuthUser;
      setUserFromServer(updated);
      router.back();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error saving profile', e);
    }
  };

  const pickAndUploadAvatar = async () => {
    if (!authUser) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      // eslint-disable-next-line no-console
      console.warn('Permission to access media library was denied');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets || !result.assets.length) return;

    const asset = result.assets[0];
    const uri = asset.uri;

    try {
      const form = new FormData();
      // Web: phải append Blob/File — và KHÔNG set Content-Type thủ công (cần boundary).
      // Native: append object { uri, name, type }.
      if (Platform.OS === 'web') {
        const imgRes = await fetch(uri);
        const blob = await imgRes.blob();
        const ext = asset.mimeType?.split('/')[1] || 'jpeg';
        form.append('avatar', blob, `avatar.${ext}`);
      } else {
        form.append('avatar', {
          uri,
          name: 'avatar.jpg',
          type: asset.mimeType || 'image/jpeg',
        } as any);
      }

      const res = await fetch(`${apiBase}/api/users/${authUser.id}/avatar`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('Failed to upload avatar', await res.text());
        return;
      }

      const updated = (await res.json()) as AuthUser;
      setUserFromServer(updated);
      setProfile((prev) => ({ ...prev, avatar: updated.avatar || '' }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error uploading avatar', e);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <Text style={styles.headerBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Chỉnh sửa hồ sơ</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>

        <Pressable style={styles.avatarEditWrapper} onPress={pickAndUploadAvatar}>
          <View style={styles.avatarEditCircle}>
            {profile.avatar ? (
              <Image
                source={{ uri: profile.avatar.startsWith('http') ? profile.avatar : apiBase + profile.avatar }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarEditInitial}>{profile.name.charAt(0) || 'S'}</Text>
            )}
          </View>
          <Text style={styles.avatarEditText}>Change avatar</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin chính</Text>
          <EditField
            label="Tên"
            value={profile.name}
            onChangeText={(text) => handleChange('name', text)}
          />
          <EditField
            label="Khu vực"
            value={profile.location}
            onChangeText={(text) => handleChange('location', text)}
          />
          <EditField
            label="Email"
            value={profile.email}
            keyboardType="email-address"
            onChangeText={(text) => handleChange('email', text)}
          />
          <EditField
            label="Số điện thoại"
            value={profile.phone}
            keyboardType="phone-pad"
            onChangeText={(text) => handleChange('phone', text)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giới thiệu</Text>
          <EditField
            label="Giới thiệu"
            value={profile.bio}
            multiline
            onChangeText={(text) => handleChange('bio', text)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Môn thể thao</Text>

          {profile.sports.length === 0 ? (
            <Text style={styles.muted}>Chưa có môn nào. Thêm môn để hiển thị trên profile.</Text>
          ) : null}

          {profile.sports.map((s, idx) => (
            <View key={`${idx}`} style={styles.dynamicRow}>
              <TextInput
                style={[styles.dynamicInput, styles.dynamicInputName]}
                value={s.name}
                onChangeText={(text) => {
                  setProfile((prev) => {
                    const next = [...prev.sports];
                    next[idx] = { ...next[idx], name: text };
                    return { ...prev, sports: next };
                  });
                }}
                placeholder="Tên môn"
                placeholderTextColor="#777"
              />
              <TextInput
                style={[styles.dynamicInput, styles.dynamicInputLevel]}
                value={s.level}
                onChangeText={(text) => {
                  setProfile((prev) => {
                    const next = [...prev.sports];
                    next[idx] = { ...next[idx], level: text };
                    return { ...prev, sports: next };
                  });
                }}
                placeholder="Trình độ"
                placeholderTextColor="#777"
              />
              <Pressable
                onPress={() => {
                  setProfile((prev) => {
                    const next = prev.sports.filter((_, i) => i !== idx);
                    return { ...prev, sports: next };
                  });
                }}
                style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>X</Text>
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => {
              setProfile((prev) => ({
                ...prev,
                sports: [...prev.sports, { name: '', level: '' }],
              }));
            }}
            style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Thêm môn</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch tập luyện</Text>

          {profile.schedule.length === 0 ? (
            <Text style={styles.muted}>Chưa có lịch. Thêm để hiển thị trên profile.</Text>
          ) : null}

          {profile.schedule.map((it, idx) => (
            <View key={`${idx}`} style={styles.dynamicRowSchedule}>
              <TextInput
                style={[styles.dynamicInput, styles.dynamicInputDay]}
                value={it.day}
                onChangeText={(text) => {
                  setProfile((prev) => {
                    const next = [...prev.schedule];
                    next[idx] = { ...next[idx], day: text };
                    return { ...prev, schedule: next };
                  });
                }}
                placeholder="Thứ"
                placeholderTextColor="#777"
              />
              <TextInput
                style={[styles.dynamicInput, styles.dynamicInputTime]}
                value={it.time ?? ''}
                onChangeText={(text) => {
                  setProfile((prev) => {
                    const next = [...prev.schedule];
                    next[idx] = { ...next[idx], time: text };
                    return { ...prev, schedule: next };
                  });
                }}
                placeholder="Giờ"
                placeholderTextColor="#777"
              />
              <TextInput
                style={[styles.dynamicInput, styles.dynamicInputActivity]}
                value={it.activity}
                onChangeText={(text) => {
                  setProfile((prev) => {
                    const next = [...prev.schedule];
                    next[idx] = { ...next[idx], activity: text };
                    return { ...prev, schedule: next };
                  });
                }}
                placeholder="Hoạt động"
                placeholderTextColor="#777"
              />
              <Pressable
                onPress={() => {
                  setProfile((prev) => {
                    const next = prev.schedule.filter((_, i) => i !== idx);
                    return { ...prev, schedule: next };
                  });
                }}
                style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>X</Text>
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => {
              setProfile((prev) => ({
                ...prev,
                schedule: [
                  ...prev.schedule,
                  { day: '', time: '', activity: '' },
                ],
              }));
            }}
            style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Thêm lịch</Text>
          </Pressable>
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Lưu thay đổi</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ảnh đại diện</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nhập URL ảnh mới"
              placeholderTextColor="#777"
              value={profile.avatar}
              onChangeText={(text) => handleChange('avatar', text)}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setAvatarModalVisible(false)}>
                <Text style={styles.modalBtnSecondaryText}>Đóng</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => setAvatarModalVisible(false)}>
                <Text style={styles.modalBtnPrimaryText}>Lưu URL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'number-pad'
    | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor="#777"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  headerBtnText: {
    color: '#aaa',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  avatarEditWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarEditCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    borderWidth: 3,
    borderColor: '#ff4d4f55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarEditInitial: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  avatarEditText: {
    color: '#ff4d4f',
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  muted: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dynamicRowSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dynamicInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  dynamicInputName: {
    flex: 1,
    minWidth: 110,
  },
  dynamicInputLevel: {
    flex: 0.8,
    minWidth: 90,
  },
  dynamicInputDay: {
    flex: 0.75,
    minWidth: 70,
  },
  dynamicInputTime: {
    flex: 0.75,
    minWidth: 70,
  },
  dynamicInputActivity: {
    flex: 1.2,
    minWidth: 140,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#ff8888',
    fontWeight: '700',
    fontSize: 12,
  },
  addBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#444',
  },
  addBtnText: {
    color: '#ff4d4f',
    fontSize: 13,
    fontWeight: '700',
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 2,
  },
  fieldInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#ff4d4f',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    maxWidth: 420,
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modalBtnSecondary: {
    borderWidth: 1,
    borderColor: '#444',
  },
  modalBtnSecondaryText: {
    color: '#ccc',
    fontSize: 12,
  },
  modalBtnPrimary: {
    backgroundColor: '#ff4d4f',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
});

