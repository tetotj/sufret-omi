import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Svg, { Polyline } from "react-native-svg";

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
  const [mapSize, setMapSize] = useState({ width: 360, height: 220 });
  const [locating, setLocating] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const selected = useMemo(() => regions.find((region) => region.id === selectedRegion) ?? regions[0], [selectedRegion]);
  const driverLatitude = driverCoordinates?.latitude;
  const driverLongitude = driverCoordinates?.longitude;
  const pickupLatitude = pickupCoordinates?.latitude;
  const pickupLongitude = pickupCoordinates?.longitude;
  const dropoffLatitude = dropoffCoordinates?.latitude;
  const dropoffLongitude = dropoffCoordinates?.longitude;
  const routeCoordinates = useMemo(() => {
    if ([driverLatitude, driverLongitude, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude].some((value) => typeof value !== "number")) return null;
    const quantizeDriver = (value: number) => Number(value.toFixed(3));
    return [
      { latitude: quantizeDriver(driverLatitude as number), longitude: quantizeDriver(driverLongitude as number) },
      { latitude: pickupLatitude as number, longitude: pickupLongitude as number },
      { latitude: dropoffLatitude as number, longitude: dropoffLongitude as number },
    ];
  }, [driverLatitude, driverLongitude, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude]);

  useEffect(() => {
    if (!routeCoordinates) {
      setRouteGeometry([]);
      setRouteStatus("idle");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const waypoints = routeCoordinates;
    const coordinateParam = waypoints.map((point) => `${point.longitude},${point.latitude}`).join(";");
    const routingBase = (process.env.EXPO_PUBLIC_ROUTING_API_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
    setRouteStatus("loading");
    void fetch(`${routingBase}/route/v1/driving/${coordinateParam}?overview=simplified&geometries=geojson&steps=false`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Routing request failed: ${response.status}`);
        return (await response.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
      })
      .then((payload) => {
        if (cancelled) return;
        const coordinates = payload.routes?.[0]?.geometry?.coordinates ?? [];
        if (coordinates.length > 1) {
          setRouteGeometry(coordinates);
          setRouteStatus("ready");
        } else {
          setRouteGeometry(waypoints.map((point) => [point.longitude, point.latitude]));
          setRouteStatus("fallback");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRouteGeometry(waypoints.map((point) => [point.longitude, point.latitude]));
        setRouteStatus("fallback");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeCoordinates]);

  const routeProjection = useMemo(() => {
    if (routeGeometry.length < 2) return null;
    const longitudes = routeGeometry.map(([longitude]) => longitude);
    const latitudes = routeGeometry.map(([, latitude]) => latitude);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.14, 0.001);
    const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.14, 0.001);
    const width = Math.max(maxLongitude - minLongitude + longitudePadding * 2, 0.002);
    const height = Math.max(maxLatitude - minLatitude + latitudePadding * 2, 0.002);
    const project = (coordinate: Coordinate) => ({
      left: ((coordinate.longitude - minLongitude + longitudePadding) / width) * 100,
      top: 100 - ((coordinate.latitude - minLatitude + latitudePadding) / height) * 100,
    });
    return {
      points: routeGeometry.map(([longitude, latitude]) => `${project({ latitude, longitude }).left},${project({ latitude, longitude }).top}`).join(" "),
      project,
    };
  }, [routeGeometry]);
  const projectedRoute = routeProjection?.points ?? "";
  const mapCenter = dropoffCoordinates ?? pickupCoordinates ?? selected;
  const mapLatitudeDelta = fullScreen ? 0.18 : 0.28;
  const mapLongitudeDelta = fullScreen ? 0.24 : 0.36;
  const projectInteractiveCoordinate = useCallback((coordinate: Coordinate) => ({
    left: Math.max(4, Math.min(96, 50 + ((coordinate.longitude - mapCenter.longitude) / mapLongitudeDelta) * 100)),
    top: Math.max(8, Math.min(92, 50 - ((coordinate.latitude - mapCenter.latitude) / mapLatitudeDelta) * 100)),
  }), [mapCenter.latitude, mapCenter.longitude, mapLatitudeDelta, mapLongitudeDelta]);
  const pinPosition = (coordinate: Coordinate, fallback: { left: DimensionValue; top: DimensionValue }) => {
    const projected = routeProjection?.project(coordinate) ?? projectInteractiveCoordinate(coordinate);
    return projected ? { left: `${projected.left}%` as DimensionValue, top: `${projected.top}%` as DimensionValue } : fallback;
  };
  const coordinateFromMapPoint = useCallback((locationX: number, locationY: number): Coordinate => ({
    latitude: Number((mapCenter.latitude - ((locationY / Math.max(mapSize.height, 1)) - 0.5) * mapLatitudeDelta).toFixed(6)),
    longitude: Number((mapCenter.longitude + ((locationX / Math.max(mapSize.width, 1)) - 0.5) * mapLongitudeDelta).toFixed(6)),
  }), [mapCenter.latitude, mapCenter.longitude, mapLatitudeDelta, mapLongitudeDelta, mapSize.height, mapSize.width]);
  const selectMapPoint = (locationX: number, locationY: number) => {
    onSelectCoordinate?.(coordinateFromMapPoint(locationX, locationY));
    onPressMap?.();
  };
  const dropoffPinProjection = dropoffCoordinates ? projectInteractiveCoordinate(dropoffCoordinates) : null;
  const pinPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(dropoffCoordinates && onSelectCoordinate),
    onMoveShouldSetPanResponder: () => Boolean(dropoffCoordinates && onSelectCoordinate),
    onPanResponderMove: (_event, gestureState) => {
      if (!dropoffCoordinates || !onSelectCoordinate) return;
      const base = projectInteractiveCoordinate(dropoffCoordinates);
      const nextLeft = Math.max(2, Math.min(98, base.left + (gestureState.dx / Math.max(mapSize.width, 1)) * 100));
      const nextTop = Math.max(2, Math.min(98, base.top + (gestureState.dy / Math.max(mapSize.height, 1)) * 100));
      onSelectCoordinate(coordinateFromMapPoint((nextLeft / 100) * mapSize.width, (nextTop / 100) * mapSize.height));
    },
  }), [coordinateFromMapPoint, dropoffCoordinates, mapSize.height, mapSize.width, onSelectCoordinate, projectInteractiveCoordinate]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showToast(language === "ar" ? "نحتاج إذن الموقع لتحديد مكانك بدقة" : "Location permission needed");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coord = { latitude: Number(loc.coords.latitude.toFixed(6)), longitude: Number(loc.coords.longitude.toFixed(6)) };
      onSelectCoordinate?.(coord);
      showToast(language === "ar" ? "📍 تم تحديد موقعك الحالي بدقة على الخريطة" : "📍 Current GPS location pinned");
    } catch {
      showToast(language === "ar" ? "تعذّر جلب موقعك الحالي" : "Could not fetch current location");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={[styles.webMap, compact && styles.compactWrap, fullScreen && styles.fullScreenMap]}>
      <View style={styles.mapWash} onLayout={(event) => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} />
      <Pressable accessibilityRole="button" accessibilityLabel={language === "ar" ? "اختيار نقطة على الخريطة" : "Choose a point on the map"} onPress={(event) => selectMapPoint(event.nativeEvent.locationX, event.nativeEvent.locationY)} style={StyleSheet.absoluteFill} />
      <View style={[styles.road, styles.roadOne]} pointerEvents="none" />
      <View style={[styles.road, styles.roadTwo]} pointerEvents="none" />
      <View style={[styles.road, styles.roadThree]} pointerEvents="none" />
      {projectedRoute && <Svg pointerEvents="none" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.routeLayer}><Polyline points={projectedRoute} fill="none" stroke="#D76545" strokeWidth="1.8" strokeOpacity="0.92" strokeLinecap="round" strokeLinejoin="round" /></Svg>}
      <View style={styles.mapLabelTop} pointerEvents="none">
        <Text style={styles.mapMicro}>{language === "ar" ? "مطابخ بيتية حولك" : "Home kitchens around you"}</Text>
        <Text style={styles.mapTitle}>{getLocalized(selected.label, language)}</Text>
      </View>
      {jordanMapPoints.map((point, index) => (
        <Pressable key={point.id} onPress={() => onSelectRegion?.(point.id as (typeof regions)[number]["id"])} style={[styles.pin, { left: `${22 + (index % 5) * 17}%`, top: `${56 - (Math.floor(index / 5) % 3) * 17}%`, backgroundColor: point.color }]}>
          <MaterialIcons name="restaurant" size={14} color="#fff" />
        </Pressable>
      ))}
      {pickupCoordinates && <View style={[styles.driverPin, styles.driverPickupPin, pinPosition(pickupCoordinates, { left: "28%", top: "45%" })]}><MaterialIcons name="storefront" size={13} color="#FFFFFF" /></View>}
      {driverCoordinates && <View style={[styles.driverPin, styles.driverCurrentPin, pinPosition(driverCoordinates, { left: "47%", top: "38%" })]}><MaterialIcons name="two-wheeler" size={13} color="#FFFFFF" /></View>}
      {dropoffCoordinates && <View {...pinPanResponder.panHandlers} accessibilityRole="adjustable" accessibilityLabel={language === "ar" ? "اسحب دبوس موقع التوصيل" : "Drag delivery pin"} style={[styles.driverPin, styles.driverDropoffPin, dropoffPinProjection ? { left: `${dropoffPinProjection.left}%` as DimensionValue, top: `${dropoffPinProjection.top}%` as DimensionValue } : pinPosition(dropoffCoordinates, { left: "67%", top: "30%" })]}><MaterialIcons name="location-on" size={15} color="#FFFFFF" /></View>}
      <View style={styles.mapLegend}><View style={styles.legendDot} /><Text style={styles.legendText}>{language === "ar" ? "متاح الآن" : "Open now"}</Text></View>
      {pickupCoordinates && dropoffCoordinates && <View style={styles.coordinateBadge}><Text style={styles.coordinateBadgeTitle}>{routeStatus === "loading" ? (language === "ar" ? "جارٍ حساب مسار القيادة" : "Calculating driving route") : routeStatus === "ready" ? (language === "ar" ? "مسار قيادة فعلي" : "Live driving route") : (language === "ar" ? "مسار التوصيل" : "Delivery route")}</Text><Text style={styles.coordinateBadgeText}>{dropoffCoordinates.latitude.toFixed(5)}, {dropoffCoordinates.longitude.toFixed(5)}</Text></View>}
      {!compact && !dropoffCoordinates && <View style={styles.regionBadge}><MaterialIcons name="location-on" size={16} color="#236B45" /><View><Text style={styles.regionCaption}>{language === "ar" ? "توصيل إلى" : "Delivering to"}</Text><Text style={styles.regionName}>{getLocalized(selected.label, language)}</Text></View></View>}
      {onPressMap && <Pressable onPress={onPressMap} style={({ pressed }) => [styles.openMapButton, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={14} color="#FFFFFF" /><Text style={styles.openMapButtonText}>{language === "ar" ? "فتح الخريطة" : "Open map"}</Text></Pressable>}
      <Pressable onPress={locateMe} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}><MaterialIcons name={locating ? "hourglass-top" : "my-location"} size={16} color="#132218" /><Text style={styles.locateText}>{language === "ar" ? "موقعي" : "My location"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  webMap: { height: 220, borderRadius: 26, overflow: "hidden", backgroundColor: "#E6F2E4", position: "relative" },
  compactWrap: { height: 150, borderRadius: 22 },
  fullScreenMap: { flex: 1, height: undefined, borderRadius: 0 },
  mapWash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#DDEAD8", opacity: 0.95 },
  road: { position: "absolute", backgroundColor: "#F1F9EE", borderColor: "#CFDFB2", borderWidth: 1 },
  roadOne: { width: "130%", height: 34, top: 76, left: -34, transform: [{ rotate: "-12deg" }], borderRadius: 30 },
  roadTwo: { width: 30, height: "140%", top: -32, left: "54%", transform: [{ rotate: "25deg" }], borderRadius: 30 },
  roadThree: { width: "120%", height: 22, top: 24, left: -22, transform: [{ rotate: "18deg" }], borderRadius: 30 },
  mapLabelTop: { position: "absolute", top: 18, left: 18 },
  mapMicro: { fontSize: 11, color: "#2B4933", fontWeight: "700" },
  mapTitle: { fontSize: 23, color: "#132218", fontWeight: "900", marginTop: 2 },
  pin: { position: "absolute", height: 28, width: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", shadowColor: "#132218", shadowOpacity: 0.2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  driverPin: { position: "absolute", height: 32, width: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF", shadowColor: "#132218", shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  driverPickupPin: { left: "28%", top: "45%", backgroundColor: "#4F8F3B" },
  driverCurrentPin: { left: "47%", top: "38%", backgroundColor: "#00AFC4" },
  driverDropoffPin: { left: "67%", top: "30%", backgroundColor: "#236B45" },
  routeLayer: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  mapLegend: { position: "absolute", bottom: 14, left: 16, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "rgba(255,255,255,0.82)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4F8F3B" },
  legendText: { fontSize: 11, color: "#304A38", fontWeight: "700" },
  regionBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  regionCaption: { fontSize: 10, color: "#5E7665" },
  regionName: { fontSize: 12, color: "#132218", fontWeight: "800" },
  coordinateBadge: { position: "absolute", top: 14, right: 14, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  coordinateBadgeTitle: { fontSize: 10, color: "#236B45", fontWeight: "900" },
  coordinateBadgeText: { fontSize: 10, color: "#2B4933", marginTop: 2, fontVariant: ["tabular-nums"] },
  openMapButton: { position: "absolute", bottom: 14, left: 16, backgroundColor: "#236B45", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#132218", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  openMapButtonText: { fontSize: 11, color: "#FFFFFF", fontWeight: "800" },
  locateButton: { position: "absolute", bottom: 14, right: 16, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#132218", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  locateText: { fontSize: 11, color: "#132218", fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
