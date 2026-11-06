import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import PageHeader from "../../../components/cards/PageHeader";
import { fetchModuleData, createAssignment } from "../../../api/moduleApi";
import { mediaUrl } from "../../../api/apiClient";
import { onRealtimeEvent } from "../../../notifications/realtime";
import { getActiveStudentProfile, getTeacherProfile } from "../../../shared/profile";
import { glassColors } from "../../../shared/theme/glass";
import { useTheme } from "../../../theme/ThemeContext";

const normalize = (value) => String(value || "").trim().toLowerCase();
const localDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayDateKey = () => localDateKey(new Date());
const formatDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};
const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};
const formatCheckingDate = (value) => {
  if (!value) return "Checking date not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? `Check by ${value}`
    : `Check by ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
};

function getTeacherRooms(user = {}) {
  const classAssignments = Array.isArray(getTeacherProfile(user).classAssignments)
    ? getTeacherProfile(user).classAssignments
    : [];
  const byClass = new Map();

  for (const assignment of classAssignments) {
    const className = String(assignment?.className || assignment?.class || "").trim();
    const subject = String(assignment?.subject || assignment?.subjectName || assignment?.paperSubject || "").trim();
    if (!className || !subject) continue;

    const key = normalize(className);
    const room = byClass.get(key) || { name: className, subjects: new Map() };
    room.subjects.set(normalize(subject), subject);
    byClass.set(key, room);
  }

  return [...byClass.values()]
    .map((room) => ({ ...room, subjects: [...room.subjects.values()] }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function getRoomsForStudent(user = {}, assignments = []) {
  const student = getActiveStudentProfile(user) || {};
  const className = String(student.className || "").trim();
  if (!className) return [];

  const subjects = [...new Set(
    assignments
      .filter((assignment) => assignment.targetClasses?.some((target) => normalize(target) === normalize(className)))
      .map((assignment) => String(assignment.subject || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  return [{ name: className, subjects }];
}

function MessageBubble({ item, own, onOpenAttachment, palette }) {
  const attachment = item.attachment;
  const isImage = attachment?.mimeType?.startsWith("image/");

  return (
    <View style={[styles.messageRow, own ? styles.messageRowOwn : styles.messageRowOther]}>
      <View style={[styles.messageBubble, own ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
        <Text style={[styles.sender, { color: own ? palette.accentDeep : palette.inkSoft }]}>
          {own ? "You" : item.createdByName || item.authorName || "Teacher"}
        </Text>
        {!!item.description && (
          <Text style={[styles.messageText, { color: palette.ink }]}>{item.description}</Text>
        )}
        {attachment?.url ? (
          <TouchableOpacity onPress={() => onOpenAttachment(attachment)} style={styles.attachment}>
            {isImage ? (
              <Image source={{ uri: mediaUrl(attachment.url) }} style={styles.attachmentImage} resizeMode="cover" />
            ) : (
              <View style={[styles.fileIcon, { backgroundColor: palette.tile }]}>
                <Ionicons name="document-text-outline" size={22} color={palette.accentDeep} />
              </View>
            )}
            <Text style={[styles.attachmentName, { color: palette.ink }]} numberOfLines={1}>
              {attachment.name || "Open attachment"}
            </Text>
            <Ionicons name="open-outline" size={16} color={palette.inkSoft} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.messageFooter}>
          <Text style={[styles.checkDate, { color: palette.inkSoft }]}>
            {formatCheckingDate(item.checkingDate)}
          </Text>
          <Text style={[styles.messageTime, { color: palette.inkSoft }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AssignmentsScreen({ user }) {
  const { palette } = useTheme();
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [checkingDate, setCheckingDate] = useState(todayDateKey());
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sending, setSending] = useState(false);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchModuleData("Assignment", user);
      setAssignments(data.rows);
    } catch (loadError) {
      setError(loadError.message || "Unable to load assignment history.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => onRealtimeEvent((event) => {
    if (event?.eventName === "mgps-erp-assignments-updated") loadAssignments();
  }), [loadAssignments]);

  const rooms = useMemo(
    () => isTeacher ? getTeacherRooms(user) : isStudent ? getRoomsForStudent(user, assignments) : [],
    [assignments, isStudent, isTeacher, user]
  );
  const currentRoom = rooms.find((room) => normalize(room.name) === normalize(selectedClass));
  const subjectRooms = currentRoom?.subjects || [];
  const threadItems = useMemo(
    () => assignments
      .filter((item) =>
        item.targetClasses?.some((target) => normalize(target) === normalize(selectedClass)) &&
        normalize(item.subject) === normalize(selectedSubject)
      )
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [assignments, selectedClass, selectedSubject]
  );

  function chooseClass(className) {
    setSelectedClass(className);
    setSelectedSubject("");
  }

  function goBack() {
    if (selectedSubject) {
      setSelectedSubject("");
      return;
    }
    if (selectedClass) {
      setSelectedClass("");
      return;
    }
  }

  async function pickAttachment() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setAttachment({
        uri: file.uri,
        name: file.name || "assignment-file",
        type: file.mimeType || "application/octet-stream",
      });
    } catch (pickError) {
      Alert.alert("Attachment", pickError.message || "Could not select this file.");
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera permission", "Allow camera access to take and attach a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const photo = result.assets[0];
      setAttachment({
        uri: photo.uri,
        name: photo.fileName || `assignment-photo-${Date.now()}.jpg`,
        type: photo.mimeType || "image/jpeg",
      });
    } catch (cameraError) {
      Alert.alert("Camera", cameraError.message || "Could not open the camera.");
    }
  }

  async function openAttachment(file) {
    const url = mediaUrl(file?.url);
    if (!url) {
      Alert.alert("Attachment", "This file is not available.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch (openError) {
      Alert.alert("Attachment", openError.message || "Could not open this file.");
    }
  }

  async function sendAssignment() {
    if (!draft.trim() && !attachment) {
      Alert.alert("Assignment", "Write an assignment or attach a file before sending.");
      return;
    }
    if (!checkingDate) {
      Alert.alert("Checking date", "Choose a checking date before sending.");
      return;
    }

    setSending(true);
    try {
      await createAssignment({
        title: "Assignment",
        description: draft.trim() || attachment?.name || "Assignment attachment",
        subject: selectedSubject,
        targetClasses: [selectedClass],
        checkingDate,
        attachment,
        createdByRole: user.role,
        createdByUsername: user.username,
        createdByName: user.displayName || user.username,
      });
      setDraft("");
      setAttachment(null);
      setShowSendModal(false);
      setCheckingDate(todayDateKey());
      await loadAssignments();
    } catch (sendError) {
      Alert.alert("Assignment", sendError.message || "Could not send this assignment.");
    } finally {
      setSending(false);
    }
  }

  const pageTitle = selectedSubject || selectedClass || "Assignments";
  const isInThread = Boolean(selectedClass && selectedSubject);
  const shouldShowClassList = !selectedClass;
  const shouldShowSubjectList = Boolean(selectedClass && !selectedSubject);
  const canSend = isTeacher && isInThread;

  return (
    <View style={styles.screen}>
      <AuroraBackground />
      <PageHeader title="Assignments" />
      {(selectedClass || selectedSubject) ? (
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={goBack} style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Ionicons name="arrow-back" size={20} color={palette.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subHeaderTitle, { color: palette.ink }]}>{pageTitle}</Text>
            {!!selectedSubject && <Text style={[styles.subHeaderSubtitle, { color: palette.inkSoft }]}>{selectedClass}</Text>}
          </View>
          {isInThread && (
            <TouchableOpacity onPress={loadAssignments} style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
              <Ionicons name="refresh-outline" size={19} color={palette.ink} />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {shouldShowClassList ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAssignments} tintColor={glassColors.accent} />}
        >
          <Text style={[styles.sectionHeading, { color: palette.ink }]}>
            {isTeacher ? "Your classes" : "Your class"}
          </Text>
          {error ? <Text style={[styles.stateText, { color: palette.danger || glassColors.danger }]}>{error}</Text> : null}
          {loading && !rooms.length ? (
            <Text style={[styles.stateText, { color: palette.inkSoft }]}>Loading assignment chats...</Text>
          ) : rooms.map((room) => {
            const count = assignments.filter((item) =>
              item.targetClasses?.some((target) => normalize(target) === normalize(room.name))
            ).length;
            return (
              <TouchableOpacity
                key={room.name}
                onPress={() => chooseClass(room.name)}
                activeOpacity={0.8}
                style={[styles.roomRow, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}
              >
                <View style={[styles.avatar, { backgroundColor: palette.tile }]}>
                  <Ionicons name="people" size={23} color={palette.accentDeep} />
                </View>
                <View style={styles.roomCopy}>
                  <Text style={[styles.roomTitle, { color: palette.ink }]}>{room.name}</Text>
                  <Text style={[styles.roomPreview, { color: palette.inkSoft }]}>
                    {room.subjects.length ? `${room.subjects.length} subject chat${room.subjects.length === 1 ? "" : "s"}` : "No assignment chats yet"}
                  </Text>
                </View>
                {count > 0 && <Text style={[styles.countBadge, { color: palette.inkSoft }]}>{count}</Text>}
                <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
              </TouchableOpacity>
            );
          })}
          {!loading && !rooms.length && !error ? (
            <Text style={[styles.stateText, { color: palette.inkSoft }]}>
              {isTeacher ? "No class and subject assignments are linked to your account." : "Your class is not available on this account."}
            </Text>
          ) : null}
        </ScrollView>
      ) : shouldShowSubjectList ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAssignments} tintColor={glassColors.accent} />}
        >
          {error ? <Text style={[styles.stateText, { color: palette.danger || glassColors.danger }]}>{error}</Text> : null}
          <Text style={[styles.sectionHeading, { color: palette.ink }]}>Subject chats</Text>
          {subjectRooms.map((subject) => {
            const lastMessage = assignments
              .filter((item) =>
                item.targetClasses?.some((target) => normalize(target) === normalize(selectedClass)) &&
                normalize(item.subject) === normalize(subject)
              )
              .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
            return (
              <TouchableOpacity
                key={subject}
                onPress={() => setSelectedSubject(subject)}
                activeOpacity={0.8}
                style={[styles.roomRow, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}
              >
                <View style={[styles.avatar, { backgroundColor: palette.tile }]}>
                  <Ionicons name="book-outline" size={22} color={palette.accentDeep} />
                </View>
                <View style={styles.roomCopy}>
                  <Text style={[styles.roomTitle, { color: palette.ink }]}>{subject}</Text>
                  <Text style={[styles.roomPreview, { color: palette.inkSoft }]} numberOfLines={1}>
                    {lastMessage?.description || (lastMessage?.attachment?.name ? `Attachment: ${lastMessage.attachment.name}` : "No assignments yet")}
                  </Text>
                </View>
                {lastMessage?.createdAt ? <Text style={[styles.messageTime, { color: palette.inkSoft }]}>{formatTime(lastMessage.createdAt)}</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
              </TouchableOpacity>
            );
          })}
          {!subjectRooms.length && !error ? (
            <Text style={[styles.stateText, { color: palette.inkSoft }]}>
              {isTeacher ? "No subject chats are linked to this class." : "Assignments will appear here when a teacher shares them."}
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.thread}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 92 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.threadContent}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAssignments} tintColor={glassColors.accent} />}
          >
            {error ? <Text style={[styles.stateText, { color: palette.danger || glassColors.danger }]}>{error}</Text> : null}
            {threadItems.map((item, index) => {
              const previous = threadItems[index - 1];
              const currentDay = item.createdAt ? localDateKey(new Date(item.createdAt)) : "";
              const previousDay = previous?.createdAt ? localDateKey(new Date(previous.createdAt)) : "";
              return (
                <React.Fragment key={item.id}>
                  {currentDay !== previousDay ? (
                    <View style={styles.dayDivider}>
                      <Text style={[styles.dayLabel, { color: palette.inkSoft, backgroundColor: palette.card }]}>
                        {formatDay(item.createdAt)}
                      </Text>
                    </View>
                  ) : null}
                  <MessageBubble
                    item={item}
                    own={item.createdByUsername === user.username}
                    onOpenAttachment={openAttachment}
                    palette={palette}
                  />
                </React.Fragment>
              );
            })}
            {!threadItems.length && !loading && !error ? (
              <View style={[styles.emptyThread, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                <Ionicons name="chatbubbles-outline" size={28} color={palette.inkFaint} />
                <Text style={[styles.stateText, { color: palette.inkSoft }]}>No assignments yet. Start the conversation.</Text>
              </View>
            ) : null}
          </ScrollView>

          {canSend ? (
            <View style={[styles.composer, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
              {attachment ? (
                <View style={[styles.selectedFile, { backgroundColor: palette.tile }]}>
                  <Ionicons name={attachment.type.startsWith("image/") ? "image-outline" : "document-text-outline"} size={18} color={palette.accentDeep} />
                  <Text style={[styles.selectedFileName, { color: palette.ink }]} numberOfLines={1}>{attachment.name}</Text>
                  <TouchableOpacity onPress={() => setAttachment(null)}>
                    <Ionicons name="close-circle" size={19} color={palette.inkSoft} />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.composerRow}>
                <TouchableOpacity onPress={pickAttachment} style={styles.composerIcon} accessibilityLabel="Attach image or PDF">
                  <Ionicons name="attach" size={23} color={palette.inkSoft} />
                </TouchableOpacity>
                <TouchableOpacity onPress={takePhoto} style={styles.composerIcon} accessibilityLabel="Take a photo">
                  <Ionicons name="camera-outline" size={22} color={palette.inkSoft} />
                </TouchableOpacity>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Write an assignment..."
                  placeholderTextColor={palette.inkFaint}
                  multiline
                  style={[styles.composerInput, { color: palette.ink, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!draft.trim() && !attachment) {
                      Alert.alert("Assignment", "Write an assignment or attach a file before sending.");
                      return;
                    }
                    setCheckingDate(todayDateKey());
                    setShowSendModal(true);
                  }}
                  style={[styles.sendButton, { backgroundColor: palette.accentDeep }]}
                  accessibilityLabel="Send assignment"
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}

      <Modal visible={showSendModal} transparent animationType="fade" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sendSheet, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>Set checking date</Text>
            <Text style={[styles.modalHint, { color: palette.inkSoft }]}>
              Choose when this assignment should be checked, then send it to {selectedClass}.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.dateButton, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
            >
              <Ionicons name="calendar-outline" size={20} color={palette.accentDeep} />
              <Text style={[styles.dateButtonText, { color: palette.ink }]}>{formatCheckingDate(checkingDate)}</Text>
            </TouchableOpacity>
            {showDatePicker ? (
              <DateTimePicker
                value={new Date(`${checkingDate}T12:00:00`)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "calendar"}
                minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                onChange={(event, date) => {
                  if (Platform.OS !== "ios") setShowDatePicker(false);
                  if (event.type === "set" && date) setCheckingDate(localDateKey(date));
                }}
              />
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowSendModal(false)} style={[styles.modalAction, { borderColor: palette.cardBorder }]}>
                <Text style={[styles.modalCancelText, { color: palette.inkSoft }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={sendAssignment}
                disabled={sending}
                style={[styles.modalAction, styles.modalSendAction, { backgroundColor: palette.accentDeep, opacity: sending ? 0.6 : 1 }]}
              >
                <Text style={styles.modalSendText}>{sending ? "Sending..." : "Done & Send"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  screen: { flex: 1 },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subHeaderTitle: { fontSize: 17, fontWeight: "900" },
  subHeaderSubtitle: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },
  sectionHeading: { fontSize: 18, fontWeight: "900", marginBottom: 12 },
  roomRow: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 9,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  roomCopy: { flex: 1, gap: 4 },
  roomTitle: { fontSize: 15, fontWeight: "900" },
  roomPreview: { fontSize: 12, fontWeight: "600" },
  countBadge: { fontSize: 11, fontWeight: "800" },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginVertical: 12 },
  thread: { flex: 1 },
  threadContent: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  dayDivider: { alignItems: "center", marginVertical: 10 },
  dayLabel: { overflow: "hidden", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 5, fontSize: 11, fontWeight: "800" },
  messageRow: { width: "100%", marginBottom: 9 },
  messageRowOwn: { alignItems: "flex-end" },
  messageRowOther: { alignItems: "flex-start" },
  messageBubble: { width: "86%", borderRadius: 17, padding: 11, borderWidth: 1 },
  messageBubbleOwn: { backgroundColor: "rgba(224, 242, 254, 0.93)", borderColor: "rgba(14, 165, 233, 0.18)", borderTopRightRadius: 5 },
  messageBubbleOther: { backgroundColor: "rgba(255,255,255,0.93)", borderColor: "rgba(255,255,255,0.7)", borderTopLeftRadius: 5 },
  sender: { fontSize: 11, fontWeight: "900", marginBottom: 5 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 9 },
  checkDate: { fontSize: 10, fontWeight: "800", flex: 1 },
  messageTime: { fontSize: 10, fontWeight: "700" },
  attachment: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  attachmentImage: { width: 120, height: 88, borderRadius: 10 },
  fileIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  attachmentName: { flex: 1, fontSize: 12, fontWeight: "800" },
  emptyThread: { alignSelf: "center", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 24 },
  composer: { borderWidth: 1, paddingHorizontal: 9, paddingTop: 8, paddingBottom: Platform.OS === "ios" ? 18 : 8 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
  composerIcon: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 110, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 9, fontSize: 14 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  selectedFile: { alignSelf: "flex-start", maxWidth: "90%", flexDirection: "row", alignItems: "center", gap: 7, padding: 8, borderRadius: 11, marginBottom: 7 },
  selectedFileName: { maxWidth: 190, fontSize: 12, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(15,23,42,0.45)" },
  sendSheet: { borderWidth: 1, borderRadius: 22, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  modalHint: { fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  dateButton: { minHeight: 48, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  dateButtonText: { fontSize: 14, fontWeight: "800" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 16 },
  modalAction: { minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 13, fontWeight: "800" },
  modalSendAction: { borderColor: "transparent" },
  modalSendText: { color: "#fff", fontSize: 13, fontWeight: "900" },
};
