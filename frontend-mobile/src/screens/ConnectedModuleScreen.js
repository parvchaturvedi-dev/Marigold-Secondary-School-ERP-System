import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/cards/PageHeader";
import {
  adminActionApplication,
  adminActionLeaveRequest,
  createApplication,
  createEvent,
  createLeaveRequest,
  deleteEvent,
  fetchModuleData,
  markApplicationReplyRead,
  markNotificationsRead,
  participateInEvent,
  saveModuleState,
  teacherActionLeaveRequest,
  voteOnApplication,
} from "../api/moduleApi";
import { getActiveStudentProfile, getStaffProfile, getTeacherProfile } from "../shared/profile";

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

const todayIsoDate = () => new Date().toISOString().slice(0, 10);
const canManage = (user) => user?.role === "admin" || user?.role === "clerk";
const activeIdentity = (user = {}) => getActiveStudentProfile(user) || {};

function initialForm(title) {
  if (title === "Application") {
    return { title: "", category: "General", kind: "simple", audienceMode: "individual", message: "" };
  }
  if (title === "Leave Requests") {
    return { title: "", description: "", leaveMode: "single", startDate: todayIsoDate(), endDate: todayIsoDate() };
  }
  if (title === "Events") {
    return { title: "", description: "", durationType: "single", date: todayIsoDate(), fromDate: todayIsoDate(), toDate: todayIsoDate(), participationEnabled: false };
  }
  if (title === "Notices") {
    return { title: "", description: "", category: "General", targetClasses: "ALL CLASSES" };
  }
  return {};
}

