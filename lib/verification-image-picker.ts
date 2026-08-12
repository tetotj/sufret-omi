import { Platform } from "react-native";

/** Returns a selected image as a data URI in web builds; native builds can swap in expo-image-picker later. */
export async function pickVerificationImage(): Promise<string | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
