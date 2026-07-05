// Teacher Management — full parity with web Admin/TeacherManagement.jsx +
// TeacherAssignment.jsx. View, create, edit, delete teachers. Class-teacher
// links are mirrored into `admin-class-management-classes` exactly like the web.
import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import {
  Banner,
  ButtonRow,
  Card,
  DateField,
  Divider,
  EmptyState,
  Hero,
  IconButton,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  Segmented,
  Select,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";
import { useTheme } from "../../../theme/ThemeContext";

const TEACHERS_NS = "admin-teacher-management-list";
const CLASSES_NS = "admin-class-management-classes";
const SUBJECTS_NS = "admin-subjects-global";

const GENDERS = ["Male", "Female", "Other"];
const MARITAL = ["Single", "Married", "Divorced"];
const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

const emptyForm = () => ({
  name: "",
  email: "",
  mobile: "",
  gender: "",
  dob: "",
  maritalStatus: "",
  category: "",
  address: "",
  aadharNumber: "",
  fatherName: "",
  husbandName: "",
  dateOfJoining: "",
  experience: [{ organization: "", position: "", years: "" }],
  classAssignments: [{ className: "", subject: "" }],
  isClassTeacher: "No",
  assignedClassTeacherFor: "",
  documentsAttached: [],
});

const getClassName = (c = {}) => c.name || c.className || c.class || "";

async function pickDocument() {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "application/pdf"],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const base64 = await FileSystem.readAsStringAsync(a.uri, { encoding: "base64" });
  const mime = a.mimeType || "application/octet-stream";
  return {
    name: a.name || "file",
    file: a.name || "file",
    size: a.size || 0,
    type: mime,
    dataUrl: `data:${mime};base64,${base64}`,
    uploadedAt: new Date().toISOString(),
    status: "Uploaded",
  };
}

// Match the web id scheme: `TCH-2026-XXX`
const newTeacherId = () => `TCH-2026-${Math.floor(100 + Math.random() * 900)}`;

const docLabel = (doc) => (typeof doc === "string" ? doc : doc?.name || doc?.file || "file");