export default function ConnectedModuleScreen() {
  const { selectedModule, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [config, setConfig] = useState(null);
  const [rawPayload, setRawPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => initialForm(title));

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
    setForm(initialForm(title));
    load();
  }, [load, title]);

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

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submitForm() {
    setActing(true);
    try {
      if (title === "Application") {
        const student = activeIdentity(user);
        await createApplication({
          title: form.title.trim(),
          category: form.category || "General",
          kind: form.kind || "simple",
          message: form.message.trim(),
          senderRole: user.role,
          senderName: student.displayName || user.displayName || user.name || user.username,
          senderUsername: user.username,
          senderIdentityId: student.id || student.admissionNumber || "",
          senderIdentity: student.displayName || "",
          className: student.className || "",
          audienceMode: form.kind === "request" ? form.audienceMode : "individual",
          targetClassName: form.audienceMode === "all-class" ? student.className || "" : "",
          totalClassMembers: 40,
        });
      } else if (title === "Leave Requests") {
        const student = activeIdentity(user);
        const teacherProfile = getTeacherProfile(user);
        await createLeaveRequest({
          title: form.title.trim(),
          description: form.description.trim(),
          applicantRole: user.role,
          applicantName: student.displayName || teacherProfile.displayName || user.displayName || user.name || user.username,
          applicantUsername: user.username,
          applicantIdentityId: student.id || student.admissionNumber || "",
          applicantIdentity: student.displayName || "",
          className: student.className || teacherProfile.assignedClassTeacherFor || "",
          metaInfo: student.className || teacherProfile.designation || user.role,
          leaveMode: form.leaveMode,
          startDate: form.startDate,
          endDate: form.leaveMode === "single" ? form.startDate : form.endDate,
        });
      } else if (title === "Events") {
        await createEvent({
          title: form.title.trim(),
          description: form.description.trim(),
          durationType: form.durationType,
          date: form.date,
          fromDate: form.fromDate,
          toDate: form.toDate,
          participationEnabled: form.participationEnabled,
          createdByRole: user.role,
          createdByUsername: user.username,
        });
      } else if (title === "Notices") {
        const nextNotice = {
          id: `NTC-${Date.now()}`,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category || "General",
          date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          targetClasses: form.targetClasses.split(",").map((item) => item.trim()).filter(Boolean),
        };
        await saveModuleState(config.namespace, [nextNotice, ...rows]);
      }
      setForm(initialForm(title));
      await load();
      Alert.alert(title, "Saved successfully.");
    } catch (actionError) {
      Alert.alert(title, actionError.message);
    } finally {
      setActing(false);
    }
  }

  async function handleRowAction(row, action) {
    setActing(true);
    try {
      if (title === "Application") {
        if (action === "vote-in" || action === "vote-out") {
          const student = activeIdentity(user);
          await voteOnApplication(row.id, {
            username: student.id || user.username,
            name: student.displayName || user.name || user.username,
            decision: action === "vote-in" ? "in" : "out",
          });
        } else if (action === "reply" || action === "approved" || action === "rejected") {
          await adminActionApplication(row.id, {
            action: action === "reply" ? "replied" : action,
            reply: action === "reply" ? "Reviewed from mobile app." : "",
            adminUsername: user.username,
          });
        } else if (action === "read-reply") {
          await markApplicationReplyRead(row.id, user.username);
        }
      } else if (title === "Leave Requests") {
        if (action.startsWith("admin-")) {
          await adminActionLeaveRequest(row.id, {
            action: action.replace("admin-", ""),
            adminUsername: user.username,
          });
        } else {
          await teacherActionLeaveRequest(row.id, {
            action,
            teacherUsername: user.username,
          });
        }
      } else if (title === "Events" && action === "delete") {
        await deleteEvent(row.id);
      } else if (title === "Notices" && action === "delete") {
        await saveModuleState(config.namespace, rows.filter((item) => item.id !== row.id));
      }
      await load();
    } catch (actionError) {
      Alert.alert(title, actionError.message);
    } finally {
      setActing(false);
    }
  }

  const showForm =
    (title === "Application" || title === "Leave Requests") ||
    (canManage(user) && (title === "Events" || title === "Notices"));

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
      <PageHeader title={title} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name={title === "Notifications" ? "notifications-outline" : "apps-outline"} size={28} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{getCountLabel(title, rows)}</Text>
            <Text style={styles.heroText}>Review and manage the latest records for your account.</Text>
          </View>
        </View>

        {showForm && (
          <ActionForm title={title} form={form} updateForm={updateForm} onSubmit={submitForm} acting={acting} user={user} />
        )}

        {title === "Notifications" && unreadIds.length > 0 && (
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
            <Text style={styles.loadingText}>Loading records...</Text>
          </View>
        ) : title === "Profile" ? (
          <ProfileCard user={user} />
        ) : title === "ID Card" || title === "Id Card" ? (
          <IdCards user={user} rows={rows} />
        ) : rows.length ? (
          rows.map((row, index) => (
            <DataCard
              key={row.id || row.username || row.admissionNumber || row.title || index}
              row={row}
              index={index}
              title={title}
              onParticipate={handleParticipate}
              onRowAction={handleRowAction}
              acting={acting}
              user={user}
            />
          ))
        ) : (
          <StateCard
            icon="file-tray-outline"
            title="No records yet"
            text="No records are available for this account or role yet."
          />
        )}

        {title === "Vault" && rawPayload?.usage && (
          <UsageCard usage={rawPayload.usage} />
        )}
      </ScrollView>
    </View>
  );
}

