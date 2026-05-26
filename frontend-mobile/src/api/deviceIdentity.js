import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "mgps_erp_mobile_device_id";

export async function getDeviceIdentity() {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    deviceId = `mgps-${seed}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return {
    deviceId,
    deviceType: `${Platform.OS} ${Platform.Version || ""}`.trim(),
    appVersion: Constants.expoConfig?.version || Constants.manifest?.version || "",
  };
}
