import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 54 requires these two for foreground alerts (shouldShowAlert deprecated).
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
        sound: "default",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn("registerForPushNotifications: missing EAS projectId, skipping push token registration");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch (error) {
    console.warn("registerForPushNotifications failed:", error?.message || error);
    return null;
  }
}
