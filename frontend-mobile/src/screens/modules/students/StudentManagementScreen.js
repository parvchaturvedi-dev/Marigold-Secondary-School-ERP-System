// Student Management — full parity with web StudentManagement + StudentAssigning
// + StudentProfile: list/search/filter, single admission (create), edit, delete,
// photo & document upload, and Excel/CSV bulk import.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Image, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as XLSX from "@e965/xlsx";
import { Ionicons } from "@expo/vector-icons";

import {
  Banner,
  ButtonRow,
  Card,
  DateField,
  Divider,
  GhostButton,
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

const STUDENTS_NS = "admin-student-management-students";
const CLASSES_NS = "admin-class-management-classes";
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const CATEGORY_OPTIONS = ["General", "OBC", "SC", "ST", "EWS"];

const emptyForm = {
  studentName: "",
  admissionNumber: "",
  targetClass: "",
  section: "",
  rollNo: "",
  gender: "",
  dob: "",
  category: "",
  religion: "",
  mobileNo: "",
  altMobileNo: "",
  email: "",
  studentAadhar: "",
  penNumber: "",
  dateOfAdmission: "",
  lastSchoolName: "",
  tempAddress: "",
  permAddress: "",
  fatherName: "",
  fatherAadhar: "",
  motherName: "",
  motherAadhar: "",
  guardianName: "",
  guardianMobile: "",
  guardianAadhar: "",
};

// Build the exact record shape the web writes to admin-student-management-students.
function buildStudentRecord(form, existing = {}) {
  const id = String(form.admissionNumber || "").trim().toUpperCase();
  const raw = { ...form, id, admissionNumber: id, timestamp: new Date().toISOString() };
  return {
    ...existing,
    admissionNumber: id,
    id,
    displayName: form.studentName,
    name: form.studentName,
    className: form.targetClass,
    class: form.targetClass,
    section: form.section || "",
    rollNo: form.rollNo || "",
    gender: form.gender,
    category: form.category,
    lastSchoolName: form.lastSchoolName,
    mobile: form.mobileNo,
    email: form.email,
    fatherName: form.fatherName,
    motherName: form.motherName,
    guardianName: form.guardianName,
    guardianPhone: form.guardianMobile || form.mobileNo,
    guardianEmail: form.email,
    address: form.permAddress || form.tempAddress,
    status: existing.status || "Active",
    photoDataUrl: existing.photoDataUrl || "",
    documents: existing.documents || [],
    rawProfile: { ...(existing.rawProfile || {}), ...raw },
  };
}

function formFromRecord(rec = {}) {
  const raw = rec.rawProfile || {};
  return {
    ...emptyForm,
    ...raw,
    studentName: rec.displayName || rec.name || raw.studentName || "",
    admissionNumber: rec.admissionNumber || rec.id || "",
    targetClass: rec.className || raw.targetClass || "",
    section: rec.section || "",
    rollNo: rec.rollNo || "",
    gender: rec.gender || "",
    category: rec.category || "",
    mobileNo: rec.mobile || raw.mobileNo || "",
    email: rec.email || "",
    fatherName: rec.fatherName || "",
    motherName: rec.motherName || "",
    guardianName: rec.guardianName || "",
    guardianMobile: raw.guardianMobile || rec.guardianPhone || "",
  };
}

async function pickFile(types) {
  const res = await DocumentPicker.getDocumentAsync({ type: types, multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const base64 = await FileSystem.readAsStringAsync(a.uri, { encoding: "base64" });
  return { asset: a, base64 };
}

export default function StudentManagementScreen() {
  const { palette } = useTheme();
  const banner = useBanner();
  const { items: students, loading, reload, persist } = useModuleState(STUDENTS_NS);
  const { items: classes } = useModuleState(CLASSES_NS);

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [mode, setMode] = useState("list"); // list | form
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Hardware Back: if the add/edit form is open, close it back to the list first;
  // only at the list (top) level does Back fall through to the app (dashboard).
  useEffect(() => {
    const onBack = () => {
      if (mode === "form") {
        setMode("list");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [mode]);

  const classNames = useMemo(
    () => classes.map((c) => c.name || c.className || c.id).filter(Boolean),
    [classes]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== "all" && (s.className || s.class) !== classFilter) return false;
      if (!q) return true;
      return [s.displayName, s.name, s.admissionNumber, s.fatherName].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(q)
      );
    });
  }, [students, query, classFilter]);

  const updateForm = (field, value) => setForm((c) => ({ ...c, [field]: value }));

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setMode("form");
    banner.clear();
  }

  function openEdit(rec) {
    setForm(formFromRecord(rec));
    setEditingId(rec.admissionNumber || rec.id);
    setMode("form");
    banner.clear();
  }

  async function saveStudent() {
    if (!form.studentName.trim() || !form.admissionNumber.trim() || !form.targetClass.trim())
      return banner.showError("Name, admission number and class are required.");
    const id = form.admissionNumber.trim().toUpperCase();
    const duplicate = students.some((s) => (s.admissionNumber || s.id) === id) && id !== editingId;
    if (duplicate) return banner.showError(`Admission number ${id} already exists.`);
    setSaving(true);
    try {
      const existing = students.find((s) => (s.admissionNumber || s.id) === editingId) || {};
      const record = buildStudentRecord(form, editingId ? existing : {});
      const next = [record, ...students.filter((s) => (s.admissionNumber || s.id) !== id && (s.admissionNumber || s.id) !== editingId)];
      await persist(next);
      banner.showSuccess(editingId ? "Student updated." : "Student admitted.");
      setMode("list");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  function deleteStudent(rec) {
    Alert.alert("Remove student", `Remove ${rec.displayName || rec.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await persist(students.filter((s) => (s.admissionNumber || s.id) !== (rec.admissionNumber || rec.id)));
            banner.showSuccess("Student removed.");
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  }

  async function uploadPhoto(rec) {
    try {
      const picked = await pickFile(["image/*"]);
      if (!picked) return;
      const dataUrl = `data:${picked.asset.mimeType || "image/jpeg"};base64,${picked.base64}`;
      const next = students.map((s) =>
        (s.admissionNumber || s.id) === (rec.admissionNumber || rec.id)
          ? { ...s, photoDataUrl: dataUrl, rawProfile: { ...(s.rawProfile || {}), photoDataUrl: dataUrl } }
          : s
      );
      await persist(next);
      banner.showSuccess("Photo updated.");
    } catch (err) {
      banner.showError(err);
    }
  }

  async function uploadDocument(rec) {
    try {
      const picked = await pickFile(["image/*", "application/pdf"]);
      if (!picked) return;
      const doc = {
        name: picked.asset.name || "document",
        file: picked.asset.name || "document",
        type: picked.asset.mimeType || "application/octet-stream",
        dataUrl: `data:${picked.asset.mimeType || "application/octet-stream"};base64,${picked.base64}`,
        status: "Uploaded",
        uploadedAt: new Date().toISOString(),
      };
      const next = students.map((s) =>
        (s.admissionNumber || s.id) === (rec.admissionNumber || rec.id)
          ? { ...s, documents: [doc, ...(s.documents || [])] }
          : s
      );
      await persist(next);
      banner.showSuccess("Document uploaded.");
    } catch (err) {
      banner.showError(err);
    }
  }

  async function importSheet() {
    try {
      const picked = await pickFile([
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "text/comma-separated-values",
      ]);
      if (!picked) return;
      const wb = XLSX.read(picked.base64, { type: "base64" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!rows.length) return banner.showError("No rows found in the file.");
      const pick = (row, keys) => {
        for (const k of Object.keys(row)) {
          const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (keys.includes(norm)) return String(row[k]).trim();
        }
        return "";
      };
      const imported = rows
        .map((row) => {
          const f = {
            ...emptyForm,
            studentName: pick(row, ["studentname", "name", "student"]),
            admissionNumber: pick(row, ["admissionnumber", "admissionno", "admno", "id"]),
            targetClass: pick(row, ["class", "targetclass", "classname"]),
            section: pick(row, ["section"]),
            rollNo: pick(row, ["rollno", "roll"]),
            gender: pick(row, ["gender"]),
            dob: pick(row, ["dob", "dateofbirth"]),
            category: pick(row, ["category"]),
            mobileNo: pick(row, ["mobile", "mobileno", "phone"]),
            email: pick(row, ["email"]),
            fatherName: pick(row, ["fathername", "father"]),
            motherName: pick(row, ["mothername", "mother"]),
          };
          return f.studentName && f.admissionNumber ? buildStudentRecord(f) : null;
        })
        .filter(Boolean);
      if (!imported.length) return banner.showError("No valid rows (need Student Name + Admission Number columns).");
      const importedIds = new Set(imported.map((s) => s.admissionNumber));
      const next = [...imported, ...students.filter((s) => !importedIds.has(s.admissionNumber || s.id))];
      await persist(next);
      banner.showSuccess(`Imported ${imported.length} students.`);
    } catch (err) {
      banner.showError(err.message || "Import failed. Check the file format.");
    }
  }

  if (mode === "form") {
    return (
      <ScreenShell title={editingId ? "Edit Student" : "New Admission"}>
        <Banner type="error" message={banner.error} />
        <Card>
          <SectionTitle>Student Details</SectionTitle>
          <TextField label="Student Name *" value={form.studentName} onChangeText={(v) => updateForm("studentName", v)} placeholder="Full name" />
          <TextField label="Admission Number *" value={form.admissionNumber} onChangeText={(v) => updateForm("admissionNumber", v)} placeholder="e.g. MGPS-2026-001" autoCapitalize="characters" editable={!editingId} />
          {classNames.length ? (
            <Select label="Class *" value={form.targetClass} onChange={(v) => updateForm("targetClass", v)} options={classNames} placeholder="Select class" />
          ) : (
            <TextField label="Class *" value={form.targetClass} onChangeText={(v) => updateForm("targetClass", v)} placeholder="Class name" />
          )}
          <TextField label="Section" value={form.section} onChangeText={(v) => updateForm("section", v)} placeholder="A / B" />
          <TextField label="Roll No" value={form.rollNo} onChangeText={(v) => updateForm("rollNo", v)} />
          <Select label="Gender" value={form.gender} onChange={(v) => updateForm("gender", v)} options={GENDER_OPTIONS} placeholder="Select gender" />
          <DateField label="Date of Birth" value={form.dob} onChange={(v) => updateForm("dob", v)} placeholder="YYYY-MM-DD" />
          <Select label="Category" value={form.category} onChange={(v) => updateForm("category", v)} options={CATEGORY_OPTIONS} placeholder="Select category" />
          <TextField label="Religion" value={form.religion} onChangeText={(v) => updateForm("religion", v)} />
          <TextField label="Student Aadhaar" value={form.studentAadhar} onChangeText={(v) => updateForm("studentAadhar", v)} keyboardType="number-pad" />
          <TextField label="PEN Number" value={form.penNumber} onChangeText={(v) => updateForm("penNumber", v)} autoCapitalize="characters" />
        </Card>

        <Card>
          <SectionTitle>Contact & Address</SectionTitle>
          <TextField label="Mobile" value={form.mobileNo} onChangeText={(v) => updateForm("mobileNo", v)} keyboardType="phone-pad" />
          <TextField label="Alternate Mobile" value={form.altMobileNo} onChangeText={(v) => updateForm("altMobileNo", v)} keyboardType="phone-pad" />
          <TextField label="Email" value={form.email} onChangeText={(v) => updateForm("email", v)} keyboardType="email-address" autoCapitalize="none" />
          <TextField label="Current Address" value={form.tempAddress} onChangeText={(v) => updateForm("tempAddress", v)} multiline />
          <TextField label="Permanent Address" value={form.permAddress} onChangeText={(v) => updateForm("permAddress", v)} multiline />
          <DateField label="Date of Admission" value={form.dateOfAdmission} onChange={(v) => updateForm("dateOfAdmission", v)} placeholder="YYYY-MM-DD" />
          <TextField label="Last School" value={form.lastSchoolName} onChangeText={(v) => updateForm("lastSchoolName", v)} />
        </Card>

        <Card>
          <SectionTitle>Family</SectionTitle>
          <TextField label="Father Name" value={form.fatherName} onChangeText={(v) => updateForm("fatherName", v)} />
          <TextField label="Father Aadhaar" value={form.fatherAadhar} onChangeText={(v) => updateForm("fatherAadhar", v)} keyboardType="number-pad" />
          <TextField label="Mother Name" value={form.motherName} onChangeText={(v) => updateForm("motherName", v)} />
          <TextField label="Mother Aadhaar" value={form.motherAadhar} onChangeText={(v) => updateForm("motherAadhar", v)} keyboardType="number-pad" />
          <TextField label="Guardian Name" value={form.guardianName} onChangeText={(v) => updateForm("guardianName", v)} />
          <TextField label="Guardian Mobile" value={form.guardianMobile} onChangeText={(v) => updateForm("guardianMobile", v)} keyboardType="phone-pad" />
          <TextField label="Guardian Aadhaar" value={form.guardianAadhar} onChangeText={(v) => updateForm("guardianAadhar", v)} keyboardType="number-pad" />
        </Card>

        <PrimaryButton icon="save-outline" label={editingId ? "Save Changes" : "Admit Student"} onPress={saveStudent} loading={saving} />
        <GhostButton icon="close-outline" label="Cancel" onPress={() => setMode("list")} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Student Management" refreshing={loading} onRefresh={reload}>
      <Hero icon="school-outline" title={`${students.length} students`} subtitle="Admit, edit, import and manage students." />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <ButtonRow>
          <SmallButton label="New Admission" icon="person-add-outline" onPress={openAdd} />
          <SmallButton label="Import Excel/CSV" icon="cloud-upload-outline" onPress={importSheet} />
        </ButtonRow>
        <View style={{ height: 12 }} />
        <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name, admission no. or father" autoCapitalize="none" />
        {classNames.length > 0 && (
          <>
            <Text style={[styles.label, { color: palette.inkLabel }]}>Filter by class</Text>
            <Segmented
              options={[{ value: "all", label: "All" }, ...classNames.slice(0, 5).map((c) => ({ value: c, label: c }))]}
              value={classFilter}
              onChange={setClassFilter}
            />
          </>
        )}
      </Card>

      <SectionTitle right={<Text style={[styles.count, { color: palette.inkSoft, backgroundColor: palette.tile }]}>{filtered.length}</Text>}>Students</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading students..." />
      ) : (
        filtered.map((rec) => (
          <Card key={rec.admissionNumber || rec.id}>
            <View style={styles.rowHead}>
              <View style={styles.avatar}>
                {rec.photoDataUrl ? (
                  <Image source={{ uri: rec.photoDataUrl }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={26} color="#4F46E5" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: palette.ink }]}>{rec.displayName || rec.name}</Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>
                  {rec.admissionNumber} · {[rec.className || rec.class, rec.section].filter(Boolean).join(" - ")}
                </Text>
                {!!rec.fatherName && <Text style={[styles.sub, { color: palette.inkSoft }]}>Father: {rec.fatherName}</Text>}
              </View>
            </View>
            <Divider />
            <ButtonRow>
              <SmallButton label="Edit" icon="create-outline" onPress={() => openEdit(rec)} />
              <SmallButton label="Photo" icon="camera-outline" onPress={() => uploadPhoto(rec)} />
              <SmallButton label="Doc" icon="document-attach-outline" onPress={() => uploadDocument(rec)} />
              <View style={{ marginLeft: "auto" }}>
                <IconButton icon="trash-outline" tone="danger" onPress={() => deleteStudent(rec)} />
              </View>
            </ButtonRow>
            {(rec.documents || []).length > 0 && (
              <Text style={[styles.docNote, { color: palette.accentDeep }]}>{rec.documents.length} document(s) on file</Text>
            )}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = {
  label: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  count: { color: "#64748B", fontWeight: "900", backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 2 },
  docNote: { color: "#4F46E5", fontWeight: "800", fontSize: 12, marginTop: 8 },
};
