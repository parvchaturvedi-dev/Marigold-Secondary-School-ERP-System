import { apiRequest } from "./apiClient";

export async function loginApi(username, password) {
  return await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
