import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useApp } from "@/lib/app-context";
import { getLocalized, jordanMapPoints, regions, type Coordinate } from "@/lib/food-data";

type MapPreviewProps = {
  compact?: boolean;
  fullScreen?: boolean;
  onSelectRegion?: (regionId: (typeof regions)[number]["id"]) => void;
  onPressMap?: () => void;
  onSelectCoordinate?: (coordinate: Coordinate) => void;
  pickupCoordinates?: Coordinate;
  dropoffCoordinates?: Coordinate;
  driverCoordinates?: Coordinate;
};

export function MapPreview({ compact = false, fullScreen = false, onSelectRegion, onPressMap, onSelectCoordinate, pickupCoordinates, dropoffCoordinates, driverCoordinates }: MapPreviewProps) {
  const { language, selectedRegion, showToast } = useApp();
  const [locating, setLocating] = useState(false);
  const selected = useMemo(() => regions.find((region) => region.id === selectedRegion) ?? regions[0], [selectedRegion]);
  const mapFocus = dropoffCoordinates ?? pickupCoordinates ?? selected;
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!dropoffCoordinates) return;
    mapRef.current?.animateToRegion({ latitude: dropoffCoordinates.latitude, longitude: dropoffCoordinates.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 350);
  }, [dropoffCoordinates]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showToast(language === "ar" ? "نحتاج إذن الموقع لعرض المطابخ القريبة" : "Location permission is needed for nearby kitchens");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      onSelectCoordinate?.(coordinate);
      onSelectRegion?.("amman");
      showToast(language === "ar" ? "تم تحديد موقعك الحالي على الخريطة" : "Your current location is now selected on the map");
    } catch {
      showToast(language === "ar" ? "تعذّر تحديد موقعك الآن" : "We could not find your location right now");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={[styles.nativeWrap, compact && styles.compactWrap, fullScreen && styles.fullScreenMap]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: mapFocus.latitude, longitude: mapFocus.longitude, latitudeDelta: pickupCoordinates || dropoffCoordinates ? 0.04 : 0.24, longitudeDelta: pickupCoordinates || dropoffCoordinates ? 0.04 : 0.2 }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={(event) => {
          onSelectCoordinate?.(event.nativeEvent.coordinate);
          onPressMap?.();
        }}
      >
        {jordanMapPoints.map((point) => (
          <Marker key={point.id} coordinate={{ latitude: point.latitude, longitude: point.longitude }} title={getLocalized(point.label, language)} pinColor={point.color} onPress={() => onSelectRegion?.(point.id as (typeof regions)[number]["id"])} />
        ))}
        {pickupCoordinates && <Marker coordinate={pickupCoordinates} title={language === "ar" ? "نقطة الاستلام" : "Pickup point"} description={`${pickupCoordinates.latitude.toFixed(5)}, ${pickupCoordinates.longitude.toFixed(5)}`} pinColor="#236B45" />}
        {driverCoordinates && <Marker coordinate={driverCoordinates} title={language === "ar" ? "موقع السائق" : "Driver location"} description={`${driverCoordinates.latitude.toFixed(5)}, ${driverCoordinates.longitude.toFixed(5)}`} pinColor="#00AFC4" />}
        {dropoffCoordinates && <Marker draggable coordinate={dropoffCoordinates} title={language === "ar" ? "اسحب الدبوس لتحديد موقع التسليم" : "Drag the pin to set delivery location"} description={`${dropoffCoordinates.latitude.toFixed(5)}, ${dropoffCoordinates.longitude.toFixed(5)}`} pinColor="#4F8F3B" onDragEnd={(event) => onSelectCoordinate?.(event.nativeEvent.coordinate)} />}

      </MapView>
      {!compact && <View style={styles.regionBadge}><MaterialIcons name="location-on" size={16} color="#236B45" /><View><Text style={styles.regionCaption}>{language === "ar" ? "توصيل إلى" : "Delivering to"}</Text><Text style={styles.regionName}>{getLocalized(selected.label, language)}</Text></View></View>}
      <Pressable onPress={locateMe} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}><MaterialIcons name={locating ? "hourglass-top" : "my-location"} size={16} color="#132218" /><Text style={styles.locateText}>{language === "ar" ? "موقعي" : "My location"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeWrap: { height: 220, borderRadius: 26, overflow: "hidden", backgroundColor: "#E4EFE1" },
  compactWrap: { height: 150, borderRadius: 22 },
  fullScreenMap: { flex: 1, height: undefined, borderRadius: 0 },
  regionBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  regionCaption: { fontSize: 10, color: "#5E7665" },
  regionName: { fontSize: 12, color: "#132218", fontWeight: "800" },
  locateButton: { position: "absolute", bottom: 14, right: 16, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#132218", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  locateText: { fontSize: 11, color: "#132218", fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
