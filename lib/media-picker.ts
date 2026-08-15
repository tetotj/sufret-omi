import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export type ImageSource = "camera" | "library";

export class MediaPermissionError extends Error {
  constructor(source: ImageSource) {
    super(source === "camera" ? "CAMERA_PERMISSION_DENIED" : "PHOTO_PERMISSION_DENIED");
    this.name = "MediaPermissionError";
  }
}

function readBrowserFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function openBrowserPicker(source: ImageSource, multiple: boolean): Promise<string[]> {
  if (typeof document === "undefined" || !document.body) return [];

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = source === "library" && multiple;
    if (source === "camera") input.setAttribute("capture", "environment");
    input.style.position = "fixed";
    input.style.left = "1px";
    input.style.top = "1px";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0.01";

    let settled = false;
    const cleanup = () => input.remove();
    const finish = (uris: string[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(uris.filter((uri): uri is string => Boolean(uri)));
    };

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) {
        finish([]);
        return;
      }
      void Promise.all(files.map(readBrowserFile)).then((values) => finish(values.filter((uri): uri is string => Boolean(uri))));
    };
    input.oncancel = () => finish([]);
    document.body.appendChild(input);
    input.click();
  });
}

async function openNativePicker(source: ImageSource, multiple: boolean): Promise<string[]> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== ImagePicker.PermissionStatus.GRANTED) throw new MediaPermissionError(source);

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    return result.canceled ? [] : result.assets.map((asset) => asset.uri).filter(Boolean);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== ImagePicker.PermissionStatus.GRANTED) throw new MediaPermissionError(source);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 4 : 1,
    allowsEditing: false,
    quality: 0.8,
  });
  return result.canceled ? [] : result.assets.map((asset) => asset.uri).filter(Boolean);
}

export async function chooseImages(source: ImageSource, options?: { multiple?: boolean }): Promise<string[]> {
  const multiple = options?.multiple ?? false;
  return Platform.OS === "web" ? openBrowserPicker(source, multiple) : openNativePicker(source, multiple);
}

export async function takeVerificationPhoto(): Promise<string | null> {
  return (await chooseImages("camera"))[0] ?? null;
}

export async function pickVerificationImage(): Promise<string | null> {
  return (await chooseImages("library"))[0] ?? null;
}

/** Convert a local/native or browser URI to a data URL for an upload mutation. */
export async function imageUriToDataUrl(uri: string): Promise<string> {
  if (uri.startsWith("data:image/")) return uri;

  if (Platform.OS !== "web" && uri.startsWith("file://")) {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const mimeType = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(blob);
  });
  return `data:${mimeType};base64,${base64}`;
}
