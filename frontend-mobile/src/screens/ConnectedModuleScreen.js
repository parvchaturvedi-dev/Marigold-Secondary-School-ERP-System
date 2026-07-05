import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/cards/PageHeader";
import AuroraBackground from "../shared/components/AuroraBackground";
import GlassCard from "../shared/components/GlassCard";
import { useTheme } from "../theme/ThemeContext";
import { gradients, glassColors } from "../shared/theme/glass";
import { colors } from "../shared/theme/colors";
import {
  adminActionApplication,
  adminActionLeaveRequest,
  createAssignment,
  createApplication,
  createEvent,
  createLeaveRequest,
  deleteEvent,
  fetchModuleState,
  fetchModuleData,
  markApplicationReplyRead,
  markNotificationsRead,
  participateInEvent,
  saveModuleState,
  teacherActionLeaveRequest,
  voteOnApplication,
} from "../api/moduleApi";
import { apiRequest } from "../api/apiClient";
import { DateField, LoadingCard, MultiSelect, Select, Toggle } from "./modules/shared/formKit";
import { getActiveStudentProfile, getStaffProfile, getTeacherProfile } from "../shared/profile";
import FeesScreen from "./modules/fees/FeesScreen";
import ExaminationsScreen from "./modules/examinations/ExaminationsScreen";
import MeetingsScreen from "./modules/meetings/MeetingsScreen";
import { resolveModuleScreen } from "./modules/registry";
import { exportIdCardPdf, exportManyIdCards } from "./modules/idcard/exportIdCard";

// Module titles whose bespoke screen already renders its own PageHeader — these
// must NOT be wrapped again, or the back/home bar would be duplicated.
// Almost every module screen renders its OWN header (via formKit's ScreenShell,
// which includes AuroraBackground + PageHeader, or a direct PageHeader). Only a
// few bare screens have no header of their own and need to be wrapped — listing
// THOSE is far less error-prone than trying to list every self-headed screen
// (wrapping a self-headed screen produces a duplicate back/home header).
const NEEDS_WRAPPER = new Set(["Certification", "About Us"]);

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
  // Raw usernames / role-ids: never surface these in the generic detail rows.
  // The human name (createdByName / authorName / senderName) is shown instead.
  "createdByUsername",
  "senderUsername",
  "recipientUsername",
  "adminUsername",
  "actorUsername",
  "applicantUsername",
  "teacherUsername",
  "senderIdentityId",
  "recipientStudentId",
  // Used for tap-to-navigate on notifications; not a human-facing detail row.
  "linkPage",
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
const canCreateAssignment = (user) => ["admin", "clerk", "teacher"].includes(user?.role);
const activeIdentity = (user = {}) => getActiveStudentProfile(user) || {};
const STUDENTS_NAMESPACE = "admin-student-management-students";
const TEACHERS_NAMESPACE = "admin-teacher-management-list";
const CLASSES_NAMESPACE = "admin-class-management-classes";

