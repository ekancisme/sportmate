import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COURT_SPORT_OPTIONS, type CourtSportKey } from '@/constants/courtSports';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
  createCourt,
  fetchCourtById,
  resolveCourtImageUrl,
  uploadCourtImages,
  updateCourt,
  type CourtImageAsset,
} from '@/lib/courtApi';

const PRIMARY = '#ff4d4f';
const MAX_IMAGES = 8;

type CourtForm = {
  name: string;
  sportKey: CourtSportKey | '';
  address: string;
  pricePerHour: string;
  contactPhone: string;
  amenitiesText: string;
  description: string;
  images: string[];
};

const INITIAL_FORM: CourtForm = {
  name: '',
  sportKey: '',
  address: '',
  pricePerHour: '',
  contactPhone: '',
  amenitiesText: '',
  description: '',
  images: [],
};

function normalizeParam(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
}

export default function CreateCourtScreen() {
  const params = useLocalSearchParams<{ editId?: string | string[] }>();
  const editId = normalizeParam(params.editId);
  const isEditMode = Boolean(editId);
  const { role, user } = useAuth();
  const { show, Alert: AppAlertNode } = useAppAlert();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<CourtForm>(INITIAL_FORM);
  const [selectedImages, setSelectedImages] = useState<CourtImageAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCourt, setLoadingCourt] = useState(isEditMode);

  useEffect(() => {
    if (user?.phone && !isEditMode) {
      setForm((prev) => ({ ...prev, contactPhone: prev.contactPhone || user.phone || '' }));
    }
  }, [isEditMode, user?.phone]);

  useEffect(() => {
    if (!isEditMode || !editId) return;

    let cancelled = false;

    (async () => {
      try {
        const court = await fetchCourtById(editId);
        if (cancelled) return;

        if (user?.id && court.ownerId && court.ownerId !== user.id) {
          show('Khong the sua', 'Ban khong phai owner cua san nay.', {
            variant: 'error',
            onConfirm: () => router.back(),
          });
          return;
        }

        setForm({
          name: court.name,
          sportKey: court.sportKey,
          address: court.address,
          pricePerHour: court.pricePerHour > 0 ? String(court.pricePerHour) : '',
          contactPhone: court.contactPhone || '',
          amenitiesText: court.amenities.join(', '),
          description: court.description || '',
          images: court.images || [],
        });
        setSelectedImages([]);
      } catch (error) {
        if (!cancelled) {
          show('Loi', error instanceof Error ? error.message : 'Khong tai duoc san', {
            variant: 'error',
            onConfirm: () => router.back(),
          });
        }
      } finally {
        if (!cancelled) setLoadingCourt(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId, isEditMode, show, user?.id]);

  const amenitiesPreview = useMemo(
    () =>
      form.amenitiesText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [form.amenitiesText],
  );

  const remainingImageSlots = MAX_IMAGES - form.images.length - selectedImages.length;

  const handleChange = <K extends keyof CourtForm>(key: K, value: CourtForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickCourtImages = async () => {
    if (remainingImageSlots <= 0) {
      show('Da du anh', `Ban chi co the tai toi da ${MAX_IMAGES} anh cho moi san.`, {
        variant: 'error',
      });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      show('Thieu quyen truy cap', 'Vui long cap quyen thu vien anh de tai anh san.', {
        variant: 'error',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remainingImageSlots,
    });

    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets.slice(0, remainingImageSlots).map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || `court-${Date.now()}.jpg`,
    }));

    setSelectedImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
  };

  const removeExistingImage = (image: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((item) => item !== image) }));
  };

  const removeSelectedImage = (uri: string) => {
    setSelectedImages((prev) => prev.filter((item) => item.uri !== uri));
  };

  const handleSubmit = async () => {
    if (role !== 'owner' || !user?.id) {
      show('Can tai khoan owner', 'Chi owner moi co the dang hoac quan ly san.', {
        variant: 'error',
      });
      return;
    }

    if (form.name.trim().length < 2) {
      show('Thieu thong tin', 'Ten san can it nhat 2 ky tu.', { variant: 'error' });
      return;
    }
    if (!form.sportKey) {
      show('Thieu thong tin', 'Vui long chon bo mon cua san.', { variant: 'error' });
      return;
    }
    if (!form.address.trim()) {
      show('Thieu thong tin', 'Vui long nhap dia chi san.', { variant: 'error' });
      return;
    }

    const priceNum = form.pricePerHour.trim() ? Number(form.pricePerHour.trim()) : 0;
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      show('Gia thue san', 'Gia thue san phai la so khong am.', { variant: 'error' });
      return;
    }

    const amenities = form.amenitiesText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        sportKey: form.sportKey,
        address: form.address.trim(),
        pricePerHour: Math.round(priceNum),
        contactPhone: form.contactPhone.trim(),
        amenities,
        description: form.description.trim(),
        images: form.images,
      };

      let savedCourt = isEditMode && editId
        ? await updateCourt(editId, user.id, payload)
        : await createCourt(user.id, payload);

      if (selectedImages.length > 0) {
        savedCourt = await uploadCourtImages(savedCourt.id, user.id, selectedImages);
      }

      setSelectedImages([]);
      setForm((prev) => ({ ...prev, images: savedCourt.images }));
      router.replace(`/courts/my-courts?notice=${isEditMode ? 'updated' : 'created'}` as never);
    } catch (error) {
      show('Loi', error instanceof Error ? error.message : 'Khong luu duoc san', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (role !== 'owner') {
    return (
      <>
        <View style={styles.deniedWrap}>
          <Text style={styles.deniedTitle}>Can tai khoan owner</Text>
          <Text style={styles.deniedText}>Chi tai khoan owner moi co the dang hoac sua san.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/courts' as never)}>
            <Text style={styles.secondaryBtnText}>Ve danh sach san</Text>
          </Pressable>
        </View>
        {AppAlertNode}
      </>
    );
  }

  if (loadingCourt) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
        <Text style={styles.loadingText}>Dang tai san...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={PRIMARY} />
            </Pressable>
            <Text style={styles.headerTitle}>{isEditMode ? 'Sua san' : 'Dang san moi'}</Text>
            <View style={styles.backPlaceholder} />
          </View>

          <Text style={styles.subtitle}>
            {isEditMode
              ? 'Cap nhat thong tin san, bo mon va bo anh hien thi.'
              : 'Tao san moi de nguoi dung xem lich trong va dat theo tung khung gio.'}
          </Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Thong tin co ban</Text>

            <Field
              label="Ten san"
              placeholder="VD: San Hoa Lu 1"
              value={form.name}
              onChangeText={(text) => handleChange('name', text)}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Bo mon</Text>
              <View style={styles.sportWrap}>
                {COURT_SPORT_OPTIONS.map((sport) => {
                  const active = form.sportKey === sport.key;
                  return (
                    <Pressable
                      key={sport.key}
                      style={[styles.sportChip, active && styles.sportChipActive]}
                      onPress={() => handleChange('sportKey', sport.key)}>
                      <Text style={[styles.sportChipText, active && styles.sportChipTextActive]}>
                        {sport.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Field
              label="Dia chi"
              placeholder="VD: 2 Dinh Tien Hoang, Quan 1"
              value={form.address}
              onChangeText={(text) => handleChange('address', text)}
            />
            <Field
              label="Gia thue theo gio"
              placeholder="VD: 300000"
              value={form.pricePerHour}
              onChangeText={(text) => handleChange('pricePerHour', text.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
            />
            <Field
              label="So dien thoai lien he"
              placeholder="VD: 0901234567"
              value={form.contactPhone}
              onChangeText={(text) => handleChange('contactPhone', text)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bo anh san</Text>
            <Text style={styles.helperText}>Anh dau tien se duoc dung lam anh dai dien o danh sach san.</Text>

            <View style={styles.imageGrid}>
              {form.images.map((image) => {
                const uri = resolveCourtImageUrl(image);
                return (
                  <View key={image} style={styles.imageWrap}>
                    {uri ? <Image source={{ uri }} style={styles.imageThumb} /> : null}
                    <Pressable style={styles.removeImageBtn} onPress={() => removeExistingImage(image)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                );
              })}

              {selectedImages.map((image) => (
                <View key={image.uri} style={styles.imageWrap}>
                  <Image source={{ uri: image.uri }} style={styles.imageThumb} />
                  <Pressable style={styles.removeImageBtn} onPress={() => removeSelectedImage(image.uri)}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable style={styles.imageButton} onPress={pickCourtImages}>
              <Text style={styles.imageButtonText}>Chon anh tu thu vien</Text>
            </Pressable>
            <Text style={styles.imageHint}>Toi da {MAX_IMAGES} anh. Anh moi se duoc tai len server sau khi luu san.</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Mo ta va tien ich</Text>
            <Field
              label="Tien ich"
              placeholder="VD: Den LED, Nha xe, Phong thay do"
              value={form.amenitiesText}
              onChangeText={(text) => handleChange('amenitiesText', text)}
            />

            {amenitiesPreview.length > 0 ? (
              <View style={styles.amenitiesWrap}>
                {amenitiesPreview.map((item) => (
                  <View key={item} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Field
              label="Mo ta"
              placeholder="Mo ta ngan ve mat san, anh sang, vi tri, huong dan di chuyen..."
              value={form.description}
              onChangeText={(text) => handleChange('description', text)}
              multiline
            />
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{isEditMode ? 'Luu thay doi' : 'Dang san'}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {AppAlertNode}
    </>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputArea]}
        placeholder={placeholder}
        placeholderTextColor="#777"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  centered: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 10,
    fontSize: 13,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  sectionCard: {
    backgroundColor: '#101010',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  helperText: {
    color: '#888',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: '#ddd',
    fontSize: 13,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#242424',
  },
  inputArea: {
    minHeight: 96,
  },
  sportWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#292929',
  },
  sportChipActive: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
    borderColor: PRIMARY,
  },
  sportChipText: {
    color: '#bbb',
    fontSize: 12,
    fontWeight: '600',
  },
  sportChipTextActive: {
    color: PRIMARY,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageWrap: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  imageButtonText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '600',
  },
  imageHint: {
    marginTop: 8,
    color: '#888',
    fontSize: 11,
    lineHeight: 17,
  },
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  amenityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  amenityText: {
    color: '#ddd',
    fontSize: 12,
  },
  submitBtn: {
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deniedWrap: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deniedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  deniedText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  secondaryBtnText: {
    color: PRIMARY,
    fontWeight: '600',
  },
});
