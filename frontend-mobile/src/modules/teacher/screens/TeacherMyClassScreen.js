import React, { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiRequest } from "../../../api/apiClient";
import { useAuth } from "../../../auth/AuthContext";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Card,
  Divider,
  EmptyState,
  LoadingCard,
  ScreenShell,
  SectionTitle,
} from "../../../screens/modules/shared/formKit";

const valueOrFallback = (value) => (String(value || "").trim() ? String(value).trim() : "Not provided");

const getStudentDetails = (student = {}) => [
  ["Roll Number", student.rollNo],
  ["Admission Number", student.admissionNumber],
  ["Class / Section", [student.className, student.section].filter(Boolean).join(" / ")],
  ["Father's Name", student.fatherName],
  ["Mother's Name", student.motherName],
  ["Student Mobile", student.studentMobile],
  ["Father's Mobile", student.fatherMobile],
  ["Mother's Mobile", student.motherMobile],
  ["Guardian Name", student.guardianName],
  ["Guardian Mobile", student.guardianPhone],
  ["Email", student.email],
  ["Guardian Email", student.guardianEmail],
  ["Address", student.address],
  ["Date of Birth", student.dob],
  ["Gender", student.gender],
];

export default function TeacherMyClassScreen() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const assignedClassNames = useMemo(() => {
    const assignments = Array.isArray(user?.teacherProfile?.classAssignments)
      ? user.teacherProfile.classAssignments
      : Array.isArray(user?.classAssignments)
        ? user.classAssignments
        : [];
    const names = [
      ...(Array.isArray(user?.allottedClasses) ? user.allottedClasses : []),
      user?.assignedClassTeacherFor,
      user?.teacherProfile?.assignedClassTeacherFor,
      ...assignments.map((assignment) =>
        assignment?.className || assignment?.class || assignment?.targetClass
      ),
    ];
    const unique = new Map();
    names.forEach((value) => {
      const name = String(value || "").trim();
      const key = name.toLowerCase();
      if (key && !unique.has(key)) unique.set(key, name);
    });
    return [...unique.values()];
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadClasses = async () => {
      try {
        const responses = await Promise.allSettled(
          assignedClassNames.map((className) =>
            apiRequest(`/class-info?className=${encodeURIComponent(className)}`)
          )
        );
        const loadedClasses = responses
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .flatMap((data) => (Array.isArray(data?.classes) ? data.classes : [data]))
          .filter((classInfo) => classInfo?.className);
        const failedRequests = responses.filter((result) => result.status === "rejected");

        if (!active) return;
        setClasses(loadedClasses);
        if (loadedClasses.length) {
          setError(
            failedRequests.length
              ? "Some assigned class details could not be loaded. Pull down to retry."
              : ""
          );
        } else if (failedRequests.length) {
          const firstFailure = failedRequests[0];
          setError(firstFailure.reason?.message || "Could not load your class details.");
        } else {
          setError("No class assignments were found for this account.");
        }
      } catch (requestError) {
        if (active) setError(requestError?.message || "Could not load your class details.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadClasses();

    return () => {
      active = false;
    };
  }, [assignedClassNames, refreshKey]);

  const refresh = () => {
    setError("");
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
  };

  return (
    <ScreenShell title="My Class" refreshing={refreshing} onRefresh={refresh}>
      <SectionTitle>Assigned Classes</SectionTitle>
      {error ? (
        <Card>
          <Text style={{ color: palette.danger || "#DC2626", fontWeight: "700" }}>{error}</Text>
        </Card>
      ) : null}

      {loading ? (
        <LoadingCard text="Loading your classes..." />
      ) : classes.length ? (
        classes.map((classInfo) => {
          const roster = Array.isArray(classInfo.roster) ? classInfo.roster : [];
          const subjects = Array.isArray(classInfo.subjects) ? classInfo.subjects : [];
          return (
            <Card key={classInfo.className}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.ink, fontSize: 20, fontWeight: "900" }}>
                    {classInfo.className}
                  </Text>
                  <Text style={{ color: palette.inkSoft, marginTop: 4 }}>
                    {roster.length} student{roster.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <Ionicons name="people-outline" size={26} color={palette.accentDeep} />
              </View>

              <Divider />
              <Text style={{ color: palette.ink, fontWeight: "800" }}>Class Teacher</Text>
              <Text style={{ color: palette.inkSoft, marginTop: 3 }}>
                {classInfo.classTeacher || "Not assigned"}
              </Text>

              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.ink, fontWeight: "800", marginBottom: 8 }}>
                  Subjects & Teachers
                </Text>
                {subjects.length ? (
                  subjects.map((item, index) => (
                    <View
                      key={`${item.subject}-${index}`}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 8,
                        borderBottomWidth: index === subjects.length - 1 ? 0 : 1,
                        borderBottomColor: palette.cardBorder,
                      }}
                    >
                      <Text style={{ color: palette.ink, flex: 1, fontWeight: "700" }}>
                        {item.subject}
                      </Text>
                      <Text style={{ color: palette.inkSoft, flex: 1, textAlign: "right" }}>
                        {item.teacher || "Teacher not assigned"}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: palette.inkFaint }}>No subjects mapped yet.</Text>
                )}
              </View>

              <View style={{ marginTop: 18 }}>
                <Text style={{ color: palette.ink, fontWeight: "800", marginBottom: 8 }}>
                  Students
                </Text>
                {roster.length ? (
                  roster.map((student, index) => (
                    <View
                      key={student.admissionNumber || `${student.displayName}-${index}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderTopWidth: index ? 1 : 0,
                        borderTopColor: palette.cardBorder,
                      }}
                    >
                      <View
                        style={{
                          minWidth: 42,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRadius: 12,
                          backgroundColor: palette.tile,
                          alignItems: "center",
                          marginRight: 10,
                        }}
                      >
                        <Text style={{ color: palette.accentDeep, fontWeight: "900" }}>
                          {student.rollNo || "-"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.ink, fontWeight: "800" }}>
                          {student.displayName || "Unnamed student"}
                        </Text>
                        {student.section ? (
                          <Text style={{ color: palette.inkFaint, fontSize: 12 }}>
                            Section {student.section}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() =>
                          setSelectedStudent({ ...student, className: classInfo.className })
                        }
                        style={{
                          paddingHorizontal: 11,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: palette.tile,
                        }}
                      >
                        <Text style={{ color: palette.accentDeep, fontWeight: "800", fontSize: 12 }}>
                          View Profile
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <EmptyState
                    icon="person-outline"
                    title="No students found"
                    text="Students assigned to this class will appear here."
                  />
                )}
              </View>
            </Card>
          );
        })
      ) : !error ? (
        <EmptyState
          icon="people-outline"
          title="No classes assigned"
          text="Your class and subject assignments will appear here."
        />
      ) : null}

      <Modal
        visible={Boolean(selectedStudent)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(15, 23, 42, 0.48)",
          }}
        >
          <View
            style={{
              maxHeight: "88%",
              backgroundColor: palette.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.inkFaint, fontSize: 12, fontWeight: "800" }}>
                  STUDENT PROFILE
                </Text>
                <Text style={{ color: palette.ink, fontSize: 21, fontWeight: "900", marginTop: 4 }}>
                  {selectedStudent?.displayName || "Student"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedStudent(null)}
                accessibilityRole="button"
                accessibilityLabel="Close student profile"
                style={{ padding: 8 }}
              >
                <Ionicons name="close-circle" size={28} color={palette.inkFaint} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {getStudentDetails(selectedStudent || {}).map(([label, value], index) => (
                <View key={label}>
                  {index ? <Divider /> : null}
                  <View style={{ paddingVertical: 9 }}>
                    <Text style={{ color: palette.inkFaint, fontSize: 11, fontWeight: "800" }}>
                      {label.toUpperCase()}
                    </Text>
                    <Text style={{ color: palette.ink, fontSize: 14, fontWeight: "700", marginTop: 4 }}>
                      {valueOrFallback(value)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}
