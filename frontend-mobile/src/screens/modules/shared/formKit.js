// Shared mobile form/CRUD kit — reusable building blocks so every module screen
// stays thin and visually consistent with the glass design system.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import PageHeader from "../../../components/cards/PageHeader";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import { useTheme } from "../../../theme/ThemeContext";
import { gradients, glassColors } from "../../../shared/theme/glass";
import { colors } from "../../../shared/theme/colors";
import { apiRequest } from "../../../api/apiClient";
import { onRealtimeEvent } from "../../../notifications/realtime";

export const kitColors = glassColors;
export const todayIso = () => new Date().toISOString().slice(0, 10);

// ---- Layout ---------------------------------------------------------------

export function ScreenShell({ title, children, refreshing = false, onRefresh, contentStyle }) {
  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title={title} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={glassColors.accent} />
          ) : undefined
        }
        contentContainerStyle={[{ padding: 16, paddingBottom: 40 }, contentStyle]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children, style }) {
  return (
    <GlassCard style={[styles.card, style]}>
      <View style={styles.cardInner}>{children}</View>
    </GlassCard>
  );
}

export function Hero({ icon = "apps-outline", title, subtitle }) {
  const { palette } = useTheme();
  return (
    <GlassCard style={styles.heroCard}>
      <View style={styles.heroInner}>
        <LinearGradient colors={gradients.chip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
          <Ionicons name={icon} size={26} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroTitle, { color: palette.ink }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.heroText, { color: palette.inkSoft }]}>{subtitle}</Text>}
        </View>
      </View>
    </GlassCard>
  );
}

export function SectionTitle({ children, right }) {
  const { palette } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: palette.headerInk }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---- Inputs ---------------------------------------------------------------

export function Field({ label, children, hint }) {
  const { palette } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Text style={[styles.fieldLabel, { color: palette.inkLabel }]}>{label}</Text>}
      {children}
      {!!hint && <Text style={[styles.fieldHint, { color: palette.inkFaint }]}>{hint}</Text>}
    </View>
  );
}

export function TextField({ label, value, onChangeText, hint, style, ...props }) {
  const { palette } = useTheme();
  const input = (
    <TextInput
      style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.ink }, props.multiline && styles.textArea, style]}
      value={value === undefined || value === null ? "" : String(value)}
      onChangeText={onChangeText}
      placeholderTextColor={palette.inkFaint}
      {...props}
    />
  );
  if (!label && !hint) return input;
  return (
    <Field label={label} hint={hint}>
      {input}
    </Field>
  );
}

export function TextArea(props) {
  return <TextField multiline {...props} />;
}

export function Toggle({ label, value, onValueChange }) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={[styles.toggleRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }, value && styles.toggleRowOn]}
    >
      <Text style={[styles.toggleLabel, { color: palette.ink }, value && { color: "#fff" }]}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </TouchableOpacity>
  );
}

export function Segmented({ options = [], value, onChange }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: palette.tile }]}>
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = val === value;
        return (
          <TouchableOpacity
            key={val}
            onPress={() => onChange(val)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, { color: palette.accentDeep }, active && { color: "#fff" }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function normalizeOptions(options = []) {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)).filter((o) => o && o.value !== undefined);
}

