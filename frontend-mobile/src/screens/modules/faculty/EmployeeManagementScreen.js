import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import {
  Banner,
  Card,
  DateField,
  EmptyState,
  Hero,
  PrimaryButton,
  ScreenShell,
  Select,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";
import { useTheme } from "../../../theme/ThemeContext";

const EMPLOYEES_NS = "admin-employee-management-list";
const DESIGNATIONS_NS = "admin-employee-designations";

const EMPTY_RECORD = {
  name: "", email: "", mobile: "", dob: "", gender: "", maritalStatus: "", category: "",
  aadharNumber: "", fatherName: "", husbandName: "", address: "", dateOfJoining: "",
  designation: "", status: "Active",
};

export default function EmployeeManagementScreen() {
  const { palette } = useTheme();
  const banner = useBanner();
  const employeeState = useModuleState(EMPLOYEES_NS);
  const designationState = useModuleState(DESIGNATIONS_NS);
  const employees = useMemo(
    () => (Array.isArray(employeeState.items) ? employeeState.items : []),
    [employeeState.items]
  );
  const designations = Array.isArray(designationState.items) ? designationState.items : [];
  const [designationDraft, setDesignationDraft] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      `${employee.name} ${employee.id} ${employee.designation} ${employee.email}`.toLowerCase().includes(term)
    );
  }, [employees, search]);

  async function addDesignation() {
    const name = designationDraft.trim();
    if (!name) return banner.showError("Enter a designation name.");
    if (designations.some((item) => item.toLowerCase() === name.toLowerCase()))
      return banner.showError("This designation already exists.");
    setSaving(true);
    try {
      await designationState.persist([...designations, name].sort((a, b) => a.localeCompare(b)));
      setDesignationDraft("");
      banner.showSuccess("Designation added.");
    } catch (error) {
      banner.showError(error);
    } finally {
      setSaving(false);
    }
  }

  function removeDesignation(name) {
    if (employees.some((employee) => employee.designation === name))
      return banner.showError("Reassign employees before removing this designation.");
    Alert.alert("Remove designation", `Remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await designationState.persist(designations.filter((item) => item !== name));
            banner.showSuccess("Designation removed.");
          } catch (error) {
            banner.showError(error);
          }
        },
      },
    ]);
  }

  function saveEdit() {
    if (!editing?.name?.trim() || !editing?.email?.trim() || !editing?.mobile?.trim())
      return banner.showError("Name, email and mobile are required.");
    if (!/^\d{12}$/.test(String(editing.aadharNumber || "")))
      return banner.showError("Aadhaar must contain exactly 12 digits.");
    if (!designations.includes(editing.designation))
      return banner.showError("Select a valid designation.");
    setSaving(true);
    employeeState.persist(employees.map((item) => item.id === editing.id ? editing : item))
      .then(() => {
        setEditing(null);
        banner.showSuccess("Employee updated.");
      })
      .catch(banner.showError)
      .finally(() => setSaving(false));
  }

  function removeEmployee(employee) {
    Alert.alert("Remove employee", `Remove ${employee.name} and disable their login?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await employeeState.persist(employees.filter((item) => item.id !== employee.id));
            banner.showSuccess("Employee removed.");
          } catch (error) {
            banner.showError(error);
          }
        },
      },
    ]);
  }

  return (
    <ScreenShell
      title="Employee Management"
      refreshing={employeeState.loading || designationState.loading}
      onRefresh={() => { employeeState.reload(); designationState.reload(); }}
    >
      <Hero icon="briefcase-outline" title={`${employees.length} employees`} subtitle="Edit or remove staff and manage available designations." />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />
      <Card>
        <TextField label="Add designation" value={designationDraft} onChangeText={setDesignationDraft} hint="Designation name" />
        <PrimaryButton label="Add Designation" icon="add-outline" onPress={addDesignation} loading={saving} />
        {designations.map((name) => (
          <View key={name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5 }}>
            <Text style={{ color: palette.ink, fontWeight: "700" }}>{name}</Text>
            <SmallButton label="Remove" icon="trash-outline" tone="danger" onPress={() => removeDesignation(name)} />
          </View>
        ))}
      </Card>
      {editing && (
        <Card>
          <Text style={{ color: palette.ink, fontWeight: "900", marginBottom: 8 }}>Edit {editing.name}</Text>
          <TextField label="Full name" value={editing.name} onChangeText={(value) => setEditing({ ...editing, name: value })} />
          <TextField label="Official email" value={editing.email} onChangeText={(value) => setEditing({ ...editing, email: value })} keyboardType="email-address" />
          <TextField label="Mobile" value={editing.mobile} onChangeText={(value) => setEditing({ ...editing, mobile: value })} keyboardType="phone-pad" />
          <DateField label="Date of birth" value={editing.dob} onChange={(value) => setEditing({ ...editing, dob: value })} />
          <Select label="Gender" value={editing.gender} onChange={(value) => setEditing({ ...editing, gender: value })} options={["Male", "Female", "Other"]} />
          <Select label="Marital status" value={editing.maritalStatus} onChange={(value) => setEditing({ ...editing, maritalStatus: value })} options={["Single", "Married", "Divorced"]} />
          <Select label="Social category" value={editing.category} onChange={(value) => setEditing({ ...editing, category: value })} options={["General", "OBC", "SC", "ST"]} />
          <TextField label="Aadhaar (12 digits)" value={editing.aadharNumber} onChangeText={(value) => setEditing({ ...editing, aadharNumber: value.replace(/\D/g, "").slice(0, 12) })} keyboardType="number-pad" />
          <TextField
            label={editing.gender === "Female" && editing.maritalStatus === "Married" ? "Husband's name" : "Father's name"}
            value={editing.gender === "Female" && editing.maritalStatus === "Married" ? editing.husbandName : editing.fatherName}
            onChangeText={(value) => setEditing({
              ...editing,
              ...(editing.gender === "Female" && editing.maritalStatus === "Married" ? { husbandName: value } : { fatherName: value }),
            })}
          />
          <TextField label="Address" value={editing.address} onChangeText={(value) => setEditing({ ...editing, address: value })} />
          <DateField label="Date of joining" value={editing.dateOfJoining} onChange={(value) => setEditing({ ...editing, dateOfJoining: value })} />
          <Select label="Designation" value={editing.designation} onChange={(value) => setEditing({ ...editing, designation: value })} options={designations} />
          <Select label="Status" value={editing.status || "Active"} onChange={(value) => setEditing({ ...editing, status: value })} options={["Active", "Inactive"]} />
          <PrimaryButton label="Save Changes" icon="save-outline" onPress={saveEdit} loading={saving} />
          <SmallButton label="Cancel edit" icon="close-outline" onPress={() => setEditing(null)} />
        </Card>
      )}
      <Card>
        <TextField label="Search employees" value={search} onChangeText={setSearch} />
      </Card>
      {filtered.length ? filtered.map((employee) => (
        <Card key={employee.id}>
          <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "900" }}>{employee.name}</Text>
          <Text style={{ color: palette.inkSoft, marginTop: 3 }}>{employee.id} · {employee.designation}</Text>
          <Text style={{ color: palette.inkSoft, marginTop: 3 }}>{employee.email} · {employee.mobile}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <SmallButton label="Edit" icon="create-outline" onPress={() => setEditing({ ...EMPTY_RECORD, ...employee })} />
            <SmallButton label="Remove" icon="trash-outline" tone="danger" onPress={() => removeEmployee(employee)} />
          </View>
        </Card>
      )) : (
        <EmptyState title="No employees" message="Employee assignments will appear here." />
      )}
    </ScreenShell>
  );
}
