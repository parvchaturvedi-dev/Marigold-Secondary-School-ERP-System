import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiRequest } from "../../../api/apiClient";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import PageHeader from "../../../shared/components/PageHeader";
import { glassColors } from "../../../shared/theme/glass";
import MeetingCard, { openJitsiRoom } from "./components/MeetingCard";
import CreateMeetingForm from "./components/CreateMeetingForm";

function getActiveStudentProfile(user = {}) {
  return (
    user.activeStudent ||
    (Array.isArray(user.studentProfiles) ? user.studentProfiles[0] : null) ||
    {}
  );
}

function getAllottedClasses(user = {}) {
  const raw = user.allottedClasses || user.teacherProfile?.allottedClasses || [];
  return Array.isArray(raw) ? raw : [];
}

export default function MeetingsScreen({ rows, user, reload }) {
  const [meetings, setMeetings] = useState(Array.isArray(rows) ? rows : []);
  const [loading, setLoading] = useState(!Array.isArray(rows));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState(null);
  const [endingId, setEndingId] = useState(null);
  const [creating, setCreating] = useState(false);

  const canHost = user?.role !== "student";
  const student = getActiveStudentProfile(user);
  const allottedClasses = getAllottedClasses(user);

  const fetchMeetings = useCallback(async () => {
    const data = await apiRequest("/meetings");
    return Array.isArray(data) ? data : [];
  }, []);

  const localRefetch = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const data = await fetchMeetings();
      setMeetings(data);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load meetings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMeetings]);

  useEffect(() => {
    if (Array.isArray(rows)) {
      setMeetings(rows);
      setLoading(false);
      return;
    }
    localRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  async function refreshAfterMutation() {
    if (typeof reload === "function") {
      await reload();
    } else {
      await localRefetch(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    if (typeof reload === "function") {
      await reload();
      setRefreshing(false);
    } else {
      await localRefetch(false);
    }
  }

  async function handleJoin(meeting) {
    if (!meeting?.id) return;
    setJoiningId(meeting.id);
    try {
      if (user?.role === "student") {
        await apiRequest(`/meetings/${meeting.id}/attendance`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "present",
            entry: {
              studentId: student.admissionNumber || student.id || user.username,
              studentName: student.displayName || user.displayName || user.name || user.username,
              className: student.className || "",
              section: student.section || "",
              status: "present",
            },
          }),
        });
        await refreshAfterMutation();
      }
      await openJitsiRoom(meeting.roomName);
    } catch (joinError) {
      Alert.alert("Meetings", joinError.message || "Unable to join this meeting.");
    } finally {
      setJoiningId(null);
    }
  }

  async function handleEnd(meeting) {
    if (!meeting?.id) return;
    setEndingId(meeting.id);
    try {
      await apiRequest(`/meetings/${meeting.id}/end`, { method: "PATCH" });
      await refreshAfterMutation();
    } catch (endError) {
      Alert.alert("Meetings", endError.message || "Unable to end this meeting.");
    } finally {
      setEndingId(null);
    }
  }

  async function handleCreate(payload) {
    setCreating(true);
    try {
      await apiRequest("/meetings", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          allottedClasses: user?.role === "teacher" ? allottedClasses : payload.allottedClasses,
        }),
      });
      await refreshAfterMutation();
      return true;
    } catch (createError) {
      Alert.alert("Meetings", createError.message || "Unable to schedule this meeting.");
      return false;
    } finally {
      setCreating(false);
    }
  }

  const ongoingCount = meetings.filter((meeting) => meeting.status === "ongoing").length;

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title="Meetings" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={glassColors.accent} />}
      >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroInner}>
          <View style={styles.heroIcon}>
            <Ionicons name="videocam-outline" size={26} color={glassColors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {ongoingCount > 0 ? `${ongoingCount} meeting${ongoingCount === 1 ? "" : "s"} live now` : "No live meetings"}
            </Text>
            <Text style={styles.heroSubtitle}>Join Jitsi meetings scoped to your class or the whole school.</Text>
          </View>
        </View>
      </GlassCard>

      {canHost && (
        <CreateMeetingForm user={user} allottedClasses={allottedClasses} onCreate={handleCreate} creating={creating} />
      )}

      {error ? (
        <StateCard icon="warning-outline" title="Unable to load meetings" text={error} />
      ) : loading && !meetings.length ? (
        <GlassCard style={styles.loadingCard}>
          <View style={styles.loadingCardInner}>
            <ActivityIndicator color={glassColors.accent} size="large" />
            <Text style={styles.loadingText}>Loading meetings...</Text>
          </View>
        </GlassCard>
      ) : meetings.length ? (
        meetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            user={user}
            onJoin={handleJoin}
            onEnd={handleEnd}
            joining={joiningId === meeting.id}
            ending={endingId === meeting.id}
          />
        ))
      ) : (
        <StateCard
          icon="calendar-outline"
          title="No meetings yet"
          text={canHost ? "Schedule a meeting above to get started." : "Your teachers or school admin haven't scheduled any meetings yet."}
        />
      )}
      </ScrollView>
    </View>
  );
}

function StateCard({ icon, title, text }) {
  return (
    <GlassCard style={{ marginTop: 4 }}>
      <View style={styles.stateInner}>
        <Ionicons name={icon} size={48} color={glassColors.accent} />
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateText}>{text}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    marginBottom: 16,
  },
  heroInner: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: `${glassColors.accent}1a`,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    color: glassColors.inkSoft,
    fontWeight: "600",
    lineHeight: 18,
  },
  loadingCard: {
    minHeight: 180,
  },
  loadingCardInner: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: glassColors.inkSoft,
    fontWeight: "700",
  },
  stateInner: {
    padding: 28,
    alignItems: "center",
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "900",
    color: glassColors.ink,
    textAlign: "center",
  },
  stateText: {
    marginTop: 8,
    fontSize: 13,
    color: glassColors.inkSoft,
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "600",
  },
});
