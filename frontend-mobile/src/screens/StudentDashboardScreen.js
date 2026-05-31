import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../auth/AuthContext";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { studentModules, bottomTabs } from "../data/modules";
import ModuleCard from "../components/cards/ModuleCard";
import OverviewCard from "../components/cards/OverviewCard";
import { getActiveStudentProfile } from "../shared/profile";

const logo = require("../../assets/images/logo.png");
const width = Dimensions.get("window").width;

const emptyStats = (loading) => [
  { title: "Attendance", value: loading ? "..." : "0%", subtitle: "No data", color: "#22C55E" },
  { title: "Assignments", value: loading ? "..." : "0", subtitle: "Active", color: "#F97316" },
  { title: "Notices", value: loading ? "..." : "0", subtitle: "Unread", color: "#2563EB" },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 16) return "Good Afternoon";
  return "Good Evening";
};

export default function StudentDashboardScreen() {
  const { user, logout, openStudentModule, selectStudent } = useAuth();
  const { summary, loading, error } = useDashboardSummary();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  function openModule(title) {
    if (title === "Home" || title === "Dashboard (Home)") return setActiveTab("home");
    if (title === "Profile") return openStudentModule("Profile");
    openStudentModule(title);
  }

  const noticeCount = summary?.stats?.find((item) => item.title === "Notices")?.value || "0";

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <LinearGradient colors={["#F8FAFF", "#FFFFFF"]} style={{ paddingTop: 50, paddingHorizontal: 18, minHeight: 180 }}>
          <Header onMenu={() => setDrawerOpen(true)} onNotices={() => openModule("Notifications")} noticeCount={noticeCount} />

          {activeTab === "home" && (
            <HomeContent user={user} summary={summary} loading={loading} error={error} openModule={openModule} />
          )}

          {activeTab === "profile" && (
            <SimpleTabPage
              title="Profile"
              icon="person-circle-outline"
              profile={getActiveStudentProfile(user)}
              logout={logout}
            />
          )}
        </LinearGradient>
      </ScrollView>

      <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} openModule={openModule} />

      <Drawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        openModule={(title) => {
          setDrawerOpen(false);
          openModule(title);
        }}
        user={user}
        selectStudent={selectStudent}
        logout={logout}
      />
    </View>
  );
}

function Header({ onMenu, onNotices, noticeCount }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <TouchableOpacity onPress={onMenu}>
        <Ionicons name="menu-outline" size={35} color="#0F172A" />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Image source={logo} resizeMode="contain" style={{ width: 46, height: 46, marginRight: 8 }} />
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#102A83" }}>Marigold School ERP</Text>
      </View>

      <TouchableOpacity onPress={onNotices}>
        <View>
          <Ionicons name="notifications-outline" size={28} color="#0F172A" />
          <View
            style={{
              position: "absolute",
              right: -4,
              top: -6,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#EF4444",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 5,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{noticeCount}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function HomeContent({ user, summary, loading, error, openModule }) {
  const activeStudent = getActiveStudentProfile(user) || {};
  const profile = summary?.profile || {};
  const action = summary?.action || {};
  const stats = summary?.stats?.length ? summary.stats : emptyStats(loading);
  const studentName = profile.displayName || activeStudent.displayName || user?.displayName || user?.name || "Student";
  const classLabel =
    profile.classLabel ||
    [activeStudent.className, activeStudent.section].filter(Boolean).join(" - ") ||
    "Class not assigned";
  const rollNo = profile.rollNo || activeStudent.rollNo || "-";

  return (
    <View style={{ marginTop: 36 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 18, color: "#0F172A" }}>{getGreeting()}</Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: "#0F172A", marginTop: 8 }}>{studentName}</Text>
          <Text style={{ marginTop: 8, color: "#475569", fontSize: 16 }}>
            {classLabel} | Roll No. {rollNo}
          </Text>
        </View>

        <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: "#DBE4FF", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="person" size={48} color="#4F46E5" />
        </View>
      </View>

      <ActionCard
        icon="checkbox-outline"
        label={action.label || "Today Attendance"}
        title={action.title || "Not marked"}
        subtitle={error || action.subtitle || "Live ERP data"}
        button="Open Attendance"
        onPress={() => openModule("Attendance")}
      />

      <SectionTitle title="Quick Access" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {studentModules.map((module) => (
          <ModuleCard key={module.title} title={module.title} icon={module.icon} color={module.color} onPress={() => openModule(module.title)} />
        ))}
      </View>

      <Text style={{ fontSize: 20, fontWeight: "900", color: "#0F172A", marginTop: 16, marginBottom: 14 }}>Today Overview</Text>
      <View style={{ flexDirection: "row", marginHorizontal: -5 }}>
        {stats.map((item) => (
          <OverviewCard key={item.title} title={item.title} value={item.value} subtitle={item.subtitle} color={item.color} />
        ))}
      </View>
    </View>
  );
}

function ActionCard({ icon, label, title, subtitle, button, onPress }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        elevation: 3,
        shadowColor: "#1E293B",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        borderWidth: 1,
        borderColor: "#EEF2F7",
        marginBottom: 26,
      }}
    >
      <View style={{ width: 54, height: 54, borderRadius: 17, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
        <Ionicons name={icon} size={30} color="#4F46E5" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: "#0F172A", fontSize: 15, fontWeight: "800" }}>{label}</Text>
        <Text style={{ color: "#0F172A", fontSize: 21, fontWeight: "900", marginTop: 4 }}>{title}</Text>
        <Text style={{ color: "#64748B", marginTop: 6, fontSize: 15 }}>{subtitle}</Text>
      </View>

      <TouchableOpacity onPress={onPress} style={{ backgroundColor: "#F4F6FF", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 }}>
        <Text style={{ color: "#3949FF", fontWeight: "800" }}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionTitle({ title }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: "900", color: "#0F172A" }}>{title}</Text>
    </View>
  );
}

