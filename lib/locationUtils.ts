import * as Location from 'expo-location';

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  address?: string;
};

/**
 * Yêu cầu quyền truy cập vị trí và lấy vị trí hiện tại
 */
export async function requestCurrentLocation(): Promise<CurrentLocation | null> {
  try {
    // Yêu cầu quyền truy cập vị trí
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Quyền truy cập vị trí bị từ chối');
      return null;
    }

    // Lấy vị trí hiện tại
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // Reverse geocoding để lấy địa chỉ
    let address: string | undefined;
    try {
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocode) {
        // Tạo địa chỉ ngắn gọn
        const parts: string[] = [];
        if (geocode.district) parts.push(geocode.district);
        if (geocode.city) parts.push(geocode.city);
        if (geocode.region) parts.push(geocode.region);
        address = parts.join(', ') || undefined;
      }
    } catch (geocodeError) {
      console.log('Reverse geocoding failed:', geocodeError);
    }

    return {
      latitude,
      longitude,
      address,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}

/**
 * Kiểm tra xem có quyền truy cập vị trí không
 */
export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}
