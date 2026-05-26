import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/cards/PageHeader";
import { fetchModuleData, markNotificationsRead, participateInEvent } from "../api/moduleApi";

const hiddenKeys = new Set([
  "_id",
  "id",
  "imageDataUrl",
  "attachment",
  "encryptedPayload",
  "encryption",
  "participants",
  "votes",
  "attendance",
]);

const titleKeys = [
  "title",
  "displayName",
  "name",
  "studentName",
  "teacherName",
  "username",
  "subject",
  "type",
  "className",
  "status",
];

const subKeys = [
  "description",
  "message",
  "category",
  "role",
  "targetClassName",
  "date",
  "startDate",
  "checkingDate",
  "createdAt",
  "updatedAt",
];

function humanizeKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function valueToText(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

function getTitle(row = {}, fallback) {
  for (const key of titleKeys) {
    const value = valueToText(row[key]);
    if (value) return value;
  }
  return fallback;
}

function getSubtitle(row = {}) {
  for (const key of subKeys) {
    const value = valueToText(row[key]);
    if (value) return value;
  }
  return "Synced from ERP database";
}

function getDetails(row = {}) {
  return Object.entries(row)
    .filter(([key, value]) => !hiddenKeys.has(key) && !titleKeys.includes(key) && !subKeys.includes(key) && valueToText(value))
    .slice(0, 5);
}

function getCountLabel(title, rows) {
  if (title === "Academic Calendar") return rows.length ? "Latest file available" : "No file uploaded";
  if (title === "Profile" || title === "Settings" || title === "Id Card" || title === "ID Card") return "Account synced";
  return `${rows.length} record${rows.length === 1 ? "" : "s"}`;
}

export default function ConnectedModuleScreen() {
  const { selectedModule, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [config, setConfig] = useState(null);
  const [rawPayload, setRawPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const title = config?.title || selectedModule || "Module";
  const unreadIds = useMemo(
    () => rows.filter((item) => item.unread).map((item) => item.id).filter(Boolean),
    [rows]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchModuleData(selectedModule, user);
      setConfig(data.config);
      setRows(data.rows);
      setRawPayload(data.payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [selectedModule, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkRead() {
    if (!unreadIds.length) return;
    setActing(true);
    try {
      await markNotificationsRead(unreadIds);
      await load();
    } catch (actionError) {
      Alert.alert(title, actionError.message);
    } finally {
      setActing(false);
    }
  }

  async function handleParticipate(row) {
    setActing(true);
    try {
      await participateInEvent(row.id, user);
      Alert.alert("Events", "Participation recorded.");
      await load();
    } catch (actionError) {
      Alert.alert("Events", actionError.message);
    } finally {
      setActing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
      <PageHeader title={title} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="server-outline" size={28} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{getCountLabel(title, rows)}</Text>
            <Text style={styles.heroText}>
              Connected with the same ERP backend and database used by the web portal.
            </Text>
          </View>
        </View>

        {title === "Notices" && unreadIds.length > 0 && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleMarkRead} disabled={acting}>
            <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Mark All Read</Text>
          </TouchableOpacity>
        )}

        {error ? (
          <StateCard icon="warning-outline" title="Unable to load module" text={error} />
        ) : loading && !rows.length ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#4F46E5" size="large" />
            <Text style={styles.loadingText}>Loading live ERP data...</Text>
          </View>
        ) : rows.length ? (
          rows.map((row, index) => (
            <DataCard
              key={row.id || row.username || row.admissionNumber || row.title || index}
              row={row}
              index={index}
              title={title}
              onParticipate={handleParticipate}
              acting={acting}
            />
          ))
        ) : (
          <StateCard
            icon="file-tray-outline"
            title="No records yet"
            text="This module is connected, but the ERP database does not have records for this account or role yet."
          />
        )}

        {title === "Vault" && rawPayload?.usage && (
          <UsageCard usage={rawPayload.usage} />
        )}
      </ScrollView>
    </View>
  );
}

function DataCard({ row, index, title, onParticipate, acting }) {
  const details = getDetails(row);
  const canParticipate = title === "Events" && row.participationEnabled && row.id;

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{getTitle(row, `${title} record`)}</Text>
          <Text style={styles.cardSubtitle}>{getSubtitle(row)}</Text>
        </View>
        {row.unread && <View style={styles.unreadDot} />}
      </View>

      {details.length > 0 && (
        <View style={styles.detailBox}>
          {details.map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailKey}>{humanizeKey(key)}</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {valueToText(value)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {canParticipate && (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onParticipate(row)} disabled={acting}>
          <Ionicons name="person-add-outline" size={18} color="#4F46E5" />
          <Text style={styles.secondaryButtonText}>Participate</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function UsageCard({ usage }) {
  const usedMb = (Number(usage.totalBytes || 0) / (1024 * 1024)).toFixed(2);
  const limitMb = (Number(usage.storageLimitBytes || 0) / (1024 * 1024)).toFixed(0);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Vault Storage</Text>
      <Text style={styles.cardSubtitle}>{usedMb} MB used of {limitMb} MB</Text>
    </View>
  );
}

function StateCard({ icon, title, text }) {
  return (
    <View style={styles.stateCard}>
      <Ionicons name={icon} size={58} color="#4F46E5" />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

const styles = {
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  heroTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },
  heroText: {
    color: "#64748B",
    lineHeight: 20,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    elevation: 2,
  },
  indexBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  indexText: {
    color: "#4F46E5",
    fontWeight: "900",
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
  },
  cardSubtitle: {
    color: "#64748B",
    lineHeight: 20,
    marginTop: 5,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
    marginTop: 4,
  },
  detailBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  detailKey: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "900",
    width: 116,
  },
  detailValue: {
    color: "#0F172A",
    flex: 1,
    fontWeight: "700",
    textAlign: "right",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#4F46E5",
    fontWeight: "900",
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  loadingText: {
    color: "#64748B",
    marginTop: 12,
    fontWeight: "800",
  },
  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    elevation: 2,
  },
  stateTitle: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  stateText: {
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
  },
};
