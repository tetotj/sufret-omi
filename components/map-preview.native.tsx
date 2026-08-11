import * as Location from "expo-location";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useApp } from "@/lib/app-context";
import { getLocalized, jordanMapPoints, regions } from "@/lib/food-data";

type MapPreviewProps = {
  compact?: boolean;
  onSelectRegion?: (regionId: (typeof regions)[number]["id"]) => void;
};

export function MapPreview({ compact = false, onSelectRegion }: MapPreviewProps) {
  const { language, selectedRegion, showToast } = useApp();
  const [locating, setLocating] = useState(false);
  const selected = useMemo(() => regions.find((region) => region.id === selectedRegion) ?? regions[0], [selectedRegion]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showToast(language === "ar" ? "نحتاج إذن الموقع لعرض المطابخ القريبة" : "Location permission is needed for nearby kitchens");
        return;
      }
      await Location.getCurrentPositionAsync({});
      onSelectRegion?.("amman");
      showToast(language === "ar" ? "حدّدنا المطابخ الأقرب لموقعك" : "We found kitchens closest to you");
    } catch {
      showToast(language === "ar" ? "تعذّر تحديد موقعك الآن" : "We could not find your location right now");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={[styles.nativeWrap, compact && styles.compactWrap]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.24, longitudeDelta: 0.2 }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {jordanMapPoints.map((point) => (
          <Marker key={point.id} coordinate={{ latitude: point.latitude, longitude: point.longitude }} title={getLocalized(point.label, language)} pinColor={point.color} onPress={() => onSelectRegion?.(point.id as (typeof regions)[number]["id"])} />
        ))}
      </MapView>
      {!compact && <View style={styles.regionBadge}><MaterialIcons name="location-on" size={16} color="#C2410C" /><View><Text style={styles.regionCaption}>{language === "ar" ? "توصيل إلى" : "Delivering to"}</Text><Text style={styles.regionName}>{getLocalized(selected.label, language)}</Text></View></View>}
      <Pressable onPress={locateMe} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}><MaterialIcons name={locating ? "hourglass-top" : "my-location"} size={16} color="#1C1917" /><Text style={styles.locateText}>{language === "ar" ? "موقعي" : "My location"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeWrap: { height: 220, borderRadius: 26, overflow: "hidden", backgroundColor: "#E7E5E4" },
  compactWrap: { height: 150, borderRadius: 22 },
  regionBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  regionCaption: { fontSize: 10, color: "#78716C" },
  regionName: { fontSize: 12, color: "#1C1917", fontWeight: "800" },
  locateButton: { position: "absolute", bottom: 14, right: 16, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#1C1917", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  locateText: { fontSize: 11, color: "#1C1917", fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
