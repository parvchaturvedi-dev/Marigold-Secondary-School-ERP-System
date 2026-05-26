import { apiRequest } from "./apiClient";
import { getDeviceIdentity } from "./deviceIdentity";

export async function loginApi(username, password) {
  const device = await getDeviceIdentity();
  return await apiRequest("/auth/login", {
    method: "POST",
    headers: {
      "x-device-id": device.deviceId,
    },
    body: JSON.stringify({ username, password, deviceId: device.deviceId, deviceType: device.deviceType }),
  });
}
