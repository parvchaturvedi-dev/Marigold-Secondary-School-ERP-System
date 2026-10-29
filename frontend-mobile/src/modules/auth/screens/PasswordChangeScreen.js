import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiRequest } from "../../../api/apiClient";
import { useAuth } from "../../../auth/AuthContext";
import { gradients } from "../../../shared/theme/glass";

export default function PasswordChangeScreen() {
  const { completePasswordChange, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (newPassword.length < 6) {
      setError("New password must contain at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      await completePasswordChange();
    } catch (requestError) {
      setError(requestError?.message || "Unable to change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F8FAFC" }}
    >
      <View style={{ borderRadius: 24, padding: 24, backgroundColor: "#fff", gap: 14 }}>
        <Text style={{ color: "#D97706", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 }}>
          SECURITY REQUIRED
        </Text>
        <Text style={{ color: "#0F172A", fontSize: 24, fontWeight: "900" }}>
          Change your password
        </Text>
        <Text style={{ color: "#64748B", lineHeight: 20 }}>
          Set a private password before using the ERP portal.
        </Text>

        {error ? <Text style={{ color: "#B91C1C", fontWeight: "700" }}>{error}</Text> : null}
        <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
        <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} />
        <PasswordField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} />

        <TouchableOpacity onPress={submit} disabled={saving} style={{ borderRadius: 14, overflow: "hidden" }}>
          <LinearGradient
            colors={gradients.primary}
            style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: "#fff", fontWeight: "900" }}>SAVE PASSWORD</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={{ alignItems: "center", padding: 8 }}>
          <Text style={{ color: "#475569", fontWeight: "800" }}>Log out</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function PasswordField({ label, value, onChangeText }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: "#475569", fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: "#CBD5E1",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: "#0F172A",
        }}
      />
    </View>
  );
}
