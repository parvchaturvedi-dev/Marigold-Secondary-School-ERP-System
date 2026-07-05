// About Us — developer / version / release info, available to every role.
// ConnectedModuleScreen wraps registered screens with AuroraBackground + a
// back/home PageHeader, so this screen renders only its own scroll content.
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import GlassCard from "../../../shared/components/GlassCard";
import { useTheme } from "../../../theme/ThemeContext";
import { gradients } from "../../../shared/theme/glass";
import { colors } from "../../../shared/theme/colors";

const DETAILS = [
  { icon: "pricetag-outline", label: "Version", value: "1.0.0" },
  { icon: "calendar-outline", label: "Release Date", value: "05 July 2026" },
  { icon: "phone-portrait-outline", label: "Platform", value: "React Native / Expo" },
];

export default function AboutScreen() {
  const { palette } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GlassCard style={styles.card}>
        <View style={styles.inner}>
          <LinearGradient
            colors={gradients.chip}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Ionicons name="school-outline" size={40} color="#fff" />
          </LinearGradient>

          <Text style={[styles.appName, { color: palette.ink }]}>
            MGPS ERP — Marigold Secondary School
          </Text>
          <Text style={[styles.desc, { color: palette.inkSoft }]}>
            A unified school management portal connecting administrators, clerks,
            teachers and students in one place.
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={styles.inner}>
          <Ionicons name="person-circle-outline" size={30} color={colors.primary} />
          <Text style={[styles.devLabel, { color: palette.inkSoft }]}>Developed by</Text>
          <Text style={[styles.devName, { color: palette.ink }]}>Parv Chaturvedi</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={styles.detailsInner}>
          {DETAILS.map((item) => (
            <View key={item.label} style={[styles.detailRow, { borderBottomColor: palette.cardBorder }]}>
              <View style={styles.detailLeft}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
                <Text style={[styles.detailLabel, { color: palette.inkSoft }]}>{item.label}</Text>
              </View>
              <Text style={[styles.detailValue, { color: palette.ink }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <Text style={[styles.copyright, { color: palette.inkFaint }]}>
        © 2026 Parv Chaturvedi
      </Text>
    </ScrollView>
  );
}

const styles = {
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 20, marginBottom: 14 },
  inner: { padding: 22, alignItems: "center" },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: { fontSize: 19, fontWeight: "900", textAlign: "center" },
  desc: { marginTop: 10, fontSize: 14, lineHeight: 21, textAlign: "center", fontWeight: "600" },
  devLabel: { marginTop: 12, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  devName: { marginTop: 4, fontSize: 20, fontWeight: "900" },
  detailsInner: { paddingHorizontal: 18, paddingVertical: 6 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  detailLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailLabel: { fontSize: 13, fontWeight: "800" },
  detailValue: { fontSize: 14, fontWeight: "900" },
  copyright: { textAlign: "center", marginTop: 4, fontSize: 12, fontWeight: "700" },
};
