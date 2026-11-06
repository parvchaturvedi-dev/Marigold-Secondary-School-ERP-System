import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../shared/theme/colors";
import { gradients, glassColors } from "../../../shared/theme/glass";
import { useTheme } from "../../../theme/ThemeContext";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import { useAuth } from "../../../auth/AuthContext";
import { useDashboardSummary } from "../../../hooks/useDashboardSummary";
import { useUnreadNotifications } from "../../../hooks/useUnreadNotifications";
import { teacherModules } from "../data/teacherModules";
import ModuleCard from "../../../components/cards/ModuleCard";
import AttendanceScreen from "../../../screens/AttendanceScreen";
import { apiRequest } from "../../../api/apiClient";

const logo = require("../../../../assets/images/logo.png");
const width = Dimensions.get("window").width;
const QUICK_ACCESS_EXCLUDED_MODULES = new Set([
  "Academic Calendar",
  "Application",
  "Events",
  "Examination Desk",
  "Id Card",
  "Meetings",
  "Profile",
  "Vault",
  "Certification",
  "About Us",
  "Settings",
]);

function formatClockTime(value, timezone) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export default function TeacherDashboardScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, openConnectedModule } = useAuth();
  const { summary } = useDashboardSummary();
  const unreadCount = useUnreadNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [selectedParentModule, setSelectedParentModule] = useState(null);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [clockStatus, setClockStatus] = useState(null);
  const [clockStatusLoading, setClockStatusLoading] = useState(true);
  const [clockStatusError, setClockStatusError] = useState("");
  const [clockStatusRefresh, setClockStatusRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    if (activeTab !== "home") return undefined;

    apiRequest("/attendance/my-clock-status")
      .then((status) => {
        if (!active) return;
        setClockStatus(status || null);
        setClockStatusError("");
      })
      .catch((error) => {
        if (!active) return;
        setClockStatusError(error?.message || "Attendance status could not be loaded.");
      })
      .finally(() => {
        if (active) setClockStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, clockStatusRefresh]);

  function handleModulePress(module) {
    if (module.title === "Home" || module.title === "Dashboard (Home)") {
      setDrawerOpen(false);
      setSubModalOpen(false);
      setActiveTab("home");
      return;
    }

    if (module.subItems && module.subItems.length > 0) {
      setSelectedParentModule(module);
      setSubModalOpen(true);
    } else {
      setSubModalOpen(false);
      if (module.title === "Profile") {
        openConnectedModule("Profile");
      } else if (module.title === "Notices") {
        openConnectedModule("Notices");
      } else if (module.title === "Attendance") {
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

  function handleTabChange(tab) {
    if (tab === "home") {
      setClockStatusLoading(true);
      setClockStatusError("");
    }
    setActiveTab(tab);
  }

  if (activeTab === "attendance") {
    return <AttendanceScreen role="teacher" onBack={() => handleTabChange("home")} />;
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
              <Ionicons name="menu-outline" size={35} color={palette.headerInk} />
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
                <Ionicons name="notifications-outline" size={28} color={palette.headerInk} />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      right: -6,
                      top: -6,
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      paddingHorizontal: 5,
                      backgroundColor: glassColors.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Active Tab Routing */}
          {activeTab === "home" && (
            <HomeContent
              user={user}
              summary={summary}
              clockStatus={clockStatus}
              clockStatusLoading={clockStatusLoading}
              clockStatusError={clockStatusError}
              onRetryClockStatus={() => {
                setClockStatusLoading(true);
                setClockStatusError("");
                setClockStatusRefresh((current) => current + 1);
              }}
              onMarkAttendance={() => setActiveTab("attendance")}
              onModulePress={handleModulePress}
            />
          )}

        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: Math.max(insets.bottom, 12) + 12,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 58,
            right: 58,
            height: 54,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              height: 50,
              minWidth: 188,
              maxWidth: "100%",
              paddingHorizontal: 14,
              borderRadius: 25,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              shadowColor: palette.shadow,
              shadowOpacity: palette.shadowOpacity,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={palette.accentDeep} />
            <View style={{ marginLeft: 9 }}>
              <Text
                style={{
                  color: palette.inkFaint,
                  fontSize: 9,
                  fontWeight: "900",
                  letterSpacing: 1,
                }}
              >
                TODAY
              </Text>
              <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "800", marginTop: 1 }}>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
        </View>
        {[
          { title: "Profile", icon: "person-outline", label: "Open profile" },
          { title: "Settings", icon: "settings-outline", label: "Open settings" },
        ].map((item) => (
          <TouchableOpacity
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => openConnectedModule(item.title)}
            activeOpacity={0.8}
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              shadowColor: palette.shadow,
              shadowOpacity: palette.shadowOpacity,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <Ionicons name={item.icon} size={25} color={palette.accentDeep} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Drawer Menu */}
      <Drawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        modules={teacherModules}
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

function AttendanceActionButton({ onPress, label }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          borderRadius: 28,
          overflow: "hidden",
          shadowColor: "#4f46e5",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 4,
        }}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            minHeight: 54,
            paddingHorizontal: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles-outline" size={20} color="#fff" style={{ marginRight: 9 }} />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ClockTimeTile({ label, value, icon, color, palette }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 78,
        borderRadius: 15,
        padding: 12,
        backgroundColor: palette.cardSoft,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: `${color}18`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 9,
        }}
      >
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.inkSoft, fontSize: 11, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "900", marginTop: 3 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function HomeContent({
  user,
  summary,
  clockStatus,
  clockStatusLoading,
  clockStatusError,
  onRetryClockStatus,
  onMarkAttendance,
  onModulePress,
}) {
  const { palette } = useTheme();
  const profile = summary?.profile || {};
  const quickAccessModules = teacherModules.filter(
    (module) => !QUICK_ACCESS_EXCLUDED_MODULES.has(module.title)
  );

  const clockedIn = Boolean(clockStatus?.clockedIn);
  const clockedOut = Boolean(clockStatus?.clockedOut || clockStatus?.clockOutAt);
  const hasClockActivity = clockedIn || clockedOut;

  return (
    <View style={{ marginTop: 36 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          borderRadius: 22,
          padding: 18,
          marginBottom: 22,
          shadowColor: palette.shadow,
          shadowOpacity: palette.shadowOpacity,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 3,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 15, color: palette.inkSoft, fontWeight: "600" }}>
            Good Morning, 👋
          </Text>
          <Text
            style={{
              fontSize: 23,
              fontWeight: "900",
              color: palette.ink,
              marginTop: 5,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {user?.name || user?.displayName || "Teacher Portal"}
          </Text>
          <Text style={{ marginTop: 6, color: palette.inkLabel, fontSize: 14 }}>
            {[profile.classLabel || "No class assigned", profile.designation || "Faculty"].filter(Boolean).join(" | ")}
          </Text>
        </View>

        <LinearGradient
          colors={gradients.chip}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 66,
            height: 66,
            borderRadius: 33,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="person" size={48} color="#fff" />
        </LinearGradient>
      </View>

      <View
        style={{
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          shadowColor: palette.shadow,
          shadowOpacity: palette.shadowOpacity,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
          borderRadius: 18,
          padding: 18,
          marginBottom: 26,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <LinearGradient
            colors={gradients.chip}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="time-outline" size={25} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.ink, fontSize: 17, fontWeight: "900" }}>
              Today&apos;s Attendance
            </Text>
            <Text style={{ color: palette.inkSoft, marginTop: 3, fontSize: 13 }}>
              {clockedOut ? "Your attendance is complete" : clockedIn ? "You are currently clocked in" : "Clock in when you arrive at school"}
            </Text>
          </View>
        </View>

        {clockStatusLoading ? (
          <View style={{ minHeight: 54, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: palette.inkSoft, fontSize: 14 }}>Loading attendance...</Text>
          </View>
        ) : clockStatusError ? (
          <View>
            <Text style={{ color: palette.inkSoft, fontSize: 13, marginBottom: 12 }}>
              {clockStatusError}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onRetryClockStatus}
              style={{ alignSelf: "flex-start", paddingVertical: 8 }}
            >
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800" }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : !hasClockActivity ? (
          <AttendanceActionButton onPress={onMarkAttendance} label="Mark your attendance" />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <ClockTimeTile
                label="Clock In"
                value={formatClockTime(clockStatus?.clockInAt, clockStatus?.timezone)}
                icon="log-in-outline"
                color="#16a34a"
                palette={palette}
              />
              <ClockTimeTile
                label="Clock Out"
                value={clockedOut ? formatClockTime(clockStatus?.clockOutAt, clockStatus?.timezone) : "Pending"}
                icon="log-out-outline"
                color="#f97316"
                palette={palette}
              />
            </View>
            {!clockedOut && (
              <TouchableOpacity
                onPress={onMarkAttendance}
                activeOpacity={0.8}
                style={{ alignSelf: "flex-end", marginTop: 12, paddingVertical: 8, paddingHorizontal: 2 }}
              >
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>
                  Open attendance
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
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
        <Text style={{ fontSize: 20, fontWeight: "900", color: palette.ink }}>
          Quick Access
        </Text>
      </View>

      {/* Grid of Teacher Modules */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {quickAccessModules.map((module) => (
          <ModuleCard
            key={module.title}
            title={module.title}
            icon={module.icon}
            color={module.color}
            width="48%"
            onPress={() => onModulePress(module)}
          />
        ))}
      </View>
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
              Marigold Teacher ERP
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