function SimpleTabPage({ title, icon, text, profile, logout }) {
  return (
    <View style={{ marginTop: 60 }}>
      <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", elevation: 3, borderWidth: 1, borderColor: "#EEF2F7" }}>
        <Ionicons name={icon} size={70} color="#4F46E5" />
        <Text style={{ marginTop: 20, fontSize: 28, fontWeight: "900", color: "#0F172A" }}>{title}</Text>
        {profile ? (
          <View style={{ alignSelf: "stretch", marginTop: 16 }}>
            <ProfileRow label="Name" value={profile.displayName} />
            <ProfileRow label="Admission ID" value={profile.admissionNumber || profile.id} />
            <ProfileRow label="Class" value={[profile.className, profile.section].filter(Boolean).join(" - ")} />
            <ProfileRow label="Roll No." value={profile.rollNo} />
            <ProfileRow label="Father" value={profile.fatherName} />
            <ProfileRow label="Mother" value={profile.motherName} />
            <ProfileRow label="Contact" value={profile.guardianPhone} />
            <ProfileRow label="Email" value={profile.guardianEmail} />
            <ProfileRow label="Address" value={profile.address} />
          </View>
        ) : (
          <Text style={{ textAlign: "center", marginTop: 12, fontSize: 16, lineHeight: 24, color: "#64748B" }}>{text}</Text>
        )}

        {logout && (
          <TouchableOpacity onPress={logout} style={{ marginTop: 24, backgroundColor: "#EF4444", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}>
            <Text style={{ color: "#fff", fontWeight: "900" }}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ProfileRow({ label, value }) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EEF2F7" }}>
      <Text style={{ color: "#64748B", fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: "#0F172A", fontSize: 15, fontWeight: "900", marginTop: 3 }}>{value || "Not updated"}</Text>
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab, openModule }) {
  const moduleTargets = {
    assignment: "Assignment",
    notices: "Notices",
    profile: "Profile",
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 82,
        backgroundColor: "#fff",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        elevation: 12,
        borderTopWidth: 1,
        borderTopColor: "#EEF2F7",
      }}
    >
      {bottomTabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => {
              if (moduleTargets[tab.key]) {
                openModule(moduleTargets[tab.key]);
                return;
              }
              setActiveTab(tab.key);
            }}
            style={{ alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={active ? tab.icon.replace("-outline", "") : tab.icon} size={27} color={active ? "#4F46E5" : "#64748B"} />
            <Text style={{ marginTop: 5, fontSize: 12, fontWeight: active ? "900" : "600", color: active ? "#4F46E5" : "#64748B" }}>{tab.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Drawer({ visible, onClose, openModule, user, selectStudent, logout }) {
  const students = Array.isArray(user?.studentProfiles) ? user.studentProfiles : [];
  const activeStudent = getActiveStudentProfile(user);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ width: width * 0.78, backgroundColor: "#fff", paddingTop: 52, paddingHorizontal: 18, elevation: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 26 }}>
            <Image source={logo} resizeMode="contain" style={{ width: 52, height: 52 }} />
            <Text style={{ marginLeft: 10, fontSize: 17, fontWeight: "900", color: "#102A83" }}>Marigold School ERP</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {students.length > 1 && (
              <View style={{ backgroundColor: "#F8FAFF", borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#EEF2F7" }}>
                <Text style={{ color: "#64748B", fontSize: 11, fontWeight: "900", marginBottom: 8 }}>Select Student</Text>
                {students.map((student) => {
                  const isActive = (student.id || student.admissionNumber) === (activeStudent?.id || activeStudent?.admissionNumber);
                  return (
                    <TouchableOpacity
                      key={student.id || student.admissionNumber}
                      onPress={() => selectStudent(student.id || student.admissionNumber)}
                      style={{ paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, backgroundColor: isActive ? "#EEF2FF" : "transparent" }}
                    >
                      <Text style={{ color: isActive ? "#3949FF" : "#0F172A", fontWeight: "900" }}>{student.displayName || student.name}</Text>
                      <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{student.className || "Class not assigned"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <DrawerItem title="Dashboard (Home)" icon="home" color="#4F46E5" active onPress={() => openModule("Home")} />
            {studentModules.map((module) => (
              <DrawerItem key={module.title} title={module.title} icon={module.icon} color={module.color} onPress={() => openModule(module.title)} />
            ))}
            <View style={{ height: 18 }} />
            <DrawerItem title="Logout" icon="log-out-outline" color="#DC2626" onPress={logout} />
          </ScrollView>
        </View>

        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.25)" }} />
      </View>
    </Modal>
  );
}

function DrawerItem({ title, icon, color, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 4,
        backgroundColor: active ? "#EEF2FF" : "transparent",
      }}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ marginLeft: 14, fontSize: 15, color: active ? "#3949FF" : "#475569", fontWeight: active ? "900" : "700" }}>{title}</Text>
    </TouchableOpacity>
  );
}
