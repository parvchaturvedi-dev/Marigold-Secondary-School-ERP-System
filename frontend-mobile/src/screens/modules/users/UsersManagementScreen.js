// Users Management — directory of all identity users with password reveal,
// credential emails and inline edit. Mirrors web Admin/UsersManagement.jsx.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  Divider,
  Hero,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  Segmented,
  SmallButton,
  TextField,
  Toggle,
  useBanner,
} from "../shared/formKit";

const ROLE_FILTERS = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admin" },
  { value: "clerk", label: "Clerk" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
];

export default function UsersManagementScreen() {
  const { palette } = useTheme();
  const banner = useBanner();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState({}); // username -> {otpOpen, otp, password, editOpen, edit}

  const load = useCallback(async () => {
    // If we already have cached users, refresh in the background (no spinner).
    if (!globalThis.__mgpsUsersCache) setLoading(true);
    try {
      const payload = await apiRequest("/auth/users");
      const list = Array.isArray(payload) ? payload : payload?.users || [];
      globalThis.__mgpsUsersCache = list;
      setUsers(list);
    } catch (err) {
      banner.showError(err);
    } finally {
      setLoading(false);
    }
  }, [banner]);

  // Show cached users instantly on the very first render.
  useEffect(() => {
    const cached = globalThis.__mgpsUsersCache;
    if (Array.isArray(cached) && cached.length) {
      setUsers(cached);
      setLoading(false);
    }
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.username, u.displayName, u.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [users, roleFilter, query]);

  const patch = (username, next) => setState((c) => ({ ...c, [username]: { ...c[username], ...next } }));

  async function sendCredentialsAll() {
    setBusy(true);
    banner.clear();
    try {
      const payload = await apiRequest("/auth/users/send-credentials-all", { method: "POST" });
      banner.showSuccess(payload?.message || "Credentials emailed to all active users.");
    } catch (err) {
      banner.showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function sendCredentials(u) {
    try {
      const payload = await apiRequest(`/auth/users/${encodeURIComponent(u.username)}/send-credentials`, { method: "POST" });
      banner.showSuccess(payload?.message || `Credentials emailed to ${u.username}.`);
    } catch (err) {
      banner.showError(err);
    }
  }

  async function requestOtp(u) {
    try {
      const payload = await apiRequest(`/auth/users/${encodeURIComponent(u.username)}/request-password-otp`, { method: "POST" });
      patch(u.username, { otpOpen: true, otp: "", password: "" });
      banner.showSuccess(payload?.message || "OTP sent to registered email.");
    } catch (err) {
      banner.showError(err);
    }
  }

  async function revealPassword(u) {
    const s = state[u.username];
    if (!s?.otp?.trim()) return;
    try {
      const payload = await apiRequest(`/auth/users/${encodeURIComponent(u.username)}/reveal-password`, {
        method: "POST",
        body: JSON.stringify({ otp: s.otp }),
      });
      patch(u.username, { password: payload.password || "Not available", otpOpen: true, otp: "" });
    } catch (err) {
      banner.showError(err);
    }
  }

  function openEdit(u) {
    patch(u.username, {
      editOpen: true,
      edit: { displayName: u.displayName || "", email: u.email || u.profile?.email || "", mobile: u.mobile || u.profile?.mobile || "", isActive: u.isActive !== false },
    });
  }

  async function saveEdit(u) {
    const edit = state[u.username]?.edit;
    if (!edit) return;
    try {
      const payload = await apiRequest(`/auth/users/${encodeURIComponent(u.username)}`, {
        method: "PATCH",
        body: JSON.stringify(edit),
      });
      setUsers(payload.users || users.map((x) => (x.username === u.username ? { ...x, ...edit } : x)));
      patch(u.username, { editOpen: false });
      banner.showSuccess(payload?.message || "User updated.");
    } catch (err) {
      banner.showError(err);
    }
  }

  return (
    <ScreenShell title="Users Management" refreshing={loading} onRefresh={load}>
      <Hero icon="people-circle-outline" title={`${users.length} users`} subtitle="Reveal credentials, email logins and edit accounts." />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name, ID or email" autoCapitalize="none" />
        <Text style={[styles.label, { color: palette.inkLabel }]}>Filter by role</Text>
        <Segmented options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} />
        <View style={{ height: 12 }} />
        <PrimaryButton icon="mail-outline" label="Email Credentials To All" onPress={sendCredentialsAll} loading={busy} />
      </Card>

      <SectionTitle right={<Text style={[styles.count, { color: palette.inkSoft, backgroundColor: palette.tile }]}>{filtered.length}</Text>}>Directory</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading users..." />
      ) : (
        filtered.map((u) => {
          const s = state[u.username] || {};
          return (
            <Card key={u.username}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>{u.displayName || u.username}</Text>
                  <Text style={[styles.sub, { color: palette.inkSoft }]}>{u.username} · {u.role}</Text>
                </View>
                <View style={[styles.status, { backgroundColor: u.isActive === false ? "#FEE2E2" : "#DCFCE7" }]}>
                  <Text style={[styles.statusText, { color: u.isActive === false ? "#B91C1C" : "#15803D" }]}>
                    {u.isActive === false ? "Inactive" : "Active"}
                  </Text>
                </View>
              </View>

              {s.password ? (
                <>
                  <Divider />
                  <Text style={[styles.password, { color: palette.ink }]}>Password: {s.password}</Text>
                </>
              ) : s.otpOpen ? (
                <>
                  <Divider />
                  <TextField
                    label="Enter OTP sent to email"
                    value={s.otp}
                    onChangeText={(v) => patch(u.username, { otp: v })}
                    placeholder="6-digit OTP"
                    keyboardType="number-pad"
                  />
                  <SmallButton label="Reveal Password" icon="key-outline" onPress={() => revealPassword(u)} />
                </>
              ) : null}

              {s.editOpen && (
                <>
                  <Divider />
                  <TextField label="Display Name" value={s.edit.displayName} onChangeText={(v) => patch(u.username, { edit: { ...s.edit, displayName: v } })} />
                  <TextField label="Email" value={s.edit.email} onChangeText={(v) => patch(u.username, { edit: { ...s.edit, email: v } })} keyboardType="email-address" autoCapitalize="none" />
                  <TextField label="Mobile" value={s.edit.mobile} onChangeText={(v) => patch(u.username, { edit: { ...s.edit, mobile: v } })} keyboardType="phone-pad" />
                  <Toggle label="Active account" value={s.edit.isActive} onValueChange={(v) => patch(u.username, { edit: { ...s.edit, isActive: v } })} />
                  <SmallButton label="Save Changes" icon="save-outline" onPress={() => saveEdit(u)} />
                </>
              )}

              <ButtonRow>
                <SmallButton label="Reveal" icon="eye-outline" onPress={() => requestOtp(u)} />
                <SmallButton label="Email Login" icon="mail-outline" onPress={() => sendCredentials(u)} />
                <SmallButton label={s.editOpen ? "Close" : "Edit"} icon="create-outline" onPress={() => (s.editOpen ? patch(u.username, { editOpen: false }) : openEdit(u))} />
              </ButtonRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = {
  label: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  count: { color: "#64748B", fontWeight: "900", backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rowHead: { flexDirection: "row", alignItems: "center" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3, textTransform: "capitalize" },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  password: { color: "#0F172A", fontWeight: "900", fontFamily: "monospace" },
};
