// Settings — change password (all roles), notification prefs (local),
// and admin-only Danger Zone factory reset. Mirrors web Admin/Settings.jsx.
import React, { useState } from "react";
import { Alert, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  Divider,
  Hero,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  Segmented,
  SmallButton,
  TextField,
  Toggle,
  useBanner,
} from "../shared/formKit";

const RESET_SCOPES = [
  { key: "students", label: "Students" },
  { key: "teachers", label: "Teachers" },
  { key: "clerks", label: "Clerks" },
  { key: "all", label: "Everything" },
];

export default function SettingsScreen({ user }) {
  const isAdmin = user?.role === "admin";
  const { mode, setMode, palette } = useTheme();
  const pwBanner = useBanner();
  const resetBanner = useBanner();

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [prefs, setPrefs] = useState({ email: true, push: true, attendance: true, exams: true });

  const [scopes, setScopes] = useState([]);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const updatePw = (field, value) => setPw((current) => ({ ...current, [field]: value }));
  const toggleScope = (key) =>
    setScopes((current) => (current.includes(key) ? current.filter((s) => s !== key) : [...current, key]));

  async function changePassword() {
    if (!pw.currentPassword || !pw.newPassword) return pwBanner.showError("Fill in all password fields.");
    if (pw.newPassword.length < 6) return pwBanner.showError("New password must be at least 6 characters.");
    if (pw.newPassword !== pw.confirmPassword) return pwBanner.showError("New and confirm passwords do not match.");
    setSavingPw(true);
    pwBanner.clear();
    try {
      const payload = await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(pw),
      });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      pwBanner.showSuccess(payload?.message || "Password updated successfully.");
    } catch (err) {
      pwBanner.showError(err);
    } finally {
      setSavingPw(false);
    }
  }

  function confirmReset() {
    if (!scopes.length) return resetBanner.showError("Select at least one reset scope.");
    if (confirmText.trim().toUpperCase() !== "DELETE") return resetBanner.showError('Type DELETE to confirm.');
    Alert.alert(
      "Factory Reset",
      `This permanently deletes: ${scopes.join(", ")}. This cannot be undone. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: runReset },
      ]
    );
  }

  async function runReset() {
    setResetting(true);
    resetBanner.clear();
    try {
      const payload = await apiRequest("/admin/factory-reset", {
        method: "POST",
        body: JSON.stringify({ scopes }),
      });
      setScopes([]);
      setConfirmText("");
      resetBanner.showSuccess(payload?.message || "Factory reset completed.");
    } catch (err) {
      resetBanner.showError(err);
    } finally {
      setResetting(false);
    }
  }

  return (
    <ScreenShell title="Settings">
      <Hero icon="settings-outline" title="Account & Security" subtitle="Manage your password and preferences." />

      <Card>
        <SectionTitle>Change Password</SectionTitle>
        <Banner type="error" message={pwBanner.error} />
        <Banner type="success" message={pwBanner.success} />
        <TextField
          label="Current Password"
          value={pw.currentPassword}
          onChangeText={(v) => updatePw("currentPassword", v)}
          placeholder="Current password"
          secureTextEntry
        />
        <TextField
          label="New Password"
          value={pw.newPassword}
          onChangeText={(v) => updatePw("newPassword", v)}
          placeholder="Minimum 6 characters"
          secureTextEntry
        />
        <TextField
          label="Confirm New Password"
          value={pw.confirmPassword}
          onChangeText={(v) => updatePw("confirmPassword", v)}
          placeholder="Re-enter new password"
          secureTextEntry
        />
        <PrimaryButton icon="lock-closed-outline" label="Update Password" onPress={changePassword} loading={savingPw} />
      </Card>

      <Card>
        <SectionTitle>Appearance</SectionTitle>
        <Text style={[styles.note, { color: palette.inkSoft }]}>Choose how the app looks. Saved on this device.</Text>
        <View style={{ height: 10 }} />
        <Segmented
          options={[{ value: "light", label: "☀  Light" }, { value: "dark", label: "☾  Dark" }]}
          value={mode}
          onChange={setMode}
        />
      </Card>

      <Card>
        <SectionTitle>Notifications</SectionTitle>
        <Toggle label="Email alerts" value={prefs.email} onValueChange={(v) => setPrefs((p) => ({ ...p, email: v }))} />
        <Toggle label="Push notifications" value={prefs.push} onValueChange={(v) => setPrefs((p) => ({ ...p, push: v }))} />
        <Toggle label="Attendance reminders" value={prefs.attendance} onValueChange={(v) => setPrefs((p) => ({ ...p, attendance: v }))} />
        <Toggle label="Exam & result alerts" value={prefs.exams} onValueChange={(v) => setPrefs((p) => ({ ...p, exams: v }))} />
        <Text style={[styles.note, { color: palette.inkSoft }]}>Preferences apply to this device.</Text>
      </Card>

      {isAdmin && (
        <Card style={styles.dangerCard}>
          <SectionTitle>Danger Zone — Factory Reset</SectionTitle>
          <Banner type="error" message={resetBanner.error} />
          <Banner type="success" message={resetBanner.success} />
          <Text style={[styles.note, { color: palette.inkSoft }]}>
            Permanently wipes the selected data. Admin accounts are never deleted. Use only on a test/empty database.
          </Text>
          <Divider />
          <Text style={[styles.fieldLabel, { color: palette.inkLabel }]}>Select what to delete</Text>
          <ButtonRow>
            {RESET_SCOPES.map((s) => (
              <SmallButton
                key={s.key}
                label={s.label}
                icon={scopes.includes(s.key) ? "checkbox-outline" : "square-outline"}
                active={scopes.includes(s.key)}
                onPress={() => toggleScope(s.key)}
              />
            ))}
          </ButtonRow>
          <View style={{ height: 10 }} />
          <TextField
            label='Type "DELETE" to confirm'
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            autoCapitalize="characters"
          />
          <PrimaryButton icon="trash-outline" label="Run Factory Reset" onPress={confirmReset} loading={resetting} />
        </Card>
      )}
    </ScreenShell>
  );
}

const styles = {
  note: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 8, lineHeight: 18 },
  fieldLabel: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  dangerCard: { borderColor: "rgba(244,63,94,0.30)" },
};