async function pickStoredFile(types = ["image/*", "application/pdf"]) {
  const result = await DocumentPicker.getDocumentAsync({
    type: types,
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
  const mimeType = asset.mimeType || "application/octet-stream";
  return {
    uri: asset.uri,
    file: asset.name || "document",
    name: asset.name || "document",
    size: asset.size || 0,
    type: mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
    uploadedAt: new Date().toISOString(),
    status: "Uploaded",
  };
}

function normalizeStudentCardRecord(student = {}, index = 0) {
  const raw = student.rawProfile || {};
  const id = student.admissionNumber || student.id || raw.admissionNumber || `STD-${index + 1}`;
  return {
    type: "student",
    id,
    displayName: student.displayName || student.name || raw.studentName || `Student ${index + 1}`,
    roleLabel: "Student",
    primaryLine: [student.className || student.class || raw.targetClass, student.section || raw.section].filter(Boolean).join("-"),
    photoDataUrl: student.photoDataUrl || raw.photoDataUrl || "",
    frontFields: [
      ["NAME", student.displayName || student.name || raw.studentName],
      ["ADM NO.", id],
      ["FATHER NAME", student.fatherName || raw.fatherName],
      ["MOTHER NAME", student.motherName || raw.motherName],
      ["MOBILE NUMBER", student.guardianPhone || student.mobile || raw.guardianMobile || raw.mobileNo],
      ["GENDER", student.gender || raw.gender],
      ["CATEGORY", student.category || raw.category],
    ],
    backFields: [
      ["Class :", student.className || student.class || raw.targetClass],
      ["Section :", student.section || raw.section],
      ["Roll No :", student.rollNo || raw.rollNo],
      ["DOB :", student.dob || raw.dob],
      ["Religion :", student.religion || raw.religion],
      ["PEN Number :", student.penNumber || raw.penNumber],
      ["Email :", student.guardianEmail || student.email || raw.email],
      ["Permanent Address :", raw.permAddress || student.address],
    ],
  };
}

function normalizeStaffCardRecord(person = {}, role = "staff", index = 0) {
  const source = person.teacherProfile || person.clerkProfile || person.profile?.teacherProfile || person.profile?.clerkProfile || person;
  const id = person.username || source.id || source.empId || `${role.toUpperCase()}-${index + 1}`;
  const designation = source.designation || source.role || (role === "admin" ? "Administrator" : role);
  return {
    type: role,
    id,
    displayName: person.displayName || source.displayName || source.name || id,
    roleLabel: role.replace(/^\w/, (char) => char.toUpperCase()),
    primaryLine: designation,
    photoDataUrl: person.photoDataUrl || person.profile?.photoDataUrl || source.photoDataUrl || "",
    frontFields: [
      ["NAME", person.displayName || source.displayName || source.name || id],
      ["EMP ID", id],
      ["ROLE", designation],
      ["DEPARTMENT", source.department || (role === "admin" ? "Administration" : "Office")],
      ["MOBILE NUMBER", source.mobile || source.phone || person.mobile],
      ["EMAIL", source.email || person.email],
      ["GENDER", source.gender],
    ],
    backFields: [
      ["Username :", id],
      ["Designation :", designation],
      ["Joining Date :", source.joiningDate || source.dateOfJoining],
      ["DOB :", source.dob],
      ["Aadhaar :", source.aadharNumber || source.aadhaar],
      ["Allotted Classes :", Array.isArray(person.allottedClasses) ? person.allottedClasses.join(", ") : source.assignedClassTeacherFor],
      ["Status :", person.isActive === false ? "Inactive" : "Active"],
    ],
  };
}

function getDefaultAssignmentTargets(user = {}) {
  const teacherProfile = getTeacherProfile(user);
  const classes = Array.isArray(user.allottedClasses) && user.allottedClasses.length
    ? user.allottedClasses
    : teacherProfile.allottedClasses || [];
  return user.role === "teacher" ? classes.slice(0, 1).join(", ") : "";
}

function initialForm(title, user = {}) {
  if (title === "Application") {
    return { title: "", category: APPLICATION_CATEGORIES[0], kind: "simple", audienceMode: "individual", message: "" };
  }
  if (title === "Leave Requests") {
    return { title: "", description: "", leaveMode: "single", startDate: todayIsoDate(), endDate: todayIsoDate() };
  }
  if (title === "Assignment" || title === "Assignments") {
    return { title: "", description: "", subject: "", targetClasses: getDefaultAssignmentTargets(user), checkingDate: todayIsoDate(), attachment: null };
  }
  if (title === "Events") {
    return {
      title: "",
      description: "",
      durationType: "single",
      date: todayIsoDate(),
      fromDate: todayIsoDate(),
      toDate: todayIsoDate(),
      participationEnabled: false,
      participationOpensAt: "",
      participationClosesAt: "",
    };
  }
  if (title === "Notices") {
    return { title: "", description: "", category: "General", targetClasses: "ALL CLASSES" };
  }
  if (title === "Teacher Assignment") {
    return {
      name: "",
      email: "",
      mobile: "",
      gender: "",
      dob: "",
      category: "",
      address: "",
      aadharNumber: "",
      dateOfJoining: todayIsoDate(),
      className: "",
      subject: "",
      isClassTeacher: false,
      documentsAttached: [],
    };
  }
  return {};
}

export default function ConnectedModuleScreen() {
  const { palette } = useTheme();
  const { selectedModule, user, openNotificationTarget } = useAuth();
  const [rows, setRows] = useState([]);
  const [config, setConfig] = useState(null);
  const [rawPayload, setRawPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => initialForm(selectedModule, user));

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
    setForm(initialForm(title, user));
    load();
  }, [load, title, user]);

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
      } else if (title === "Assignment" || title === "Assignments") {
        const teacherProfile = getTeacherProfile(user);
        const staffProfile = getStaffProfile(user);
        const targetClasses = String(form.targetClasses || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        await createAssignment({
          title: form.title.trim(),
          description: form.description.trim(),
          subject: form.subject.trim() || "General",
          targetClasses,
          checkingDate: form.checkingDate,
          attachment: form.attachment,
          createdByRole: user.role,
          createdByUsername: user.username,
          createdByName: teacherProfile.displayName || staffProfile.displayName || user.displayName || user.name || user.username,
          actorRole: user.role,
          actorUsername: user.username,
          actorName: teacherProfile.displayName || staffProfile.displayName || user.displayName || user.name || user.username,
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
          participationOpensAt: form.participationOpensAt || "",
          participationClosesAt: form.participationClosesAt || "",
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
      } else if (title === "Teacher Assignment") {
        const currentTeachers = (await fetchModuleState(TEACHERS_NAMESPACE)) || [];
        const teacherId = `TCH-2026-${Math.floor(100 + Math.random() * 900)}`;
        const finalRecord = {
          id: teacherId,
          empId: teacherId,
          name: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          gender: form.gender.trim(),
          dob: form.dob,
          category: form.category.trim(),
          address: form.address.trim(),
          aadharNumber: form.aadharNumber.trim(),
          dateOfJoining: form.dateOfJoining,
          classAssignments: form.className && form.subject ? [{ className: form.className, subject: form.subject }] : [],
          isClassTeacher: form.isClassTeacher ? "Yes" : "No",
          assignedClassTeacherFor: form.isClassTeacher ? form.className : "",
          documentsAttached: form.documentsAttached || [],
        };
        await saveModuleState(TEACHERS_NAMESPACE, [finalRecord, ...currentTeachers]);
        if (finalRecord.isClassTeacher === "Yes" && finalRecord.assignedClassTeacherFor) {
          const currentClasses = (await fetchModuleState(CLASSES_NAMESPACE)) || [];
          const hasClass = currentClasses.some((item) => item.name === finalRecord.assignedClassTeacherFor);
          const nextClasses = (hasClass ? currentClasses : [...currentClasses, { id: finalRecord.assignedClassTeacherFor, name: finalRecord.assignedClassTeacherFor }]).map((item) =>
            item.name === finalRecord.assignedClassTeacherFor
              ? { ...item, classTeacherId: teacherId, classTeacherName: finalRecord.name, teacher: finalRecord.name }
              : item
          );
          await saveModuleState(CLASSES_NAMESPACE, nextClasses);
        }
      }
      setForm(initialForm(title, user));
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

  const isApprover = user?.role === "admin" || user?.role === "clerk";
  const showForm =
    ((title === "Application" || title === "Leave Requests") && !isApprover) ||
    (canCreateAssignment(user) && (title === "Assignment" || title === "Assignments")) ||
    (canManage(user) && title === "Teacher Assignment") ||
    (canManage(user) && (title === "Events" || title === "Notices"));

  // Wrap only the few bare screens (NEEDS_WRAPPER) that have no header of their
  // own. Every other module screen already renders its own header via ScreenShell
  // / PageHeader — wrapping those would duplicate the back/home bar.
  const wrapWithHeader = (node) => (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title={title} />
      <View style={{ flex: 1 }}>{node}</View>
    </View>
  );

  const RegisteredScreen = resolveModuleScreen(title);
  if (RegisteredScreen) {
    const node = <RegisteredScreen user={user} />;
    return NEEDS_WRAPPER.has(title) ? wrapWithHeader(node) : node;
  }

  if (title === "Fees") {
    return wrapWithHeader(<FeesScreen user={user} />);
  }
  if (title === "Examinations" || title === "Marks Management") {
    return <ExaminationsScreen user={user} />;
  }
  if (title === "Meetings") {
    return <MeetingsScreen user={user} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title={title} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={glassColors.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
      >
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroCardInner}>
            <LinearGradient colors={gradients.chip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
              <Ionicons name={title === "Notifications" ? "notifications-outline" : "apps-outline"} size={28} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: palette.ink }]}>{getCountLabel(title, rows)}</Text>
              <Text style={[styles.heroText, { color: palette.inkSoft }]}>Review and manage the latest records for your account.</Text>
            </View>
          </View>
        </GlassCard>

        {showForm && (
          <ActionForm title={title} form={form} updateForm={updateForm} onSubmit={submitForm} acting={acting} user={user} />
        )}

        {title === "Notifications" && unreadIds.length > 0 && (
          <PrimaryButton icon="checkmark-done-outline" label="Mark All Read" onPress={handleMarkRead} disabled={acting} />
        )}

        {error ? (
          <StateCard icon="warning-outline" title="Unable to load module" text={error} />
        ) : loading && !rows.length ? (
          <LoadingCard text="Loading records..." />
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
              onOpenLink={openNotificationTarget}
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

function PrimaryButton({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={[styles.primaryButtonWrap, disabled && { opacity: 0.6 }]}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function DataCard({ row, index, title, onParticipate, onRowAction, onOpenLink, acting, user }) {
  const { palette } = useTheme();
  const details = getDetails(row);
  const student = title === "Events" ? (getActiveStudentProfile(user) || {}) : {};
  const myAdmission = String(student.admissionNumber || student.id || user?.username || "").toLowerCase();
  const hasParticipated =
    title === "Events" &&
    Array.isArray(row.participants) &&
    row.participants.some((p) => String(p?.admissionNumber || p?.username || "").toLowerCase() === myAdmission);
  // Server sends participationOpenNow when the schedule window is active. Fall
  // back to the legacy participationEnabled flag if the server hasn't upgraded.
  const participationOpen =
    row.participationOpenNow !== undefined ? Boolean(row.participationOpenNow) : Boolean(row.participationEnabled);
  const canParticipate = title === "Events" && participationOpen && row.id && !hasParticipated;
  const [expanded, setExpanded] = useState(false);
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const canDelete = canManage(user) && (title === "Events" || title === "Notices");
  const canLeaveTeacherAction =
    title === "Leave Requests" && isTeacher && ["pending_class_teacher", "forwarded_admin"].includes(row.status);
  const canLeaveAdminAction =
    title === "Leave Requests" && isAdmin && ["pending_admin", "forwarded_admin"].includes(row.status);
  const canApplicationAdminAction = title === "Application" && isAdmin && row.status === "pending";
  const canApplicationVote = title === "Application" && row.status === "collecting_consensus";
  // A notification row with a target page can be tapped to jump to that page.
  const isTappableNotification = title === "Notifications" && !!row.linkPage && typeof onOpenLink === "function";

  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardInner}>
      {title === "Events" && (
        <EventContent row={row} expanded={expanded} setExpanded={setExpanded} />
      )}
      {title !== "Events" && (
        <TouchableOpacity
          activeOpacity={isTappableNotification ? 0.7 : 1}
          disabled={!isTappableNotification}
          onPress={isTappableNotification ? () => onOpenLink(row.linkPage) : undefined}
        >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={[styles.indexBadge, { backgroundColor: palette.tile }]}>
          <Text style={[styles.indexText, { color: palette.accentDeep }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>{getTitle(row, `${title} record`)}</Text>
          <Text style={[styles.cardSubtitle, { color: palette.inkSoft }]}>{getSubtitle(row)}</Text>
        </View>
        {row.unread && <View style={styles.unreadDot} />}
        {isTappableNotification && (
          <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} style={{ marginLeft: 6, marginTop: 2 }} />
        )}
      </View>

      {details.length > 0 && (
        <View style={styles.detailBox}>
          {details.map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: palette.inkFaint }]}>{humanizeKey(key)}</Text>
              <Text style={[styles.detailValue, { color: palette.ink }]} numberOfLines={2}>
                {valueToText(value)}
              </Text>
            </View>
          ))}
        </View>
      )}
        </TouchableOpacity>
      )}

      {title === "Events" && hasParticipated && (
        <View style={[styles.secondaryButton, { backgroundColor: "rgba(16,185,129,0.14)" }]}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={[styles.secondaryButtonText, { color: "#047857" }]}>Participated</Text>
        </View>
      )}
      {title === "Events" && !participationOpen && !hasParticipated && (
        <View style={[styles.secondaryButton, { backgroundColor: "rgba(148,163,184,0.18)" }]}>
          <Ionicons name="lock-closed-outline" size={18} color="#475569" />
          <Text style={[styles.secondaryButtonText, { color: "#475569" }]}>Participation closed</Text>
        </View>
      )}
      {canParticipate && (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onParticipate(row)} disabled={acting}>
          <Ionicons name="person-add-outline" size={18} color={colors.primary} />
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
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: `${glassColors.danger}14` }]} onPress={() => onRowAction(row, "delete")} disabled={acting}>
          <Ionicons name="trash-outline" size={18} color={glassColors.danger} />
          <Text style={[styles.secondaryButtonText, { color: glassColors.danger }]}>Delete</Text>
        </TouchableOpacity>
      )}
      </View>
    </GlassCard>
  );
}