export default function TeacherManagementScreen({ user }) {
  const banner = useBanner();
  const { palette } = useTheme();
  const teachersState = useModuleState(TEACHERS_NS);
  const classesState = useModuleState(CLASSES_NS);
  const {
    items: teachers,
    loading: teachersLoading,
    persist: persistTeachers,
    reload: reloadTeachers,
  } = teachersState;
  const { items: classes, persist: persistClasses, reload: reloadClasses } = classesState;
  const subjectsState = useModuleState(SUBJECTS_NS);
  const subjectNames = useMemo(() => {
    const names = (Array.isArray(subjectsState.items) ? subjectsState.items : [])
      .map((s) => (typeof s === "string" ? s : s?.name || s?.subject))
      .filter(Boolean);
    return [...new Set(names)];
  }, [subjectsState.items]);

  const canRemoveTeacher = user?.role !== "clerk";

  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const classNames = useMemo(() => {
    const names = (Array.isArray(classes) ? classes : []).map(getClassName).filter(Boolean);
    return [...new Set(names)];
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        String(t.name || "").toLowerCase().includes(q) ||
        String(t.id || "").toLowerCase().includes(q)
    );
  }, [teachers, search]);

  const onRefresh = () => {
    reloadTeachers();
    reloadClasses();
  };

  // ---- Class-teacher link mirroring (matches web logic) -------------------
  function clearClassTeacherLinks(classList, teacher) {
    return classList.map((classRecord) => {
      const currentId = classRecord.classTeacherId || classRecord.teacherId || "";
      const isCurrent =
        currentId === teacher.id ||
        classRecord.classTeacherName === teacher.name ||
        classRecord.teacher === teacher.name;
      if (!isCurrent) return classRecord;
      return { ...classRecord, classTeacherId: "", classTeacherName: "", teacher: "" };
    });
  }

  function applyClassTeacher(classList, teacher) {
    if (teacher.isClassTeacher !== "Yes" || !teacher.assignedClassTeacherFor) return classList;
    const hasClass = classList.some((c) => c.name === teacher.assignedClassTeacherFor);
    const next = hasClass
      ? classList
      : [
          ...classList,
          { id: teacher.assignedClassTeacherFor, name: teacher.assignedClassTeacherFor, studentCount: 0 },
        ];
    return next.map((c) =>
      c.name === teacher.assignedClassTeacherFor
        ? { ...c, classTeacherId: teacher.id, classTeacherName: teacher.name, teacher: teacher.name }
        : c
    );
  }

  // ---- CREATE ------------------------------------------------------------
  const setF = (field, value) => setForm((c) => ({ ...c, [field]: value }));

  async function createTeacher() {
    if (!form.name.trim() || !form.email.trim() || !form.mobile.trim())
      return banner.showError("Name, email and mobile are required.");
    if (form.aadharNumber && !/^\d{12}$/.test(form.aadharNumber))
      return banner.showError("Aadhaar must be exactly 12 digits.");
    if (form.isClassTeacher === "Yes" && !form.assignedClassTeacherFor)
      return banner.showError("Select the class this teacher is in charge of.");

    setSaving(true);
    banner.clear();
    try {
      const record = {
        ...form,
        id: newTeacherId(),
        fatherName:
          form.gender === "Female" && form.maritalStatus === "Married" ? "" : form.fatherName,
        husbandName:
          form.gender === "Female" && form.maritalStatus === "Married" ? form.husbandName : "",
      };
      await persistTeachers([record, ...teachers]);
      if (record.isClassTeacher === "Yes" && record.assignedClassTeacherFor) {
        await persistClasses(applyClassTeacher(classes, record));
      }
      setForm(emptyForm());
      setShowCreate(false);
      banner.showSuccess(`Teacher registered. ID: ${record.id}`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  async function addCreateDocument() {
    try {
      const doc = await pickDocument();
      if (doc) setForm((c) => ({ ...c, documentsAttached: [...c.documentsAttached, doc] }));
    } catch (err) {
      banner.showError(err);
    }
  }

  // ---- EDIT --------------------------------------------------------------
  function openEdit(teacher) {
    const clone = JSON.parse(JSON.stringify(teacher));
    if (!Array.isArray(clone.experience) || !clone.experience.length)
      clone.experience = [{ organization: "", position: "", years: "" }];
    if (!Array.isArray(clone.classAssignments) || !clone.classAssignments.length)
      clone.classAssignments = [{ className: "", subject: "" }];
    if (!Array.isArray(clone.documentsAttached)) clone.documentsAttached = [];
    if (!clone.isClassTeacher) clone.isClassTeacher = "No";
    setEditingId(teacher.id);
    setEditForm(clone);
    banner.clear();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  const setE = (field, value) => setEditForm((c) => ({ ...c, [field]: value }));

  async function addEditDocument() {
    try {
      const doc = await pickDocument();
      if (doc) setEditForm((c) => ({ ...c, documentsAttached: [...c.documentsAttached, doc] }));
    } catch (err) {
      banner.showError(err);
    }
  }

  async function saveEdit() {
    const draft = editForm;
    if (!draft.name.trim() || !draft.email.trim() || !draft.mobile.trim())
      return banner.showError("Name, email and mobile are required.");
    if (draft.aadharNumber && !/^\d{12}$/.test(draft.aadharNumber))
      return banner.showError("Aadhaar must be exactly 12 digits.");
    if (draft.isClassTeacher === "Yes" && !draft.assignedClassTeacherFor)
      return banner.showError("Select the class this teacher is in charge of.");

    setSaving(true);
    banner.clear();
    try {
      const previous = teachers.find((t) => t.id === draft.id) || {};
      const sanitized = {
        ...draft,
        fatherName:
          draft.gender === "Female" && draft.maritalStatus === "Married" ? "" : draft.fatherName,
        husbandName:
          draft.gender === "Female" && draft.maritalStatus === "Married" ? draft.husbandName : "",
      };
      await persistTeachers(teachers.map((t) => (t.id === sanitized.id ? sanitized : t)));
      // Clear links using the PREVIOUS name/id, then re-apply for the new value.
      const cleaned = clearClassTeacherLinks(classes, {
        id: sanitized.id,
        name: previous.name,
      });
      await persistClasses(applyClassTeacher(cleaned, sanitized));
      cancelEdit();
      banner.showSuccess("Teacher registry updated.");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  // ---- DELETE ------------------------------------------------------------
  function deleteTeacher(teacher) {
    if (!canRemoveTeacher) return banner.showError("Clerk access cannot remove faculty records.");
    Alert.alert(
      "Remove teacher",
      `Permanently remove ${teacher.name} (ID: ${teacher.id}) from institute files?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await persistTeachers(teachers.filter((t) => t.id !== teacher.id));
              const nextClasses = classes.map((classRecord) =>
                (classRecord.classTeacherId || classRecord.teacherId) === teacher.id ||
                classRecord.classTeacherName === teacher.name ||
                classRecord.teacher === teacher.name
                  ? { ...classRecord, classTeacherId: "", classTeacherName: "", teacher: "" }
                  : classRecord
              );
              await persistClasses(nextClasses);
              if (editingId === teacher.id) cancelEdit();
              banner.showSuccess("Teacher removed from system.");
            } catch (err) {
              banner.showError(err);
            }
          },
        },
      ]
    );
  }

  return (
    <ScreenShell title="Teacher Management" refreshing={teachersLoading} onRefresh={onRefresh}>
      <Hero
        icon="school-outline"
        title={`${teachers.length} teachers`}
        subtitle="Onboard faculty, edit master files and manage class-teacher assignments."
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or teacher ID..."
          autoCapitalize="none"
        />
        <PrimaryButton
          icon={showCreate ? "close-outline" : "person-add-outline"}
          label={showCreate ? "Close new teacher form" : "Onboard new teacher"}
          onPress={() => {
            setShowCreate((v) => !v);
            if (!showCreate) setForm(emptyForm());
          }}
        />
      </Card>

      {showCreate && (
        <Card>
          <SectionTitle>New Teacher</SectionTitle>
          <TeacherForm
            data={form}
            set={setF}
            classNames={classNames}
            subjectNames={subjectNames}
            onAddDocument={addCreateDocument}
            onSubmit={createTeacher}
            submitLabel="Register Teacher"
            saving={saving}
          />
        </Card>
      )}

      <SectionTitle>Faculty Directory</SectionTitle>
      {teachersLoading ? (
        <LoadingCard text="Loading teachers..." />
      ) : !filtered.length ? (
        <EmptyState
          icon="people-outline"
          title="No teachers found"
          text={search ? "No teachers match your search." : "Onboard your first teacher above."}
        />
      ) : (
        filtered.map((teacher) => (
          <Card key={teacher.id}>
            <View style={styles.rowHead}>
              <View style={[styles.avatar, { backgroundColor: palette.tile }]}>
                <Text style={[styles.avatarText, { color: palette.accentDeep }]}>
                  {String(teacher.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.id, { color: palette.inkSoft }]}>{teacher.id}</Text>
                <Text style={[styles.name, { color: palette.ink }]}>{teacher.name}</Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>
                  {teacher.isClassTeacher === "Yes"
                    ? `Class Teacher: ${teacher.assignedClassTeacherFor}`
                    : "Subject Instructor"}
                </Text>
              </View>
            </View>
            <Divider />
            <Text style={[styles.line, { color: palette.ink }]}>Email: {teacher.email || "—"}</Text>
            <Text style={[styles.line, { color: palette.ink }]}>Mobile: {teacher.mobile || "—"}</Text>
            <Text style={[styles.line, { color: palette.ink }]}>
              Allotted:{" "}
              {(teacher.classAssignments || [])
                .map((c) => c.className)
                .filter(Boolean)
                .join(", ") || "—"}
            </Text>

            {editingId === teacher.id ? (
              <View style={{ marginTop: 12 }}>
                <Divider />
                <SectionTitle>Edit Master File</SectionTitle>
                <TeacherForm
                  data={editForm}
                  set={setE}
                  classNames={classNames}
                  subjectNames={subjectNames}
                  onAddDocument={addEditDocument}
                  onSubmit={saveEdit}
                  submitLabel="Update Database"
                  saving={saving}
                  onCancel={cancelEdit}
                />
              </View>
            ) : (
              <ButtonRow>
                <SmallButton label="Edit" icon="create-outline" onPress={() => openEdit(teacher)} />
                {canRemoveTeacher && (
                  <View style={{ marginLeft: "auto" }}>
                    <IconButton icon="trash-outline" tone="danger" onPress={() => deleteTeacher(teacher)} />
                  </View>
                )}
              </ButtonRow>
            )}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

// ---- Shared form (create + edit) ----------------------------------------
function TeacherForm({ data, set, classNames, subjectNames = [], onAddDocument, onSubmit, submitLabel, saving, onCancel }) {
  const { palette } = useTheme();
  const fatherBlocked = data.gender === "Female" && data.maritalStatus === "Married";

  const setAssignment = (index, field, value) => {
    const next = data.classAssignments.map((a, i) => (i === index ? { ...a, [field]: value } : a));
    set("classAssignments", next);
  };
  const addAssignment = () =>
    set("classAssignments", [...data.classAssignments, { className: "", subject: "" }]);
  const removeAssignment = (index) => {
    if (data.classAssignments.length === 1) return;
    set("classAssignments", data.classAssignments.filter((_, i) => i !== index));
  };

  const setExperience = (index, field, value) => {
    const next = data.experience.map((e, i) => (i === index ? { ...e, [field]: value } : e));
    set("experience", next);
  };
  const addExperience = () =>
    set("experience", [...data.experience, { organization: "", position: "", years: "" }]);
  const removeExperience = (index) => {
    if (data.experience.length === 1) return;
    set("experience", data.experience.filter((_, i) => i !== index));
  };

  return (
    <View>
      <Text style={[styles.blockLabel, { color: palette.inkLabel }]}>1. Demographics</Text>
      <TextField label="Full Name" value={data.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Dr. Ramesh Verma" />
      <TextField label="Email" value={data.email} onChangeText={(v) => set("email", v)} placeholder="name@academy.com" keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Mobile" value={data.mobile} onChangeText={(v) => set("mobile", v)} placeholder="10-digit mobile" keyboardType="phone-pad" />
      <DateField label="Date of Birth" value={data.dob} onChange={(v) => set("dob", v)} placeholder="YYYY-MM-DD" />

      <Select label="Gender" options={GENDERS} value={data.gender} onChange={(v) => set("gender", v)} placeholder="Select gender" />

      <Text style={[styles.miniLabel, { color: palette.inkLabel }]}>Marital Status</Text>
      <Segmented options={MARITAL} value={data.maritalStatus} onChange={(v) => set("maritalStatus", v)} />
      <View style={{ height: 12 }} />

      <Select label="Category" options={CATEGORIES} value={data.category} onChange={(v) => set("category", v)} placeholder="Select category" />

      <TextField label="Aadhaar Number" value={data.aadharNumber} onChangeText={(v) => set("aadharNumber", v)} placeholder="12 digits" keyboardType="number-pad" maxLength={12} />
      {fatherBlocked ? (
        <TextField label="Husband's Name" value={data.husbandName} onChangeText={(v) => set("husbandName", v)} placeholder="Enter husband name" />
      ) : (
        <TextField label="Father's Name" value={data.fatherName} onChangeText={(v) => set("fatherName", v)} placeholder="Enter father name" />
      )}
      <TextField label="Address" value={data.address} onChangeText={(v) => set("address", v)} placeholder="Residential address" multiline />

      <Divider />
      <View style={styles.repeaterHead}>
        <Text style={[styles.blockLabel, { color: palette.inkLabel }]}>2. Prior Experience</Text>
        <SmallButton label="Add" icon="add-outline" onPress={addExperience} />
      </View>
      {data.experience.map((exp, i) => (
        <View key={`exp-${i}`} style={[styles.repeaterRow, { backgroundColor: palette.tile, borderColor: palette.cardBorder }]}>
          <TextField label="Organization" value={exp.organization} onChangeText={(v) => setExperience(i, "organization", v)} placeholder="School name" />
          <TextField label="Position" value={exp.position} onChangeText={(v) => setExperience(i, "position", v)} placeholder="Role" />
          <TextField label="Years" value={exp.years} onChangeText={(v) => setExperience(i, "years", v)} placeholder="Yrs" keyboardType="number-pad" />
          {data.experience.length > 1 && (
            <SmallButton label="Remove experience" icon="trash-outline" tone="danger" onPress={() => removeExperience(i)} />
          )}
        </View>
      ))}

      <Divider />
      <View style={styles.repeaterHead}>
        <Text style={[styles.blockLabel, { color: palette.inkLabel }]}>3. Class Assignments</Text>
        <SmallButton label="Add" icon="add-outline" onPress={addAssignment} />
      </View>
      {data.classAssignments.map((assign, i) => (
        <View key={`assign-${i}`} style={[styles.repeaterRow, { backgroundColor: palette.tile, borderColor: palette.cardBorder }]}>
          <Text style={[styles.miniLabel, { color: palette.inkLabel }]}>Class</Text>
          <ClassPicker
            classNames={classNames}
            value={assign.className}
            onChange={(v) => setAssignment(i, "className", v)}
          />
          {subjectNames.length ? (
            <Select label="Subject" options={subjectNames} value={assign.subject} onChange={(v) => setAssignment(i, "subject", v)} placeholder="Select subject" />
          ) : (
            <TextField label="Subject" value={assign.subject} onChangeText={(v) => setAssignment(i, "subject", v)} placeholder="Subject" />
          )}
          {data.classAssignments.length > 1 && (
            <SmallButton label="Remove assignment" icon="trash-outline" tone="danger" onPress={() => removeAssignment(i)} />
          )}
        </View>
      ))}

      <Divider />
      <Text style={[styles.blockLabel, { color: palette.inkLabel }]}>4. Joining & Class Teacher</Text>
      <DateField label="Date of Joining" value={data.dateOfJoining} onChange={(v) => set("dateOfJoining", v)} placeholder="YYYY-MM-DD" />
      <Text style={[styles.miniLabel, { color: palette.inkLabel }]}>Is Designated Class Teacher?</Text>
      <Segmented
        options={["No", "Yes"]}
        value={data.isClassTeacher}
        onChange={(v) => set("isClassTeacher", v)}
      />
      {data.isClassTeacher === "Yes" && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.miniLabel, { color: palette.inkLabel }]}>Grade Incharge Assignment</Text>
          <ClassPicker
            classNames={classNames}
            value={data.assignedClassTeacherFor}
            onChange={(v) => set("assignedClassTeacherFor", v)}
          />
        </View>
      )}

      <Divider />
      <Text style={[styles.blockLabel, { color: palette.inkLabel }]}>5. Verification Documents</Text>
      <SmallButton label="Attach document" icon="cloud-upload-outline" onPress={onAddDocument} />
      {!!(data.documentsAttached || []).length && (
        <View style={styles.docList}>
          {data.documentsAttached.map((doc, i) => (
            <View key={`doc-${i}`} style={styles.docChip}>
              <Text style={styles.docText} numberOfLines={1}>
                {docLabel(doc)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 12 }} />
      <PrimaryButton icon="save-outline" label={submitLabel} onPress={onSubmit} loading={saving} />
      {!!onCancel && <SmallButton label="Cancel" icon="close-outline" onPress={onCancel} />}
    </View>
  );
}

function ClassPicker({ classNames, value, onChange }) {
  const { palette } = useTheme();
  if (!classNames.length) {
    return <Text style={[styles.emptyHint, { color: palette.inkFaint }]}>No classes configured yet.</Text>;
  }
  return <Select options={classNames} value={value} onChange={onChange} placeholder="Select class" />;
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#4F46E5", fontSize: 18, fontWeight: "900" },
  id: { color: "#64748B", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900", marginTop: 2 },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 2 },
  line: { color: "#0F172A", fontWeight: "700", fontSize: 13, marginBottom: 4 },
  blockLabel: { color: "#475569", fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginBottom: 8 },
  miniLabel: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  repeaterHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  repeaterRow: {
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  emptyHint: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  docList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  docChip: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  docText: { color: "#065F46", fontWeight: "800", fontSize: 11 },
};
