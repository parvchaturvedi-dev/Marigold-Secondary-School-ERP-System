import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as DocumentPicker from "expo-document-picker";

import { apiRequest } from "../../../api/apiClient";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import PageHeader from "../../../shared/components/PageHeader";
import { colors } from "../../../shared/theme/colors";
import { gradients, glassColors } from "../../../shared/theme/glass";

function formatUploadedAt(value) {
  if (!value) return "Upload date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isEmptyCalendarError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("no calendar") || message.includes("not uploaded") || message.includes("not found");
}

export default function AcademicCalendarScreen({ user }) {
  const canManage = user?.role === "admin" || user?.role === "clerk";
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadCalendar = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    setLoading(true);
    setError("");
    setEmpty(false);

    try {
      const data = await apiRequest("/academic-calendar/latest", { signal: controller.signal });
      setCalendar(data || null);
      setEmpty(!data);
    } catch (err) {
      setCalendar(null);
      if (err?.name === "AbortError") {
        setError("The calendar request timed out. Please try again.");
      } else if (isEmptyCalendarError(err)) {
        setEmpty(true);
      } else {
        setError(err.message || "Failed to load academic calendar.");
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  async function openPdf() {
    if (!calendar?.dataUrl) return;

    setOpening(true);
    try {
      const base64 = calendar.dataUrl.split(",")[1];
      if (!base64) throw new Error("Missing PDF data");

      const fileUri = `${FileSystem.cacheDirectory}academic-calendar.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === "android") {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: "application/pdf",
        });
      } else {
        await Linking.openURL(fileUri);
      }
    } catch {
      Alert.alert("Could not open PDF", "Install a PDF viewer or use the web portal.");
    } finally {
      setOpening(false);
    }
  }

  async function uploadCalendar() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: false, copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setBusy(true);
      setError("");
      const formData = new FormData();
      formData.append("calendarPdf", {
        uri: asset.uri,
        name: asset.name || "academic-calendar.pdf",
        type: asset.mimeType || "application/pdf",
      });
      formData.append("uploadedBy", user?.displayName || user?.username || "School office");
      await apiRequest("/academic-calendar", { method: "POST", body: formData });
      Alert.alert("Academic Calendar", "Calendar published successfully.");
      await loadCalendar();
    } catch (err) {
      Alert.alert("Upload failed", err.message || "Could not publish the calendar.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Remove calendar", "Delete the published academic calendar?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await apiRequest("/academic-calendar", { method: "DELETE" });
            await loadCalendar();
          } catch (err) {
            Alert.alert("Delete failed", err.message || "Could not delete the calendar.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AuroraBackground />
        <PageHeader title="Academic Calendar" />
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading academic calendar...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AuroraBackground />
      <PageHeader title="Academic Calendar" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons name="calendar-outline" size={22} color={glassColors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Academic Calendar</Text>
              <Text style={styles.headerSubtitle}>Latest school calendar PDF</Text>
            </View>
          </View>
        </GlassCard>

        {canManage && (
          <GlassCard style={styles.manageCard}>
            <Text style={styles.manageTitle}>Manage Calendar</Text>
            <Text style={styles.manageSub}>Publish a new PDF (replaces the current one) or remove it.</Text>
            <PrimaryButton icon="cloud-upload-outline" label={busy ? "Working..." : "Upload / Replace PDF"} onPress={uploadCalendar} disabled={busy} />
            {!!calendar && (
              <TouchableOpacity onPress={confirmDelete} disabled={busy} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={glassColors.danger} />
                <Text style={styles.deleteText}>Delete Published Calendar</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        )}

        {!!error && (
          <GlassCard style={styles.stateCard}>
            <Ionicons name="warning-outline" size={34} color={glassColors.danger} />
            <Text style={styles.stateTitle}>Unable to load calendar</Text>
            <Text style={styles.stateText}>{error}</Text>
            <PrimaryButton icon="refresh-outline" label="Try Again" onPress={loadCalendar} />
          </GlassCard>
        )}

        {!error && empty && (
          <GlassCard style={styles.stateCard}>
            <Ionicons name="document-text-outline" size={34} color={glassColors.inkFaint} />
            <Text style={styles.stateTitle}>No calendar uploaded yet.</Text>
          </GlassCard>
        )}

        {!error && !!calendar && (
          <GlassCard style={styles.detailCard}>
            <View style={styles.fileIcon}>
              <Ionicons name="document-attach-outline" size={28} color="#fff" />
            </View>
            <Text style={styles.fileName}>{calendar.name || "Academic Calendar.pdf"}</Text>
            <Text style={styles.metaText}>Uploaded by {calendar.uploadedBy || "School office"}</Text>
            <Text style={styles.metaText}>{formatUploadedAt(calendar.uploadedAt)}</Text>
            <PrimaryButton icon="open-outline" label={opening ? "Opening..." : "Open PDF"} onPress={openPdf} disabled={opening} />
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function PrimaryButton({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.primaryButtonWrap, disabled && styles.disabledButton]}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
        <Ionicons name={icon} size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "700",
    color: glassColors.inkSoft,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerCard: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${glassColors.accent}33`,
    backgroundColor: `${glassColors.accent}1f`,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    marginTop: 3,
  },
  stateCard: {
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  stateText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  detailCard: {
    padding: 20,
    alignItems: "center",
    gap: 9,
  },
  fileIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: glassColors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fileName: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  metaText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textAlign: "center",
  },
  primaryButtonWrap: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 10,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.7,
  },
  manageCard: {
    padding: 18,
    gap: 6,
  },
  manageTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
  },
  manageSub: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 4,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: `${glassColors.danger}14`,
  },
  deleteText: {
    color: glassColors.danger,
    fontWeight: "900",
  },
});