function EventContent({ row, expanded, setExpanded }) {
  const { palette } = useTheme();
  const description = valueToText(row.description);
  const shouldCompress = description.length > 140;
  const visibleDescription = shouldCompress && !expanded ? `${description.slice(0, 140)}...` : description;
  return (
    <View>
      <Text style={[styles.cardTitle, { color: palette.ink }]}>{row.title || "Event"}</Text>
      {!!description && (
        <Text style={[styles.eventDescription, { color: palette.inkSoft }]}>
          {visibleDescription}
        </Text>
      )}
      {shouldCompress && (
        <TouchableOpacity onPress={() => setExpanded((value) => !value)}>
          <Text style={[styles.readMoreText, { color: palette.accentDeep }]}>{expanded ? "Show less" : "Read more"}</Text>
        </TouchableOpacity>
      )}
      {!!row.imageDataUrl && (
        <Image source={{ uri: row.imageDataUrl }} style={styles.eventImage} resizeMode="cover" />
      )}
      <Text style={[styles.cardSubtitle, { color: palette.inkSoft }]}>
        {[row.durationType === "multiple" ? `${row.fromDate} to ${row.toDate}` : row.date, row.participationEnabled ? "Participation open" : ""].filter(Boolean).join(" | ")}
      </Text>
    </View>
  );
}

