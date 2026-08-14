// Cross-platform icon wrapper: SF Symbols on iOS, Material Icons elsewhere.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
type IconMapping = Record<SymbolViewProps["name"], MaterialIconName>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * A compact, contemporary icon vocabulary used throughout Sufret Omi.
 * Add new names here before using them in a screen so iOS and Android/web
 * stay visually aligned.
 */
const MAPPING = {
  "house.fill": "home",
  "house.circle.fill": "home",
  "fork.knife": "restaurant",
  "map.fill": "map",
  "cart.fill": "shopping-cart",
  "person.crop.circle": "account-circle",
  magnifyingglass: "search",
  "line.3.horizontal.decrease.circle": "tune",
  globe: "language",
  "bell.fill": "notifications",
  "heart.fill": "favorite",
  "mappin.and.ellipse": "location-on",
  "location.fill": "my-location",
  "car.fill": "directions-car",
  "clock.fill": "schedule",
  "phone.fill": "phone",
  "camera.fill": "photo-camera",
  photo: "photo",
  "checkmark.circle.fill": "check-circle",
  xmark: "close",
  plus: "add",
  minus: "remove",
  "chevron.left": "chevron-left",
  "chevron.right": "chevron-right",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = "regular",
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
