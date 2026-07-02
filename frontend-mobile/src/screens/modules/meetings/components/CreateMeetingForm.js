import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

const SCOPE_OPTIONS = [
  { key: "class", label: "My Class(es)" },
  { key: "all", label: "Whole School" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const nowHm = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function suggestRoomName(title) {
  const base = slugify(title) || "mgps-meeting";
  return `mgps-${base}-${Date.now().toString(36)}`;
}

export default function CreateMeetingForm({ user, allottedClasses = [], onCreate, creating = false }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(nowHm());
  const [roomName, setRoomName] = useState("");
  const [scope, setScope] = useState("class");
  const [targetClasses, setTargetClasses] = useState(allottedClasses.length === 1 ? allottedClasses[0] : "");

  const isPrivileged = user?.role === "admin" || user?.role === "clerk";
  const scopeOptions = useMemo(() => {
    if (isPrivileged) return SCOPE_OPTIONS;
    return SCOPE_OPTIONS.filter((option) => option.key === "class");
  }, [isPrivileged]);

  const canSubmit =
    title.trim() &&
    date.trim() &&
    time.trim() &&
    (scope === "all" || String(targetClasses).trim().length > 0);

  function resetForm() {
    setTitle("");
    setDescription("");
    setDate(todayIso());
    setTime(nowHm());
    setRoomName("");
    setScope("class");
    setTargetClasses(allottedClasses.length === 1 ? allottedClasses[0] : "");
  }

  async function handleSubmit() {
    if (!canSubmit || creating) return;

    const classesList =
      scope === "all"
        ? []
        : String(targetClasses)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      scopeType: scope === "all" ? "school" : "class",
      targetClasses: classesList,
      date,
      time,
      roomName: roomName.trim() || suggestRoomName(title),
      hostName: user?.displayName || user?.name || user?.username,
      allottedClasses,
    };

    const ok = await onCreate?.(payload);
    if (ok !== false) {
      resetForm();
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <TouchableOpacity style={styles.openButton} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.openButtonText}>Schedule a Meeting</Text>
      </TouchableOpacity>
    );
  }

  return (
    <GlassCard style={{ marginBottom: 16 }}>
      <View style={styles.formInner}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>New Meeting</Text>
          <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={glassColors.inkSoft} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Meeting title"
          placeholderTextColor={glassColors.inkFaint}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={glassColors.inkFaint}
          multiline
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={glassColors.inkFaint}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            placeholderTextColor={glassColors.inkFaint}
          />
        </View>

        <TextInput
          style={styles.input}
          value={roomName}
          onChangeText={setRoomName}
          placeholder="Jitsi room name (auto-generated if blank)"
          placeholderTextColor={glassColors.inkFaint}
          autoCapitalize="none"
        />

        {scopeOptions.length > 1 && (
          <View style={styles.pillRow}>
            {scopeOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.pill, scope === option.key && styles.pillActive]}
                onPress={() => setScope(option.key)}
              >
                <Text style={[styles.pillText, scope === option.key && styles.pillTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {scope === "class" && (
          <TextInput
            style={styles.input}
            value={targetClasses}
            onChangeText={setTargetClasses}
            placeholder="Target classes, e.g. Class 8, Class 9"
            placeholderTextColor={glassColors.inkFaint}
          />
        )}

        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || creating) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || creating}
        >
          <Ionicons name="videocam-outline" size={18} color="#fff" />
          <Text style={styles.submitButtonText}>{creating ? "Starting..." : "Start Meeting"}</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  openButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: glassColors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  openButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  formInner: {
    padding: 16,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glassColors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 12,
    marginBottom: 10,
    color: glassColors.ink,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: glassColors.cardBorder,
  },
  pillActive: {
    backgroundColor: glassColors.accent,
    borderColor: glassColors.accent,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
    color: glassColors.inkSoft,
  },
  pillTextActive: {
    color: "#fff",
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: glassColors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