const ALL_CLASSES_OPTION = "ALL CLASSES";
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const CATEGORY_OPTIONS = ["General", "OBC", "SC", "ST", "EWS"];
// Application-type options — kept in sync with the web portal (applicationStore.js).
const APPLICATION_CATEGORIES = [
  "General Problem",
  "Infrastructure Problem",
  "Violence / Safety Concern",
  "Event / Farewell",
  "Resource Request",
  "Discipline Concern",
  "Other",
];

function ActionForm({ title, form, updateForm, onSubmit, acting, user }) {
  const { palette } = useTheme();
  const isAssignment = title === "Assignment" || title === "Assignments";
  const isTeacherForm = title === "Teacher Assignment";
  const needsClassList = title === "Notices" || isAssignment || isTeacherForm;
  const needsSubjectList = isAssignment || isTeacherForm;
  const [classNames, setClassNames] = useState([]);
  const [subjectNames, setSubjectNames] = useState([]);

  useEffect(() => {
    if (!needsClassList) return;
    let active = true;
    (async () => {
      try {
        const payload = await apiRequest("/module-state/admin-class-management-classes");
        const value = payload?.value;
        const list = Array.isArray(value) ? value : value ? [value] : [];
        const names = list
          .map((item) => item?.name || item?.className || item?.class)
          .filter(Boolean);
        if (active) setClassNames([...new Set(names)]);
      } catch {
        if (active) setClassNames([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [needsClassList]);

  useEffect(() => {
    if (!needsSubjectList) return;
    let active = true;
    (async () => {
      try {
        const payload = await apiRequest("/module-state/admin-subjects-global");
        const value = payload?.value;
        const list = Array.isArray(value) ? value : value ? [value] : [];
        const names = list
          .map((item) => item?.name || item?.subject || item)
          .filter((n) => typeof n === "string" && n.trim());
        if (active) setSubjectNames([...new Set(names)]);
      } catch {
        if (active) setSubjectNames([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [needsSubjectList]);

  // targetClasses is stored as a comma string; convert to/from an array for MultiSelect
  // so the exact same payload still reaches the submit handlers.
  const targetClassValues = String(form.targetClasses || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const noticeClassOptions = [ALL_CLASSES_OPTION, ...classNames];
  const setTargetClasses = (nextArray) => updateForm("targetClasses", nextArray.join(", "));

  const disabled =
    title === "Teacher Assignment"
      ? !form.name?.trim() || !form.email?.trim() || !form.mobile?.trim()
      : title === "Assignment" || title === "Assignments"
      ? !form.title?.trim() || !form.description?.trim() || !form.checkingDate || !form.targetClasses?.trim()
      : !form.title?.trim() ||
        (!(title === "Application") && !form.description?.trim()) ||
        (title === "Application" && !form.message?.trim());

  async function pickTeacherDocument() {
    const file = await pickStoredFile();
    if (!file) return;
    updateForm("documentsAttached", [...(form.documentsAttached || []), file]);
  }

  async function pickAssignmentAttachment() {
    const file = await pickStoredFile(["image/*", "application/pdf", "video/*"]);
    if (!file) return;
    updateForm("attachment", file);
  }

  if (title === "Teacher Assignment") {
    return (
      <GlassCard style={styles.formCard}>
        <View style={styles.formCardInner}>
        <Text style={[styles.formTitle, { color: palette.ink }]}>Teacher Registration</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={(value) => updateForm("name", value)} placeholder="Teacher full name" />
        <TextInput style={styles.input} value={form.email} onChangeText={(value) => updateForm("email", value)} placeholder="Official email" />
        <TextInput style={styles.input} value={form.mobile} onChangeText={(value) => updateForm("mobile", value)} placeholder="Mobile" />
        <TextInput style={styles.input} value={form.aadharNumber} onChangeText={(value) => updateForm("aadharNumber", value)} placeholder="Aadhaar number" />
        <TextInput style={styles.input} value={form.address} onChangeText={(value) => updateForm("address", value)} placeholder="Address" />
        <Select label="Gender" value={form.gender} onChange={(value) => updateForm("gender", value)} options={GENDER_OPTIONS} placeholder="Select gender" />
        <Select label="Category" value={form.category} onChange={(value) => updateForm("category", value)} options={CATEGORY_OPTIONS} placeholder="Select category" />
        {classNames.length ? (
          <Select label="Class" value={form.className} onChange={(value) => updateForm("className", value)} options={classNames} placeholder="Select class" />
        ) : (
          <TextInput style={styles.input} value={form.className} onChangeText={(value) => updateForm("className", value)} placeholder="Class" placeholderTextColor={palette.inkFaint} />
        )}
        {subjectNames.length ? (
          <Select label="Subject" value={form.subject} onChange={(value) => updateForm("subject", value)} options={subjectNames} placeholder="Select subject" />
        ) : (
          <TextInput style={styles.input} value={form.subject} onChangeText={(value) => updateForm("subject", value)} placeholder="Subject" placeholderTextColor={palette.inkFaint} />
        )}
        <SmallButton label={form.isClassTeacher ? "Class Teacher: Yes" : "Class Teacher: No"} icon="school-outline" active={form.isClassTeacher} onPress={() => updateForm("isClassTeacher", !form.isClassTeacher)} />
        <TouchableOpacity style={styles.secondaryButton} onPress={pickTeacherDocument}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Upload Document</Text>
        </TouchableOpacity>
        {(form.documentsAttached || []).map((doc) => (
          <Text key={doc.uploadedAt} style={[styles.cardSubtitle, { color: palette.inkSoft }]}>{doc.file}</Text>
        ))}
        <PrimaryButton icon="save-outline" label="Save Teacher" onPress={onSubmit} disabled={disabled || acting} />
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.formCard}>
      <View style={styles.formCardInner}>
      <Text style={[styles.formTitle, { color: palette.ink }]}>
        {title === "Application" ? "New Application" : title === "Leave Requests" ? "New Leave Request" : title === "Events" ? "Create Event" : title === "Assignment" || title === "Assignments" ? "Issue Assignment" : "Publish Notice"}
      </Text>
      <TextInput style={styles.input} value={form.title} onChangeText={(value) => updateForm("title", value)} placeholder="Title" />
      {title === "Application" && (
        <Select label="Application Type" value={form.category} onChange={(value) => updateForm("category", value)} options={APPLICATION_CATEGORIES} placeholder="Select application type" />
      )}
      {title === "Notices" && (
        <TextInput style={styles.input} value={form.category} onChangeText={(value) => updateForm("category", value)} placeholder="Category" />
      )}
      {(title === "Assignment" || title === "Assignments") && (
        subjectNames.length ? (
          <Select label="Subject" value={form.subject} onChange={(value) => updateForm("subject", value)} options={subjectNames} placeholder="Select subject" />
        ) : (
          <TextInput style={styles.input} value={form.subject} onChangeText={(value) => updateForm("subject", value)} placeholder="Subject e.g. Mathematics" placeholderTextColor={palette.inkFaint} />
        )
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
          <View style={{ flex: 1 }}>
            <DateField label="From" value={form.startDate} onChange={(value) => updateForm("startDate", value)} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="To" value={form.endDate} onChange={(value) => updateForm("endDate", value)} />
          </View>
        </View>
      )}
      {(title === "Assignment" || title === "Assignments") && (
        <>
          <MultiSelect
            label="Target Classes"
            options={classNames}
            values={targetClassValues}
            onChange={setTargetClasses}
            hint="Select one or more classes for this assignment."
          />
          <DateField label="Checking Date" value={form.checkingDate} onChange={(value) => updateForm("checkingDate", value)} />
          <TouchableOpacity style={styles.secondaryButton} onPress={pickAssignmentAttachment}>
            <Ionicons name="attach-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{form.attachment?.name ? form.attachment.name : "Attach Image / Video / PDF"}</Text>
          </TouchableOpacity>
        </>
      )}
      {title === "Events" && (
        <>
          {form.durationType === "multiple" ? (
            <View style={styles.actionRow}>
              <View style={{ flex: 1 }}>
                <DateField label="From" value={form.fromDate} onChange={(value) => updateForm("fromDate", value)} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="To" value={form.toDate} onChange={(value) => updateForm("toDate", value)} />
              </View>
            </View>
          ) : (
            <DateField label="Event Date" value={form.date} onChange={(value) => updateForm("date", value)} />
          )}
          <Toggle
            label={form.participationEnabled ? "Participation OPEN" : "Participation CLOSED"}
            value={form.participationEnabled}
            onValueChange={(value) => updateForm("participationEnabled", value)}
          />
          {form.participationEnabled && (
            <View style={styles.actionRow}>
              <View style={{ flex: 1 }}>
                <DateField label="Opens on (optional)" value={form.participationOpensAt} onChange={(v) => updateForm("participationOpensAt", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="Closes on (optional)" value={form.participationClosesAt} onChange={(v) => updateForm("participationClosesAt", v)} />
              </View>
            </View>
          )}
        </>
      )}
      {title === "Notices" && (
        <MultiSelect
          label="Target Classes"
          options={noticeClassOptions}
          values={targetClassValues}
          onChange={setTargetClasses}
          hint="Pick ALL CLASSES or specific classes."
        />
      )}
      <PrimaryButton icon="save-outline" label="Save" onPress={onSubmit} disabled={disabled || acting} />
      </View>
    </GlassCard>
  );
}

function ProfileCard({ user }) {
  const { palette } = useTheme();
  const originalProfile = user?.role === "teacher" ? getTeacherProfile(user) : user?.role === "student" ? activeIdentity(user) : getStaffProfile(user);
  const [profile, setProfile] = useState(originalProfile);
  const documents = profile.documents || profile.rawProfile?.documents || [];

  async function saveStudentPatch(patch) {
    if (user?.role !== "student") return;
    const students = (await fetchModuleState(STUDENTS_NAMESPACE)) || [];
    const studentId = profile.admissionNumber || profile.id;
    const nextStudents = students.map((student) => {
      const isMatch = student.admissionNumber === studentId || student.id === studentId;
      if (!isMatch) return student;
      return {
        ...student,
        ...patch,
        rawProfile: {
          ...(student.rawProfile || {}),
          ...patch.rawProfile,
        },
      };
    });
    await saveModuleState(STUDENTS_NAMESPACE, nextStudents);
    setProfile((current) => ({ ...current, ...patch, rawProfile: { ...(current.rawProfile || {}), ...patch.rawProfile } }));
  }

  async function uploadPhoto() {
    const file = await pickStoredFile(["image/*"]);
    if (!file) return;
    await saveStudentPatch({ photoDataUrl: file.dataUrl, rawProfile: { photoDataUrl: file.dataUrl } });
  }

  async function uploadDocument(existingName = "") {
    const file = await pickStoredFile();
    if (!file) return;
    const doc = {
      ...file,
      name: existingName || file.name || file.file,
      status: "Uploaded",
    };
    const nextDocuments = existingName
      ? documents.map((item) => (item.name === existingName ? doc : item))
      : [doc, ...documents];
    await saveStudentPatch({ documents: nextDocuments, rawProfile: { documents: nextDocuments } });
  }

  async function deleteDocument(name) {
    const nextDocuments = documents.filter((item) => item.name !== name);
    await saveStudentPatch({ documents: nextDocuments, rawProfile: { documents: nextDocuments } });
  }

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
    <GlassCard style={styles.card}>
      <View style={styles.cardInner}>
      <View style={styles.profileHeader}>
        <View style={[styles.profilePhoto, { backgroundColor: palette.tile }]}>
          {profile.photoDataUrl ? (
            <Image source={{ uri: profile.photoDataUrl }} style={styles.profilePhotoImage} />
          ) : (
            <Ionicons name="person" size={42} color={colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>{profile.displayName || user?.displayName || user?.username}</Text>
          <Text style={[styles.cardSubtitle, { color: palette.inkSoft }]}>{profile.className || profile.designation || user?.role}</Text>
        </View>
      </View>
      {user?.role === "student" && (
        <TouchableOpacity style={styles.secondaryButton} onPress={uploadPhoto}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Update Profile Photo</Text>
        </TouchableOpacity>
      )}
      <View style={styles.detailBox}>
        {rows.filter(([, value]) => value).map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: palette.inkFaint }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: palette.ink }]}>{String(value)}</Text>
          </View>
        ))}
      </View>
      {user?.role === "student" && (
        <View style={styles.detailBox}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.formTitle, { color: palette.ink }]}>Documents</Text>
            <TouchableOpacity onPress={() => uploadDocument()} style={[styles.iconButton, { backgroundColor: palette.tile }]}>
              <Ionicons name="add-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {documents.length ? documents.map((doc) => (
            <View key={`${doc.name}-${doc.uploadedAt}`} style={styles.documentRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.ink }]}>{doc.name}</Text>
                <Text style={[styles.cardSubtitle, { color: palette.inkSoft }]}>{doc.status || "Uploaded"} | {doc.file || "File saved"}</Text>
              </View>
              <TouchableOpacity onPress={() => uploadDocument(doc.name)} style={[styles.iconButton, { backgroundColor: palette.tile }]}>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteDocument(doc.name)} style={[styles.iconButton, { backgroundColor: `${glassColors.danger}14` }]}>
                <Ionicons name="trash-outline" size={18} color={glassColors.danger} />
              </TouchableOpacity>
            </View>
          )) : (
            <Text style={[styles.cardSubtitle, { color: palette.inkSoft }]}>No documents uploaded yet.</Text>
          )}
        </View>
      )}
      </View>
    </GlassCard>
  );
}

function IdCards({ user, rows = [] }) {
  const { palette } = useTheme();
  const cards = (user?.role === "admin" || user?.role === "clerk") && rows.length
    ? rows.flatMap((item) => {
        if (Array.isArray(item.linkedStudents) && item.linkedStudents.length) return item.linkedStudents.map(normalizeStudentCardRecord);
        return [normalizeStaffCardRecord(item, item.role || "staff")];
      })
    : user?.role === "student"
    ? (user.studentProfiles || [activeIdentity(user)]).filter(Boolean).map(normalizeStudentCardRecord)
    : [normalizeStaffCardRecord(user?.role === "teacher" ? getTeacherProfile(user) : getStaffProfile(user), user?.role)];

  const showExportAll = (user?.role === "admin" || user?.role === "clerk") && cards.length > 1;

  const handleExportCard = async (profile) => {
    try {
      await exportIdCardPdf(profile);
    } catch (error) {
      Alert.alert("Export failed", error?.message || "Could not export the ID card PDF.");
    }
  };

  const handleExportAll = async () => {
    try {
      await exportManyIdCards(cards);
    } catch (error) {
      Alert.alert("Export failed", error?.message || "Could not export the ID cards PDF.");
    }
  };

  return (
    <View>
      {showExportAll ? (
        <TouchableOpacity onPress={handleExportAll} style={[styles.smallButton, styles.idExportAllButton, { backgroundColor: palette.tile }]}>
          <Ionicons name="download-outline" size={16} color={palette.accentDeep} />
          <Text style={[styles.smallButtonText, { color: palette.accentDeep }]}>Export All ({cards.length})</Text>
        </TouchableOpacity>
      ) : null}
      {cards.map((profile, index) => (
        <View key={profile.id || index} style={styles.idPair}>
          <View style={styles.webIdFront}>
        <View style={styles.webIdLeft}>
          <Ionicons name="school" size={48} color="#fff" />
          <View style={styles.webIdPhoto}>
            {profile.photoDataUrl ? <Image source={{ uri: profile.photoDataUrl }} style={styles.webIdPhotoImage} /> : <Text style={styles.webIdInitials}>{String(profile.displayName || "ID").slice(0, 2).toUpperCase()}</Text>}
          </View>
        </View>
        <View style={styles.webIdMain}>
          <Text style={styles.webIdSchool}>MARIGOLD SECONDARY SCHOOL</Text>
          <Text style={styles.webIdTagline}>LEARN - GROW - SUCCEED</Text>
          <Text style={styles.webIdSession}>SESSION: 2026-27</Text>
          {profile.frontFields.filter(([, value]) => value).map(([label, value]) => (
            <View key={label} style={styles.webIdLine}>
              <Text style={styles.webIdLabel}>{label}</Text>
              <Text style={styles.webIdColon}>:</Text>
              <Text style={styles.webIdValue}>{String(value)}</Text>
            </View>
          ))}
          <View style={styles.webQrBox}><Text style={styles.webQrText}>QR</Text></View>
        </View>
        <Text style={styles.webIdFooter}>www.marigoldschoolbehror.com</Text>
      </View>
      <View style={styles.webIdBack}>
        <View style={styles.webIdBackHeader}>
          <Ionicons name="school" size={32} color="#08285f" />
          <View style={{ flex: 1 }}>
            <Text style={styles.webIdBackSchool}>MARIGOLD SECONDARY SCHOOL</Text>
            <Text style={styles.webIdBackSub}>{profile.roleLabel} Identity Details</Text>
          </View>
          <View style={[styles.webQrBox, { width: 54, height: 54 }]}><Text style={styles.webQrText}>QR</Text></View>
        </View>
        <View style={styles.webIdBackGrid}>
          {profile.backFields.filter(([, value]) => value).map(([label, value]) => (
            <View key={label} style={styles.webIdBackCell}>
              <Text style={styles.webIdBackLabel}>{label}</Text>
              <Text style={styles.webIdBackValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.webIdBackNote}>If found, please return this card to the school office. This card is ERP generated.</Text>
      </View>
          <TouchableOpacity onPress={() => handleExportCard(profile)} style={[styles.smallButton, styles.idExportButton, { backgroundColor: palette.tile }]}>
            <Ionicons name="share-outline" size={16} color={palette.accentDeep} />
            <Text style={[styles.smallButtonText, { color: palette.accentDeep }]}>Share / Export PDF</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function SmallButton({ label, icon, onPress, disabled, active }) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.smallButton, { backgroundColor: palette.tile }, active && { backgroundColor: colors.primaryDark }]}>
      <Ionicons name={icon} size={16} color={active ? "#fff" : colors.primary} />
      <Text style={[styles.smallButtonText, { color: palette.accentDeep }, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function UsageCard({ usage }) {
  const { palette } = useTheme();
  const usedMb = (Number(usage.totalBytes || 0) / (1024 * 1024)).toFixed(2);
  const limitMb = (Number(usage.storageLimitBytes || 0) / (1024 * 1024)).toFixed(0);
  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardInner}>
        <Text style={[styles.cardTitle, { color: palette.ink }]}>Vault Storage</Text>
        <Text style={[styles.cardSubtitle, { color: palette.inkSoft }]}>{usedMb} MB used of {limitMb} MB</Text>
      </View>
    </GlassCard>
  );
}

function StateCard({ icon, title, text }) {
  const { palette } = useTheme();
  return (
    <GlassCard style={styles.stateCard}>
      <View style={styles.stateCardInner}>
        <Ionicons name={icon} size={58} color={colors.primary} />
        <Text style={[styles.stateTitle, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.stateText, { color: palette.inkSoft }]}>{text}</Text>
      </View>
    </GlassCard>
  );
}

const styles = {
  heroCard: {
    borderRadius: 20,
    marginBottom: 14,
  },
  heroCardInner: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
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
    borderRadius: 20,
    marginBottom: 14,
  },
  cardInner: {
    padding: 16,
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
  eventDescription: {
    color: "#334155",
    lineHeight: 21,
    marginTop: 8,
    fontWeight: "700",
  },
  readMoreText: {
    color: "#4F46E5",
    fontWeight: "900",
    marginTop: 6,
  },
  eventImage: {
    width: "100%",
    height: 230,
    borderRadius: 18,
    marginTop: 14,
    backgroundColor: "#EEF2F7",
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
  primaryButtonWrap: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontWeight: "900",
  },
  formCard: {
    borderRadius: 20,
    marginBottom: 14,
  },
  formCardInner: {
    padding: 16,
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
    borderColor: glassColors.cardBorder,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: "#0F172A",
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.6)",
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profilePhoto: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#fff",
  },
  profilePhotoImage: {
    width: "100%",
    height: "100%",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
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
  idPair: { gap: 12, marginBottom: 20 },
  idExportButton: { marginTop: 4 },
  idExportAllButton: { marginBottom: 16, flexGrow: 0, alignSelf: "flex-start" },
  webIdFront: {
    minHeight: 224,
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D7DCE7",
    flexDirection: "row",
    elevation: 3,
  },
  webIdLeft: {
    width: 98,
    backgroundColor: "#08285f",
    alignItems: "center",
    paddingTop: 18,
    gap: 20,
  },
  webIdPhoto: {
    width: 74,
    height: 88,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#F4F8FF",
    backgroundColor: "#EAF2FB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  webIdPhotoImage: { width: "100%", height: "100%" },
  webIdInitials: { color: "#08285f", fontWeight: "900", fontSize: 24 },
  webIdMain: { flex: 1, padding: 14, paddingBottom: 34 },
  webIdSchool: { color: "#08285f", fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  webIdTagline: { color: "#174c9d", fontWeight: "900", fontSize: 9, letterSpacing: 2, marginTop: 4, marginBottom: 8 },
  webIdSession: { alignSelf: "flex-start", backgroundColor: "#08285f", color: "#fff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, fontWeight: "900", fontSize: 10, marginBottom: 8 },
  webIdLine: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
  webIdLabel: { width: 92, color: "#111", fontWeight: "900", fontSize: 10 },
  webIdColon: { color: "#111", fontWeight: "900", marginRight: 5 },
  webIdValue: { flex: 1, color: "#08285f", fontWeight: "900", fontSize: 11 },
  webQrBox: { width: 58, height: 58, borderRadius: 10, borderWidth: 2, borderColor: "#08285f", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", alignSelf: "flex-end", marginTop: -36 },
  webQrText: { color: "#08285f", fontWeight: "900", fontSize: 11 },
  webIdFooter: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#08285f", color: "#fff", textAlign: "center", paddingVertical: 8, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  webIdBack: { minHeight: 224, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#D7DCE7", padding: 14, overflow: "hidden", elevation: 3 },
  webIdBackHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 2, borderBottomColor: "#E7ECF5", paddingBottom: 10 },
  webIdBackSchool: { color: "#08285f", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  webIdBackSub: { color: "#174c9d", fontWeight: "900", fontSize: 9, marginTop: 2 },
  webIdBackGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  webIdBackCell: { width: "48%", borderBottomWidth: 1, borderBottomColor: "#EDF1F7", paddingBottom: 4 },
  webIdBackLabel: { color: "#5B6472", fontSize: 8, fontWeight: "900" },
  webIdBackValue: { color: "#111827", fontSize: 10, fontWeight: "900", marginTop: 2 },
  webIdBackNote: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#08285f", color: "#fff", textAlign: "center", padding: 8, fontWeight: "800", fontSize: 9 },
  stateCard: {
    borderRadius: 24,
  },
  stateCardInner: {
    padding: 28,
    alignItems: "center",
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