function DataCard({ row, index, title, onParticipate, onRowAction, acting, user }) {
  const details = getDetails(row);
  const canParticipate = title === "Events" && row.participationEnabled && row.id;
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const canDelete = canManage(user) && (title === "Events" || title === "Notices");
  const canLeaveTeacherAction =
    title === "Leave Requests" && isTeacher && ["pending_class_teacher", "forwarded_admin"].includes(row.status);
  const canLeaveAdminAction =
    title === "Leave Requests" && isAdmin && ["pending_admin", "forwarded_admin"].includes(row.status);
  const canApplicationAdminAction = title === "Application" && isAdmin && row.status === "pending";
  const canApplicationVote = title === "Application" && row.status === "collecting_consensus";

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

      {canApplicationVote && (
        <View style={styles.actionRow}>
          <SmallButton label="Support" icon="thumbs-up-outline" onPress={() => onRowAction(row, "vote-in")} disabled={acting} />
          <SmallButton label="Decline" icon="thumbs-down-outline" onPress={() => onRowAction(row, "vote-out")} disabled={acting} />
        </View>
      )}

      {canApplicationAdminAction && (
        <View style={styles.actionRow}>
          <SmallButton label="Approve" icon="checkmark-outline" onPress={() => onRowAction(row, "approved")} disabled={acting} />
          <SmallButton label="Reject" icon="close-outline" onPress={() => onRowAction(row, "rejected")} disabled={acting} />
          <SmallButton label="Reply" icon="chatbox-ellipses-outline" onPress={() => onRowAction(row, "reply")} disabled={acting} />
        </View>
      )}

      {(canLeaveTeacherAction || canLeaveAdminAction) && (
        <View style={styles.actionRow}>
          <SmallButton label="Approve" icon="checkmark-outline" onPress={() => onRowAction(row, canLeaveAdminAction ? "admin-approve" : "approve")} disabled={acting} />
          <SmallButton label="Reject" icon="close-outline" onPress={() => onRowAction(row, canLeaveAdminAction ? "admin-reject" : "reject")} disabled={acting} />
          {canLeaveTeacherAction && (
            <SmallButton label="Forward" icon="arrow-forward-outline" onPress={() => onRowAction(row, "forward")} disabled={acting} />
          )}
        </View>
      )}

      {canDelete && (
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: "#FEF2F2" }]} onPress={() => onRowAction(row, "delete")} disabled={acting}>
          <Ionicons name="trash-outline" size={18} color="#DC2626" />
          <Text style={[styles.secondaryButtonText, { color: "#DC2626" }]}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ActionForm({ title, form, updateForm, onSubmit, acting, user }) {
  const disabled =
    !form.title?.trim() ||
    (!(title === "Application") && !form.description?.trim()) ||
    (title === "Application" && !form.message?.trim());

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>
        {title === "Application" ? "New Application" : title === "Leave Requests" ? "New Leave Request" : title === "Events" ? "Create Event" : "Publish Notice"}
      </Text>
      <TextInput style={styles.input} value={form.title} onChangeText={(value) => updateForm("title", value)} placeholder="Title" />
      {(title === "Application" || title === "Notices") && (
        <TextInput style={styles.input} value={form.category} onChangeText={(value) => updateForm("category", value)} placeholder="Category" />
      )}
      <TextInput
        style={[styles.input, styles.textArea]}
        value={title === "Application" ? form.message : form.description}
        onChangeText={(value) => updateForm(title === "Application" ? "message" : "description", value)}
        placeholder={title === "Application" ? "Application message" : "Description"}
        multiline
      />
      {title === "Application" && user?.role === "student" && (
        <View style={styles.actionRow}>
          <SmallButton label="Simple" icon="document-text-outline" active={form.kind === "simple"} onPress={() => updateForm("kind", "simple")} />
          <SmallButton label="Class Request" icon="people-outline" active={form.kind === "request"} onPress={() => {
            updateForm("kind", "request");
            updateForm("audienceMode", "all-class");
          }} />
        </View>
      )}
      {title === "Leave Requests" && (
        <View style={styles.actionRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={form.startDate} onChangeText={(value) => updateForm("startDate", value)} placeholder="From YYYY-MM-DD" />
          <TextInput style={[styles.input, { flex: 1 }]} value={form.endDate} onChangeText={(value) => updateForm("endDate", value)} placeholder="To YYYY-MM-DD" />
        </View>
      )}
      {title === "Events" && (
        <>
          <TextInput style={styles.input} value={form.date} onChangeText={(value) => updateForm("date", value)} placeholder="Event date YYYY-MM-DD" />
          <View style={styles.actionRow}>
            <SmallButton label={form.participationEnabled ? "Participation On" : "Participation Off"} icon="person-add-outline" active={form.participationEnabled} onPress={() => updateForm("participationEnabled", !form.participationEnabled)} />
          </View>
        </>
      )}
      {title === "Notices" && (
        <TextInput style={styles.input} value={form.targetClasses} onChangeText={(value) => updateForm("targetClasses", value)} placeholder="ALL CLASSES or Class 1, Class 2" />
      )}
      <TouchableOpacity style={[styles.primaryButton, disabled && { opacity: 0.45 }]} onPress={onSubmit} disabled={disabled || acting}>
        <Ionicons name="save-outline" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProfileCard({ user }) {
  const profile = user?.role === "teacher" ? getTeacherProfile(user) : user?.role === "student" ? activeIdentity(user) : getStaffProfile(user);
  const rows = user?.role === "student"
    ? [
        ["Name", profile.displayName],
        ["Admission ID", profile.admissionNumber || profile.id],
        ["Class", [profile.className, profile.section].filter(Boolean).join(" - ")],
        ["Roll No.", profile.rollNo],
        ["Father", profile.fatherName],
        ["Mother", profile.motherName],
        ["Guardian", profile.guardianName],
        ["Mobile", profile.guardianPhone],
        ["Email", profile.guardianEmail],
        ["DOB", profile.dob],
        ["Gender", profile.gender],
        ["Address", profile.address],
      ]
    : [
        ["Name", profile.displayName],
        ["Employee ID", profile.employeeId || profile.username],
        ["Designation", profile.designation],
        ["Department", profile.department],
        ["Mobile", profile.mobile],
        ["Email", profile.email],
        ["DOB", profile.dob],
        ["Gender", profile.gender],
        ["Address", profile.address],
        ["Class Teacher", profile.assignedClassTeacherFor],
        ["Allotted Classes", Array.isArray(profile.allottedClasses) ? profile.allottedClasses.join(", ") : ""],
        ["Shift", profile.shift],
        ["Desk Window", profile.deskWindow],
      ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{profile.displayName || user?.displayName || user?.username}</Text>
      <View style={styles.detailBox}>
        {rows.filter(([, value]) => value).map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={styles.detailKey}>{label}</Text>
            <Text style={styles.detailValue}>{String(value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function IdCards({ user, rows = [] }) {
  const cards = (user?.role === "admin" || user?.role === "clerk") && rows.length
    ? rows.flatMap((item) => {
        if (Array.isArray(item.linkedStudents) && item.linkedStudents.length) return item.linkedStudents;
        return [{
          displayName: item.displayName,
          username: item.username,
          employeeId: item.username,
          designation: item.role,
          mobile: item.profile?.mobile,
          email: item.email,
        }];
      })
    : user?.role === "student"
    ? (user.studentProfiles || [activeIdentity(user)]).filter(Boolean)
    : [user?.role === "teacher" ? getTeacherProfile(user) : getStaffProfile(user)];

  return cards.map((profile, index) => (
    <View key={profile.id || profile.employeeId || index} style={styles.idCard}>
      <View style={styles.idTop}>
        <Ionicons name="school-outline" size={28} color="#fff" />
        <Text style={styles.idSchool}>Marigold Secondary School</Text>
      </View>
      <View style={styles.idBody}>
        <View style={styles.photoBox}>
          <Ionicons name="person" size={52} color="#4F46E5" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.idName}>{profile.displayName || profile.name || user?.displayName}</Text>
          <Text style={styles.idMeta}>{profile.className ? `${profile.className} ${profile.section || ""}` : profile.designation || user?.role}</Text>
          <Text style={styles.idMeta}>ID: {profile.admissionNumber || profile.employeeId || profile.username || user?.username}</Text>
          <Text style={styles.idMeta}>Contact: {profile.guardianPhone || profile.mobile || "Not updated"}</Text>
        </View>
      </View>
    </View>
  ));
}

function SmallButton({ label, icon, onPress, disabled, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.smallButton, active && { backgroundColor: "#4F46E5" }]}>
      <Ionicons name={icon} size={16} color={active ? "#fff" : "#4F46E5"} />
      <Text style={[styles.smallButtonText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
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
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    elevation: 2,
  },
  formTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    marginBottom: 10,
    color: "#0F172A",
    fontWeight: "800",
    backgroundColor: "#F8FAFF",
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  smallButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  smallButtonText: {
    color: "#4F46E5",
    fontWeight: "900",
    fontSize: 12,
  },
  idCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#DDE7FF",
    elevation: 3,
  },
  idTop: {
    backgroundColor: "#102A83",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  idSchool: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  idBody: {
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  photoBox: {
    width: 82,
    height: 94,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  idName: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },
  idMeta: {
    color: "#475569",
    fontWeight: "800",
    marginTop: 5,
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