export function Checkbox({ label, checked, onChange, disabled }) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View
        style={[
          styles.checkBox,
          { borderColor: checked ? colors.primary : palette.inputBorder, backgroundColor: checked ? colors.primary : "transparent" },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={[styles.checkLabel, { color: palette.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Multi-select checkbox list. values = array of selected values.
export function MultiSelect({ label, hint, options = [], values = [], onChange }) {
  const opts = normalizeOptions(options);
  const selected = Array.isArray(values) ? values : [];
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Field label={label} hint={hint}>
      <View style={{ gap: 2 }}>
        {opts.length ? (
          opts.map((o) => <Checkbox key={String(o.value)} label={o.label} checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />)
        ) : (
          <Text style={{ color: "#94A3B8", fontWeight: "700" }}>No options available.</Text>
        )}
      </View>
    </Field>
  );
}

// Single-select dropdown (opens a modal sheet).
export function Select({ label, hint, value, onChange, options = [], placeholder = "Select" }) {
  const { palette } = useTheme();
  const [open, setOpen] = useState(false);
  const opts = normalizeOptions(options);
  const selected = opts.find((o) => String(o.value) === String(value));
  return (
    <Field label={label} hint={hint}>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.input, styles.selectRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
      >
        <Text style={{ color: selected ? palette.ink : palette.inkFaint, fontWeight: "800", flex: 1 }} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={palette.inkSoft} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            {!!label && <Text style={[styles.modalTitle, { color: palette.ink }]}>{label}</Text>}
            <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
              {opts.map((o) => {
                const active = String(o.value) === String(value);
                return (
                  <TouchableOpacity
                    key={String(o.value)}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={[styles.optionRow, { borderBottomColor: palette.cardBorder }]}
                  >
                    <Text style={{ color: active ? palette.accentDeep : palette.ink, fontWeight: "800", flex: 1 }}>{o.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Field>
  );
}

// Native date picker. value/onChange use an ISO "YYYY-MM-DD" string.
export function DateField({ label, hint, value, onChange, placeholder = "Select date", mode = "date" }) {
  const { palette } = useTheme();
  const [show, setShow] = useState(false);
  const parsed = value ? new Date(value) : null;
  const initial = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  return (
    <Field label={label} hint={hint}>
      <TouchableOpacity
        onPress={() => setShow(true)}
        style={[styles.input, styles.selectRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
      >
        <Text style={{ color: value ? palette.ink : palette.inkFaint, fontWeight: "800", flex: 1 }}>{value || placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color={palette.inkSoft} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={initial}
          mode={mode}
          display="default"
          onChange={(event, selected) => {
            if (Platform.OS !== "ios") setShow(false);
            if (event.type === "set" && selected) {
              onChange(selected.toISOString().slice(0, 10));
              if (Platform.OS === "ios") setShow(false);
            } else if (event.type === "dismissed") {
              setShow(false);
            }
          }}
        />
      )}
    </Field>
  );
}

// Image attachment (gallery) with preview. value = { uri, dataUrl, name, type } | null.
export function ImageField({ label, hint, value, onChange }) {
  const { palette } = useTheme();
  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const type = a.mimeType || "image/jpeg";
    const dataUrl = a.base64 ? `data:${type};base64,${a.base64}` : a.uri;
    onChange({ uri: a.uri, dataUrl, name: a.fileName || "image.jpg", type, status: "Uploaded" });
  }
  return (
    <Field label={label} hint={hint}>
      {value?.dataUrl || value?.uri ? (
        <View style={[styles.attachPreview, { borderColor: palette.inputBorder }]}>
          <Image source={{ uri: value.dataUrl || value.uri }} style={styles.attachThumb} />
          <Text style={{ color: palette.ink, fontWeight: "800", flex: 1 }} numberOfLines={1}>{value.name || "Image"}</Text>
          <IconButton icon="close" tone="danger" onPress={() => onChange(null)} />
        </View>
      ) : (
        <TouchableOpacity onPress={pick} style={[styles.attachBtn, { borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}>
          <Ionicons name="image-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primaryDark, fontWeight: "900" }}>Attach Image</Text>
        </TouchableOpacity>
      )}
    </Field>
  );
}

// File attachment (pdf/image/etc via document picker) with name display.
// value = { uri, dataUrl, name, type, size } | null.
export function FileField({ label, hint, value, onChange, types = ["image/*", "application/pdf"] }) {
  const { palette } = useTheme();
  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: types, multiple: false, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const base64 = await FileSystem.readAsStringAsync(a.uri, { encoding: "base64" });
    const type = a.mimeType || "application/octet-stream";
    onChange({
      uri: a.uri,
      name: a.name || "document",
      file: a.name || "document",
      type,
      size: a.size || 0,
      dataUrl: `data:${type};base64,${base64}`,
      status: "Uploaded",
      uploadedAt: new Date().toISOString(),
    });
  }
  return (
    <Field label={label} hint={hint}>
      {value?.name ? (
        <View style={[styles.attachPreview, { borderColor: palette.inputBorder }]}>
          <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
          <Text style={{ color: palette.ink, fontWeight: "800", flex: 1 }} numberOfLines={1}>{value.name}</Text>
          <IconButton icon="close" tone="danger" onPress={() => onChange(null)} />
        </View>
      ) : (
        <TouchableOpacity onPress={pick} style={[styles.attachBtn, { borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}>
          <Ionicons name="attach-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primaryDark, fontWeight: "900" }}>Attach File</Text>
        </TouchableOpacity>
      )}
    </Field>
  );
}

// ---- Buttons --------------------------------------------------------------

export function PrimaryButton({ icon, label, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.primaryWrap, (disabled || loading) && { opacity: 0.6 }]}
    >
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {!!icon && <Ionicons name={icon} size={19} color="#fff" />}
            <Text style={styles.primaryText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function GhostButton({ icon, label, onPress, disabled, tone = "accent" }) {
  const tint = tone === "danger" ? glassColors.danger : colors.primary;
  const bg = tone === "danger" ? `${glassColors.danger}14` : "rgba(99,102,241,0.12)";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.ghostBtn, { backgroundColor: bg }, disabled && { opacity: 0.5 }]}
    >
      {!!icon && <Ionicons name={icon} size={18} color={tint} />}
      <Text style={[styles.ghostText, { color: tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SmallButton({ label, icon, onPress, disabled, active, tone }) {
  const tint = tone === "danger" ? glassColors.danger : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallBtn, active && { backgroundColor: colors.primaryDark }, disabled && { opacity: 0.5 }]}
    >
      {!!icon && <Ionicons name={icon} size={15} color={active ? "#fff" : tint} />}
      <Text style={[styles.smallText, { color: active ? "#fff" : tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function IconButton({ icon, onPress, tone = "accent", disabled }) {
  const tint = tone === "danger" ? glassColors.danger : colors.primary;
  const bg = tone === "danger" ? `${glassColors.danger}14` : "#EEF2FF";
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.iconBtn, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </TouchableOpacity>
  );
}

export function ButtonRow({ children }) {
  return <View style={styles.actionRow}>{children}</View>;
}

// ---- Feedback -------------------------------------------------------------

export function Banner({ type = "info", message }) {
  if (!message) return null;
  const palette = {
    error: { bg: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.35)", fg: glassColors.danger, icon: "alert-circle-outline" },
    success: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.35)", fg: glassColors.success, icon: "checkmark-circle-outline" },
    info: { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.30)", fg: glassColors.accent, icon: "information-circle-outline" },
  }[type];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title = "No records yet", text }) {
  const { palette } = useTheme();
  return (
    <GlassCard style={styles.stateCard}>
      <View style={styles.stateInner}>
        <Ionicons name={icon} size={52} color={palette.accent} />
        <Text style={[styles.stateTitle, { color: palette.ink }]}>{title}</Text>
        {!!text && <Text style={[styles.stateText, { color: palette.inkSoft }]}>{text}</Text>}
      </View>
    </GlassCard>
  );
}

export function LoadingCard({ text = "Loading..." }) {
  const { palette } = useTheme();
  return (
    <GlassCard style={styles.loadingCard}>
      <View style={styles.loadingInner}>
        <ActivityIndicator color={palette.accent} size="large" />
        <Text style={[styles.loadingText, { color: palette.inkSoft }]}>{text}</Text>
      </View>
    </GlassCard>
  );
}

export function DetailRows({ rows = [] }) {
  const { palette } = useTheme();
  const visible = rows.filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!visible.length) return null;
  return (
    <View style={[styles.detailBox, { borderTopColor: palette.cardBorder }]}>
      {visible.map(([key, value]) => (
        <View key={key} style={styles.detailRow}>
          <Text style={[styles.detailKey, { color: palette.inkFaint }]}>{key}</Text>
          <Text style={[styles.detailValue, { color: palette.ink }]} numberOfLines={3}>
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---- Hooks ----------------------------------------------------------------

export function useBanner() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const showError = useCallback((msg) => {
    setSuccess("");
    setError(typeof msg === "string" ? msg : msg?.message || "Something went wrong");
  }, []);
  const showSuccess = useCallback((msg) => {
    setError("");
    setSuccess(msg);
  }, []);
  const clear = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);
  return { error, success, showError, showSuccess, clear };
}

// In-memory cache shared across all useModuleState instances so hopping
// between screens is instant instead of refetching every namespace each time.
const moduleStateCache = new Map();

// Load & persist a module-state array namespace (admin/clerk write access).
export function useModuleState(namespace) {
  const cached = moduleStateCache.get(namespace);
  const [items, setItems] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    // If we already have cached data, refresh in the background — no spinner.
    if (!moduleStateCache.has(namespace)) setLoading(true);
    setError("");
    try {
      const payload = await apiRequest(`/module-state/${encodeURIComponent(namespace)}`);
      const value = payload?.value;
      const next = Array.isArray(value) ? value : value ? [value] : [];
      moduleStateCache.set(namespace, next);
      setItems(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Live-refresh on backend broadcasts, throttled so we don't stampede reloads.
  useEffect(() => {
    let pending = null;
    const unsubscribe = onRealtimeEvent((payload) => {
      if (payload?.eventName === "socket:connected") return;
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        reload();
      }, 2500);
    });
    return () => {
      if (pending) clearTimeout(pending);
      unsubscribe();
    };
  }, [reload]);

  const persist = useCallback(
    async (nextItems) => {
      await apiRequest(`/module-state/${encodeURIComponent(namespace)}`, {
        method: "PUT",
        body: JSON.stringify({ value: nextItems }),
      });
      moduleStateCache.set(namespace, nextItems);
      setItems(nextItems);
    },
    [namespace]
  );

  return { items, setItems, loading, error, reload, persist };
}

const styles = {
  card: { borderRadius: 20, marginBottom: 14 },
  cardInner: { padding: 16 },
  heroCard: { borderRadius: 20, marginBottom: 14 },
  heroInner: { padding: 16, flexDirection: "row", alignItems: "center" },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 14 },
  heroTitle: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  heroText: { color: "#64748B", lineHeight: 19, marginTop: 4 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 },
  sectionTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900" },
  divider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 12 },
  fieldLabel: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  fieldHint: { color: "#94A3B8", fontSize: 11, fontWeight: "700", marginTop: 4, marginLeft: 2 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glassColors.cardBorder,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  textArea: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  selectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  checkBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkLabel: { fontWeight: "800", flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalSheet: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 8 },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  attachBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  attachPreview: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#EEF2F7" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glassColors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  toggleRowOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  toggleLabel: { color: "#0F172A", fontWeight: "800", flex: 1, marginRight: 10 },
  toggleTrack: { width: 46, height: 26, borderRadius: 13, backgroundColor: "#CBD5E1", padding: 3, justifyContent: "center" },
  toggleTrackOn: { backgroundColor: "rgba(255,255,255,0.5)" },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  toggleKnobOn: { alignSelf: "flex-end", backgroundColor: "#fff" },
  segmented: { flexDirection: "row", backgroundColor: "#EEF2FF", borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.primaryDark },
  segmentText: { color: "#4F46E5", fontWeight: "900", fontSize: 13 },
  primaryWrap: { borderRadius: 16, overflow: "hidden", marginTop: 6 },
  primaryBtn: { minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  ghostBtn: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 14,
  },
  ghostText: { fontWeight: "900" },
  smallBtn: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  smallText: { fontWeight: "900", fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  bannerText: { fontWeight: "800", flex: 1, fontSize: 13 },
  stateCard: { borderRadius: 22, marginBottom: 14 },
  stateInner: { padding: 26, alignItems: "center" },
  stateTitle: { marginTop: 14, fontSize: 20, fontWeight: "900", color: "#0F172A", textAlign: "center" },
  stateText: { color: "#64748B", textAlign: "center", lineHeight: 21, marginTop: 8 },
  loadingCard: { borderRadius: 22, minHeight: 160, marginBottom: 14 },
  loadingInner: { flex: 1, minHeight: 160, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#64748B", marginTop: 12, fontWeight: "800" },
  detailBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#EEF2F7", paddingTop: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  detailKey: { color: "#94A3B8", fontSize: 12, fontWeight: "900", width: 120 },
  detailValue: { color: "#0F172A", flex: 1, fontWeight: "700", textAlign: "right" },
};
