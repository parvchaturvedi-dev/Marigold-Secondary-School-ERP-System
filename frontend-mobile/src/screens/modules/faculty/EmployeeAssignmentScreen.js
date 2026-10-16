import React, { useState } from "react";
import { Text } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  Banner,
  Card,
  DateField,
  Hero,
  PrimaryButton,
  ScreenShell,
  Select,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";

const EMPLOYEES_NS = "admin-employee-management-list";
const DESIGNATIONS_NS = "admin-employee-designations";
const emptyForm = () => ({
  name: "", email: "", mobile: "", dob: "", gender: "", maritalStatus: "", category: "",
  aadharNumber: "", fatherName: "", husbandName: "", address: "", dateOfJoining: "", designation: "",
});

async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "application/pdf"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return Promise.all((result.assets || []).map(async (asset) => {
    const mime = asset.mimeType || "application/octet-stream";
    const data = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
    return {
      name: asset.name || "document",
      size: asset.size || 0,
      type: mime,
      dataUrl: `data:${mime};base64,${data}`,
      uploadedAt: new Date().toISOString(),
    };
  }));
}

export default function EmployeeAssignmentScreen() {
  const employeesState = useModuleState(EMPLOYEES_NS);
  const designationsState = useModuleState(DESIGNATIONS_NS);
  const banner = useBanner();
  const designations = Array.isArray(designationsState.items) ? designationsState.items : [];
  const employees = Array.isArray(employeesState.items) ? employeesState.items : [];
  const [form, setForm] = useState(emptyForm());
  const [documents, setDocuments] = useState([]);
  const [saving, setSaving] = useState(false);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function addDocuments() {
    try {
      const files = await pickDocument();
      if (files.length) setDocuments((current) => [...current, ...files]);
    } catch (error) {
      banner.showError(error);
    }
  }

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || !form.mobile.trim())
      return banner.showError("Name, email and mobile are required.");
    if (!/^\d{12}$/.test(form.aadharNumber))
      return banner.showError("Aadhaar must contain exactly 12 digits.");
    if (!designations.includes(form.designation))
      return banner.showError("Select a designation from Employee Management.");

    setSaving(true);
    banner.clear();
    try {
      const ids = new Set(employees.map((employee) => employee.id));
      let id;
      do {
        id = `EMP-${new Date().getFullYear()}-${100000 + Math.floor(Math.random() * 900000)}`;
      } while (ids.has(id));
      const marriedWoman = form.gender === "Female" && form.maritalStatus === "Married";
      const record = {
        ...form,
        id,
        fatherName: marriedWoman ? "" : form.fatherName,
        husbandName: marriedWoman ? form.husbandName : "",
        documentsAttached: documents,
        status: "Active",
        createdAt: new Date().toISOString(),
      };
      await employeesState.persist([record, ...employees]);
      setForm(emptyForm());
      setDocuments([]);
      banner.showSuccess(`Employee added. Login ID: ${id}. Initial password: ${id}@MGPS`);
    } catch (error) {
      banner.showError(error);
    } finally {
      setSaving(false);
    }
  }

  const marriedWoman = form.gender === "Female" && form.maritalStatus === "Married";

  return (
    <ScreenShell
      title="Employee Assignment"
      refreshing={employeesState.loading || designationsState.loading}
      onRefresh={() => { employeesState.reload(); designationsState.reload(); }}
    >
      <Hero icon="person-add-outline" title="Assign employee" subtitle="Complete the employee record and choose a designation." />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />
      {!designations.length && <Banner type="error" message="Create a designation in Employee Management before assigning employees." />}
      <Card>
        <Text style={{ fontWeight: "900", marginBottom: 8 }}>1. Core identity & biographical details</Text>
        <TextField label="Employee full name" value={form.name} onChangeText={(v) => setField("name", v)} />
        <TextField label="Official email" value={form.email} onChangeText={(v) => setField("email", v)} keyboardType="email-address" />
        <TextField label="Primary mobile number" value={form.mobile} onChangeText={(v) => setField("mobile", v)} keyboardType="phone-pad" />
        <DateField label="Date of birth" value={form.dob} onChange={(v) => setField("dob", v)} />
        <Select label="Gender" value={form.gender} onChange={(v) => setField("gender", v)} options={["Male", "Female", "Other"]} />
        <Select label="Marital status" value={form.maritalStatus} onChange={(v) => setField("maritalStatus", v)} options={["Single", "Married", "Divorced"]} />
        <Select label="Social category" value={form.category} onChange={(v) => setField("category", v)} options={["General", "OBC", "SC", "ST"]} />
        <TextField label="Aadhaar (12 digits)" value={form.aadharNumber} onChangeText={(v) => setField("aadharNumber", v.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" />
        <TextField
          label={marriedWoman ? "Husband's full name" : "Father's full name"}
          value={marriedWoman ? form.husbandName : form.fatherName}
          onChangeText={(v) => setField(marriedWoman ? "husbandName" : "fatherName", v)}
        />
        <TextField label="Residential address" value={form.address} onChangeText={(v) => setField("address", v)} />
      </Card>
      <Card>
        <Text style={{ fontWeight: "900", marginBottom: 8 }}>2. Joining and designation</Text>
        <DateField label="Official date of joining" value={form.dateOfJoining} onChange={(v) => setField("dateOfJoining", v)} />
        <Select label="Designation" value={form.designation} onChange={(v) => setField("designation", v)} options={designations} />
      </Card>
      <Card>
        <Text style={{ fontWeight: "900", marginBottom: 8 }}>3. Document verification attachments</Text>
        <PrimaryButton label="Attach documents" icon="attach-outline" onPress={addDocuments} />
        {documents.map((file, index) => <Text key={`${file.name}-${index}`} style={{ marginTop: 5 }}>{file.name}</Text>)}
      </Card>
      <PrimaryButton label="Add Employee" icon="person-add-outline" onPress={submit} loading={saving} disabled={!designations.length} />
    </ScreenShell>
  );
}
