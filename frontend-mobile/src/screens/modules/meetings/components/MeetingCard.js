import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import GlassCard from "../../../../shared/components/GlassCard";
import { gradients, glassColors } from "../../../../shared/theme/glass";

const SCOPE_LABELS = {
  class: "Class",
  staff: "Staff",
  school: "Whole School",
};

function scopeText(meeting) {
  const label = SCOPE_LABELS[meeting.scopeType] || meeting.scopeType || "Meeting";
  if (meeting.scopeType === "class" && meeting.targetClasses?.length) {
    return `${label} • ${meeting.targetClasses.join(", ")}`;
  }
  return label;
}

function formatDateTime(meeting) {
  const parts = [meeting.date, meeting.time].filter(Boolean);
  return parts.join(" • ") || "Schedule not set";
}

export default function MeetingCard({ meeting, user, onJoin, onEnd, joining = false, ending = false }) {
  const isOngoing = meeting.status === "ongoing";
  const isHost =
    user?.role === "admin" ||
    user?.role === "clerk" ||
    (user?.role === "teacher" && meeting.hostUsername === user.username);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {meeting.title}
            </Text>
            <Text style={styles.host}>Hosted by {meeting.hostName || meeting.hostUsername}</Text>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isOngoing ? `${glassColors.success}1f` : `${glassColors.inkFaint}1f`,
                borderColor: isOngoing ? `${glassColors.success}40` : `${glassColors.inkFaint}40`,
              },
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: isOngoing ? glassColors.success : glassColors.inkFaint }]} />
            <Text style={[styles.badgeText, { color: isOngoing ? glassColors.success : glassColors.inkSoft }]}>
              {isOngoing ? "Ongoing" : "Ended"}
            </Text>
          </View>
        </View>

        {!!meeting.description && (
          <Text style={styles.description} numberOfLines={3}>
            {meeting.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={15} color={glassColors.inkSoft} />
          <Text style={styles.metaText}>{formatDateTime(meeting)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={15} color={glassColors.inkSoft} />
          <Text style={styles.metaText}>{scopeText(meeting)}</Text>
        </View>

        <View style={styles.actionRow}>
          {isOngoing && (
            <TouchableOpacity
              style={[styles.primaryButtonWrap, joining && styles.buttonDisabled]}
              onPress={() => onJoin?.(meeting)}
              disabled={joining}
              activeOpacity={0.85}
            >
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                <Ionicons name="videocam-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>{joining ? "Joining..." : "Join"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isOngoing && isHost && (
            <TouchableOpacity
              style={[styles.dangerButton, ending && styles.buttonDisabled]}
              onPress={() => onEnd?.(meeting)}
              disabled={ending}
            >
              <Ionicons name="stop-circle-outline" size={18} color={glassColors.danger} />
              <Text style={styles.dangerButtonText}>{ending ? "Ending..." : "End"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </GlassCard>
  );
}

export async function openJitsiRoom(roomName) {
  if (!roomName) return;
  const url = `https://meet.jit.si/${roomName}`;
  await Linking.openURL(url);
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  inner: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
  },
  host: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: glassColors.inkSoft,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: glassColors.inkSoft,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  metaText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: glassColors.inkSoft,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  primaryButtonWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  dangerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: `${glassColors.danger}14`,
    borderWidth: 1,
    borderColor: `${glassColors.danger}40`,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dangerButtonText: {
    color: glassColors.danger,
    fontWeight: "900",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
