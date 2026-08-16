import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function PushRegistration() {
  const { isAuthenticated } = useAuth();
  const registerToken = trpc.notifications.registerPushToken.useMutation();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string") router.push(url as "/(tabs)");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;
    let cancelled = false;
    const register = async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("marketing", {
            name: "Marketing and offers",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 200, 100, 200],
            lightColor: "#00AFC4",
          });
        }
        const permissions = await Notifications.getPermissionsAsync();
        const finalStatus = permissions.status === "granted" ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== "granted" || cancelled) return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!cancelled && token) await registerToken.mutateAsync({ token, platform: Platform.OS === "ios" ? "ios" : "android" });
      } catch (error) {
        console.warn("[PushRegistration] Push registration skipped:", error);
      }
    };
    void register();
    return () => { cancelled = true; };
  }, [isAuthenticated, registerToken]);

  return null;
}
