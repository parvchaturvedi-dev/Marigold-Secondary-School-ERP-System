import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  StyleSheet
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../../shared/theme/colors";
import { gradients, glassColors, glassStyles } from "../../../shared/theme/glass";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import { useAuth } from "../../../auth/AuthContext";
import { useDashboardSummary } from "../../../hooks/useDashboardSummary";
import { adminModules, adminBottomTabs } from "../data/adminModules";
import ModuleCard from "../../../components/cards/ModuleCard";
import OverviewCard from "../../../components/cards/OverviewCard";
import AttendanceScreen from "../../../screens/AttendanceScreen";

const logo = require("../../../../assets/images/logo.png");
const width = Dimensions.get("window").width;

export default function AdminDashboardScreen() {
  const { user, logout, openConnectedModule } = useAuth();
  const { summary, loading, error } = useDashboardSummary();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [selectedParentModule, setSelectedParentModule] = useState(null);
  const [subModalOpen, setSubModalOpen] = useState(false);

  // Helper function to handle module clicks
  function handleModulePress(module) {
    if (module.subItems && module.subItems.length > 0) {
      setSelectedParentModule(module);
      setSubModalOpen(true);
    } else {
      setSubModalOpen(false);
      if (module.title === "Profile") {
        openConnectedModule("Profile");
      } else if (module.title === "Notices") {
        openConnectedModule("Notices");
      } else if (module.title === "Attendance" || module.title === "Biometric Attendance") {
        setActiveTab("attendance");
      } else {
        openConnectedModule(module.title);
      }
    }
  }

  function handleSubItemPress(subItem, parentTitle) {
    setSubModalOpen(false);
    openConnectedModule(`${parentTitle} > ${subItem.title}`);
  }

  if (activeTab === "attendance") {
    return <AttendanceScreen role="admin" onBack={() => setActiveTab("home")} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View
          style={{
            paddingTop: 50,
            paddingHorizontal: 18,
            minHeight: 180,
          }}
        >
          {/* Header Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity onPress={() => setDrawerOpen(true)}>
              <Ionicons name="menu-outline" size={35} color="#0F172A" />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={logo}
                resizeMode="contain"
                style={{ width: 46, height: 46, marginRight: 8 }}
              />
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.primaryDark }}>
                Marigold School ERP
              </Text>
            </View>

            <TouchableOpacity onPress={() => openConnectedModule("Notifications")}>
              <View>
                <Ionicons name="notifications-outline" size={28} color="#0F172A" />
                <View
                  style={{
                    position: "absolute",
                    right: -4,
                    top: -6,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: glassColors.danger,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>
                    5
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Active Tab Routing */}
          {activeTab === "home" && (
            <HomeContent
              user={user}
              summary={summary}
              loading={loading}
              error={error}
              onModulePress={handleModulePress}
            />
          )}

          {activeTab === "profile" && (
            <SimpleTabPage
              title="Profile"
              icon="person-circle-outline"
              text={`${summary?.profile?.designation || "Administrator"} account signed in as ${user?.name || user?.displayName || user?.username || "admin"}.`}
              logout={logout}
            />
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} openConnectedModule={openConnectedModule} />

      {/* Main Drawer Menu */}
      <Drawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        modules={adminModules}
        onModulePress={(module) => {
          setDrawerOpen(false);
          handleModulePress(module);
        }}
        logout={logout}
      />

      {/* Sub-items Modal Popup for Desks */}
      <Modal
        visible={subModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSubModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedParentModule && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalTitleIconBox, { backgroundColor: selectedParentModule.color + "15" }]}>
                    <Ionicons name={selectedParentModule.icon} size={28} color={selectedParentModule.color} />
                  </View>
                  <Text style={styles.modalTitle}>{selectedParentModule.title}</Text>
                  <TouchableOpacity onPress={() => setSubModalOpen(false)} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>Please choose a submodule to open:</Text>

                <View style={styles.subGrid}>
                  {selectedParentModule.subItems.map((subItem) => (
                    <TouchableOpacity
                      key={subItem.title}
                      activeOpacity={0.8}
                      onPress={() => handleSubItemPress(subItem, selectedParentModule.title)}
                      style={styles.subCard}
                    >
                      <View style={[styles.subIconContainer, { backgroundColor: selectedParentModule.color + "15" }]}>
                        <Ionicons name={subItem.icon} size={24} color={selectedParentModule.color} />
                      </View>
                      <Text style={styles.subText}>{subItem.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 16) return "Good Afternoon";
  return "Good Evening";
};

function HomeContent({ user, summary, loading, error, onModulePress }) {
  const profile = summary?.profile || {};
  const action = summary?.action || {};
  const stats = summary?.stats?.length
    ? summary.stats
    : [
        { title: "Students", value: loading ? "..." : "0", subtitle: "Enrolled", color: "#22C55E" },
        { title: "Teachers", value: loading ? "..." : "0", subtitle: "Active", color: "#F97316" },
        { title: "Notices", value: loading ? "..." : "0", subtitle: "Unread", color: "#2563EB" },
      ];

  return (
    <View style={{ marginTop: 36 }}>
      {/* Good Morning Greeting Card */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <View>
          <Text style={{ fontSize: 18, color: "#0F172A" }}>{getGreeting()}</Text>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "900",
              color: "#0F172A",
              marginTop: 8,
            }}
          >
            {user?.name || "Administrator"}
          </Text>
          <Text style={{ marginTop: 8, color: "#475569", fontSize: 16 }}>
            {profile.designation || "Administrator"} | {profile.classLabel || "System administration"}
          </Text>
        </View>

        <LinearGradient
          colors={gradients.chip}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 86,
            height: 86,
            borderRadius: 43,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="shield-checkmark" size={48} color="#fff" />
        </LinearGradient>
      </View>

      {/* Admin Action Card */}
      <View
        style={{
          ...glassStyles.card,
          borderRadius: 18,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 26,
        }}
      >
        <LinearGradient
          colors={gradients.chip}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 54,
            height: 54,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16,
          }}
        >
          <Ionicons name="construct-outline" size={30} color="#fff" />
        </LinearGradient>

        <View style={{ flex: 1 }}>
          <Text style={{ color: "#0F172A", fontSize: 15, fontWeight: "800" }}>
            {action.label || "System Directory"}
          </Text>
          <Text
            style={{
              color: "#0F172A",
              fontSize: 21,
              fontWeight: "900",
              marginTop: 4,
            }}
          >
            {action.title || "No directory data"}
          </Text>
          <Text style={{ color: "#64748B", marginTop: 6, fontSize: 15 }}>
            {error || action.subtitle || "Live ERP data"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => onModulePress({ title: "Users Management" })}
          style={{
            backgroundColor: "rgba(99,102,241,0.12)",
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "800" }}>
            Manage Users
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Access Title */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#0F172A" }}>
          Quick Access
        </Text>
      </View>

      {/* Grid of Admin Modules */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {adminModules.map((module) => (
          <ModuleCard
            key={module.title}
            title={module.title}
            icon={module.icon}
            color={module.color}
            onPress={() => onModulePress(module)}
          />
        ))}
      </View>

      {/* Overview/Statistics Title */}
      <Text
        style={{
          fontSize: 20,
          fontWeight: "900",
          color: "#0F172A",
          marginTop: 16,
          marginBottom: 14,
        }}
      >
        School Overview
      </Text>

      {/* 3 Columns matching original Student layout */}
      <View style={{ flexDirection: "row", marginHorizontal: -5 }}>
        {stats.map((item) => (
          <OverviewCard key={item.title} title={item.title} value={item.value} subtitle={item.subtitle} color={item.color} loading={loading} />
        ))}
      </View>
    </View>
  );
}

function SimpleTabPage({ title, icon, text, logout }) {
  return (
    <View style={{ marginTop: 60 }}>
      <View
        style={{
          ...glassStyles.card,
          borderRadius: 24,
          padding: 28,
          alignItems: "center",
        }}
      >
        <Ionicons name={icon} size={70} color={colors.primaryDark} />
        <Text
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: "900",
            color: "#0F172A",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            textAlign: "center",
            marginTop: 12,
            fontSize: 16,
            lineHeight: 24,
            color: "#64748B",
          }}
        >
          {text}
        </Text>

        {logout && (
          <TouchableOpacity
            onPress={logout}
            style={{
              marginTop: 24,
              backgroundColor: glassColors.danger,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab, openConnectedModule }) {
  const moduleTargets = {
    users: "Users Management",
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
      {adminBottomTabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => {
              if (moduleTargets[tab.key]) {
                openConnectedModule(moduleTargets[tab.key]);
                return;
              }
              setActiveTab(tab.key);
            }}
            style={{ alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons
              name={active ? tab.icon.replace("-outline", "") : tab.icon}
              size={27}
              color={active ? "#4F46E5" : "#64748B"}
            />
            <Text
              style={{
                marginTop: 5,
                fontSize: 12,
                fontWeight: active ? "900" : "600",
                color: active ? "#4F46E5" : "#64748B",
              }}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Drawer({ visible, onClose, modules, onModulePress, logout }) {
  const [expandedModule, setExpandedModule] = useState(null);

  function toggleExpand(title) {
    if (expandedModule === title) {
      setExpandedModule(null);
    } else {
      setExpandedModule(title);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View
          style={{
            width: width * 0.82,
            backgroundColor: "#fff",
            paddingTop: 52,
            paddingHorizontal: 16,
            elevation: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 26, paddingHorizontal: 4 }}>
            <Image source={logo} resizeMode="contain" style={{ width: 52, height: 52 }} />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 17,
                fontWeight: "900",
                color: "#102A83",
              }}
            >
              Marigold Admin ERP
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Direct Home Module */}
            <DrawerItem
              title="Dashboard (Home)"
              icon="home"
              color="#4F46E5"
              onPress={() => onModulePress({ title: "Home" })}
            />

            {/* List all items */}
            {modules.map((module) => {
              const hasSub = module.subItems && module.subItems.length > 0;
              const isExpanded = expandedModule === module.title;

              return (
                <View key={module.title}>
                  <DrawerItem
                    title={module.title}
                    icon={module.icon}
                    color={module.color}
                    hasSub={hasSub}
                    isExpanded={isExpanded}
                    onPress={() => {
                      if (hasSub) {
                        toggleExpand(module.title);
                      } else {
                        onModulePress(module);
                      }
                    }}
                  />

                  {/* Sub items indent mapping if expanded */}
                  {hasSub && isExpanded && (
                    <View style={{ paddingLeft: 22, borderLeftWidth: 1.5, borderLeftColor: "#E2E8F0", marginLeft: 20, marginVertical: 4 }}>
                      {module.subItems.map((subItem) => (
                        <TouchableOpacity
                          key={subItem.title}
                          onPress={() => {
                            onClose();
                            onModulePress({ title: `${module.title} > ${subItem.title}` });
                          }}
                          style={styles.subDrawerItem}
                        >
                          <Ionicons name={subItem.icon} size={18} color={module.color} />
                          <Text style={styles.subDrawerItemText}>{subItem.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 18 }} />
            <DrawerItem
              title="Logout"
              icon="log-out-outline"
              color="#DC2626"
              onPress={logout}
            />
          </ScrollView>
        </View>

        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.25)" }}
        />
      </View>
    </Modal>
  );
}

function DrawerItem({ title, icon, color, active, hasSub, isExpanded, onPress }) {
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
      <Text
        style={{
          marginLeft: 14,
          fontSize: 15,
          color: active ? "#3949FF" : "#475569",
          fontWeight: active ? "900" : "700",
          flex: 1
        }}
      >
        {title}
      </Text>

      {hasSub && (
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#94A3B8"
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 }
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    flex: 1
  },
  closeButton: {
    padding: 4
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20
  },
  subGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  subCard: {
    width: "48%",
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    marginBottom: 12
  },
  subIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8
  },
  subText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center"
  },
  subDrawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2
  },
  subDrawerItemText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#475569",
    fontWeight: "600"
  }
});
