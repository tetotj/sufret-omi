import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

/**
 * Returns a selected image URI on native and a browser-compatible URI on web.
 * Expo ImagePicker supports iOS, Android, and web; using one path keeps the
 * verification flow consistent across the customer-facing builds.
 */
export async function pickVerificationImage(): Promise<string | null> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
      throw new Error("PHOTO_PERMISSION_DENIED");
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
