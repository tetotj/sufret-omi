import * as Location from "expo-location";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useApp } from "@/lib/app-context";
import { getLocalized, jordanMapPoints, regions, type Coordinate } from "@/lib/food-data";

type MapPreviewProps = {
  compact?: boolean;
  fullScreen?: boolean;
  onSelectRegion?: (regionId: (typeof regions)[number]["id"]) => void;
  onPressMap?: () => void;
  pickupCoordinates?: Coordinate;
  dropoffCoordinates?: Coordinate;
};

export function MapPreview({ compact = false, fullScreen = false, onSelectRegion, onPressMap, pickupCoordinates, dropoffCoordinates }: MapPreviewProps) {
  const { language, selectedRegion, showToast } = useApp();
  const [locating, setLocating] = useState(false);
  const selected = useMemo(() => regions.find((region) => region.id === selectedRegion) ?? regions[0], [selectedRegion]);

  const locateMe = async () => {
    setLocating(true);
    try {
      if (!globalThis.navigator?.geolocation) {
        showToast(language === "ar" ? "الموقع غير متاح على هذا المتصفح" : "Location is unavailable in this browser");
        return;
      }
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
    <View style={[styles.webMap, compact && styles.compactWrap, fullScreen && styles.fullScreenMap]}>
      <View style={styles.mapWash} />
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={styles.mapLabelTop}>
        <Text style={styles.mapMicro}>{language === "ar" ? "مطابخ بيتية حولك" : "Home kitchens around you"}</Text>
        <Text style={styles.mapTitle}>{getLocalized(selected.label, language)}</Text>
      </View>
      {jordanMapPoints.map((point, index) => (
        <Pressable key={point.id} onPress={() => onSelectRegion?.(point.id as (typeof regions)[number]["id"])} style={[styles.pin, { left: `${22 + (index % 5) * 17}%`, top: `${56 - (Math.floor(index / 5) % 3) * 17}%`, backgroundColor: point.color }]}>
          <MaterialIcons name="restaurant" size={14} color="#fff" />
        </Pressable>
      ))}
      {pickupCoordinates && <View style={[styles.driverPin, styles.driverPickupPin]}><MaterialIcons name="storefront" size={13} color="#FFFFFF" /></View>}
      {dropoffCoordinates && <View style={[styles.driverPin, styles.driverDropoffPin]}><MaterialIcons name="location-on" size={13} color="#FFFFFF" /></View>}
      <View style={styles.mapLegend}><View style={styles.legendDot} /><Text style={styles.legendText}>{language === "ar" ? "متاح الآن" : "Open now"}</Text></View>
      {pickupCoordinates && dropoffCoordinates && <View style={styles.coordinateBadge}><Text style={styles.coordinateBadgeTitle}>{language === "ar" ? "مسار التوصيل" : "Delivery route"}</Text><Text style={styles.coordinateBadgeText}>{dropoffCoordinates.latitude.toFixed(5)}, {dropoffCoordinates.longitude.toFixed(5)}</Text></View>}
      {!compact && !dropoffCoordinates && <View style={styles.regionBadge}><MaterialIcons name="location-on" size={16} color="#C2410C" /><View><Text style={styles.regionCaption}>{language === "ar" ? "توصيل إلى" : "Delivering to"}</Text><Text style={styles.regionName}>{getLocalized(selected.label, language)}</Text></View></View>}
      {onPressMap && <Pressable onPress={onPressMap} style={({ pressed }) => [styles.openMapButton, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={14} color="#FFFFFF" /><Text style={styles.openMapButtonText}>{language === "ar" ? "فتح الخريطة" : "Open map"}</Text></Pressable>}
      <Pressable onPress={locateMe} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}><MaterialIcons name={locating ? "hourglass-top" : "my-location"} size={16} color="#1C1917" /><Text style={styles.locateText}>{language === "ar" ? "موقعي" : "My location"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  webMap: { height: 220, borderRadius: 26, overflow: "hidden", backgroundColor: "#ECE8DF", position: "relative" },
  compactWrap: { height: 150, borderRadius: 22 },
  fullScreenMap: { flex: 1, height: undefined, borderRadius: 0 },
  mapWash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#E4E6D8", opacity: 0.95 },
  road: { position: "absolute", backgroundColor: "#F8F4ED", borderColor: "#D2D6BE", borderWidth: 1 },
  roadOne: { width: "130%", height: 34, top: 76, left: -34, transform: [{ rotate: "-12deg" }], borderRadius: 30 },
  roadTwo: { width: 30, height: "140%", top: -32, left: "54%", transform: [{ rotate: "25deg" }], borderRadius: 30 },
  roadThree: { width: "120%", height: 22, top: 24, left: -22, transform: [{ rotate: "18deg" }], borderRadius: 30 },
  mapLabelTop: { position: "absolute", top: 18, left: 18 },
  mapMicro: { fontSize: 11, color: "#57534E", fontWeight: "700" },
  mapTitle: { fontSize: 23, color: "#1C1917", fontWeight: "900", marginTop: 2 },
  pin: { position: "absolute", height: 28, width: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", shadowColor: "#1C1917", shadowOpacity: 0.2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  driverPin: { position: "absolute", height: 32, width: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF", shadowColor: "#1C1917", shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  driverPickupPin: { left: "28%", top: "45%", backgroundColor: "#4D7C0F" },
  driverDropoffPin: { left: "67%", top: "30%", backgroundColor: "#C2410C" },
  mapLegend: { position: "absolute", bottom: 14, left: 16, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "rgba(255,255,255,0.82)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4D7C0F" },
  legendText: { fontSize: 11, color: "#44403C", fontWeight: "700" },
  regionBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  regionCaption: { fontSize: 10, color: "#78716C" },
  regionName: { fontSize: 12, color: "#1C1917", fontWeight: "800" },
  coordinateBadge: { position: "absolute", top: 14, right: 14, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  coordinateBadgeTitle: { fontSize: 10, color: "#C2410C", fontWeight: "900" },
  coordinateBadgeText: { fontSize: 10, color: "#57534E", marginTop: 2, fontVariant: ["tabular-nums"] },
  openMapButton: { position: "absolute", bottom: 14, left: 16, backgroundColor: "#C2410C", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#1C1917", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  openMapButtonText: { fontSize: 11, color: "#FFFFFF", fontWeight: "800" },
  locateButton: { position: "absolute", bottom: 14, right: 16, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#1C1917", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  locateText: { fontSize: 11, color: "#1C1917", fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
