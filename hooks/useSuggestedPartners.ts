import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";

type Partner = {
  id: string;
  name: string;
  sport: string;
  level: string;
  distance: string;
  distanceKm: number | null;
  winRate: number;
  avatar?: string;
  location?: string | null;
};

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl) return envUrl;

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:3000`;
  }

  return "http://localhost:3000";
}

const API_BASE_URL = getApiBaseUrl();

export function useSuggestedPartners(currentUserId?: string | null, userLocation?: string | null) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `${API_BASE_URL}/api/users?limit=20`;
      if (currentUserId) {
        url += `&exclude=${currentUserId}`;
      }
      if (userLocation) {
        url += `&location=${encodeURIComponent(userLocation)}`;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Server trả về lỗi: ${res.status}`);
      }

      const data = await res.json();
      console.log("[useSuggestedPartners] Raw data:", JSON.stringify(data, null, 2));

      if (Array.isArray(data)) {
        setPartners(data);
      } else {
        setPartners([]);
      }
    } catch (err: any) {
      console.warn("Fetch partners error:", err.message);
      setError(err.message || "Không thể tải danh sách partner");
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, userLocation]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  return { partners, loading, error, refetch: fetchPartners };
}
