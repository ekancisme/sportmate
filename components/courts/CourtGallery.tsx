import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { resolveCourtImageUrl } from '@/lib/courtApi';

const PRIMARY = '#ff4d4f';

export default function CourtGallery({ images }: { images: string[] }) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = useWindowDimensions();
  const galleryWidth = Math.max(width - 32, 240);

  const resolvedImages = useMemo(
    () => images.map((item) => resolveCourtImageUrl(item)).filter(Boolean) as string[],
    [images],
  );

  useEffect(() => {
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [resolvedImages.join('|')]);

  if (!resolvedImages.length) {
    return (
      <View style={styles.fallback}>
        <Ionicons name="images-outline" size={42} color={PRIMARY} />
        <Text style={styles.fallbackText}>Chua co anh san</Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / galleryWidth);
          setActiveIndex(nextIndex);
        }}>
        {resolvedImages.map((uri) => (
          <Image key={uri} source={{ uri }} style={[styles.heroImage, { width: galleryWidth }]} />
        ))}
      </ScrollView>

      {resolvedImages.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {resolvedImages.map((uri, index) => {
            const active = index === activeIndex;
            return (
              <Pressable
                key={`${uri}-${index}`}
                style={[styles.thumbWrap, active && styles.thumbWrapActive]}
                onPress={() => {
                  setActiveIndex(index);
                  scrollRef.current?.scrollTo({ x: galleryWidth * index, animated: true });
                }}>
                <Image source={{ uri }} style={styles.thumbImage} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    height: 240,
    borderRadius: 24,
    backgroundColor: '#111',
    marginBottom: 12,
  },
  fallback: {
    height: 240,
    borderRadius: 24,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  fallbackText: {
    color: '#888',
    fontSize: 13,
  },
  thumbRow: {
    gap: 10,
    paddingBottom: 4,
  },
  thumbWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  thumbWrapActive: {
    borderColor: PRIMARY,
  },
  thumbImage: {
    width: 68,
    height: 68,
    backgroundColor: '#141414',
  },
});
