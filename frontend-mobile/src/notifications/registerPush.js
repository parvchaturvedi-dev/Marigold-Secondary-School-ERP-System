import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// The last Expo push token we handed to the backend. Cached so logout can
// unregister the exact same token instead of leaving it attached to a signed-out
// account (which would leak this user's notifications to the next login on the device).
let lastRegisteredToken = null;

export function getLastRegisteredToken() {
  return lastRegisteredToken;
}

export function clearLastRegisteredToken() {
  lastRegisteredToken = null;
}

// Action-button sets, keyed by the categoryId the backend sends per notification
// type (notify.js -> TYPE_META). Every button opens the app to the foreground.
const OPEN = { opensAppToForeground: true };
const NOTIFICATION_CATEGORIES = {
  fee: [
    { identifier: "PAY", buttonTitle: "Pay Now", options: OPEN },
    { identifier: "VIEW", buttonTitle: "View", options: OPEN },
  ],
  notice: [{ identifier: "READ", buttonTitle: "Read", options: OPEN }],
  assignment: [{ identifier: "VIEW", buttonTitle: "View", options: OPEN }],
  attendance: [{ identifier: "VIEW", buttonTitle: "View", options: OPEN }],
  event: [{ identifier: "VIEW", buttonTitle: "View", options: OPEN }],
  general: [{ identifier: "OPEN", buttonTitle: "Open", options: OPEN }],
};

// Register the interactive action-button categories (best-effort). Safe to call
// repeatedly — setNotificationCategoryAsync overwrites the same identifier.
async function registerNotificationCategories() {
  try {
    await Promise.all(
      Object.entries(NOTIFICATION_CATEGORIES).map(([id, actions]) =>
        Notifications.setNotificationCategoryAsync(id, actions)
      )
    );
  } catch (error) {
    console.warn("registerNotificationCategories failed:", error?.message || error);
  }
}

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
        lightColor: "#E4002B",
        sound: "default",
      });
    }

    // Register action-button categories so notifications show tap buttons.
    await registerNotificationCategories();

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
    lastRegisteredToken = token || lastRegisteredToken;
    return token;
  } catch (error) {
    console.warn("registerForPushNotifications failed:", error?.message || error);
    return null;
  }
}
