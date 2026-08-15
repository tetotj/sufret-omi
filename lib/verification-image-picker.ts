import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

function readBrowserImage(capture: boolean): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.setAttribute("capture", "environment");
    input.style.position = "fixed";
    input.style.left = "1px";
    input.style.top = "1px";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0.01";
    const cleanup = () => input.remove();
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }
      void readVerificationFile(file).then((uri) => {
        cleanup();
        resolve(uri);
      });
    };
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** Converts a browser-selected image into a URI that can be previewed and persisted locally. */
export function readVerificationFile(file: Blob | null | undefined): Promise<string | null> {
  if (!file || typeof FileReader === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Opens the device camera directly for a verification document. */
export async function takeVerificationPhoto(): Promise<string | null> {
  if (Platform.OS === "web") return readBrowserImage(true);

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
    throw new Error("CAMERA_PERMISSION_DENIED");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/** Opens the image library as an alternative to taking a new photo. */
export async function pickVerificationImage(): Promise<string | null> {
  if (Platform.OS === "web") return readBrowserImage(false);

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
    throw new Error("PHOTO_PERMISSION_DENIED");
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
