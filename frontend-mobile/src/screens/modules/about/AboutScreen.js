// About Us — developer / version / release info, available to every role.
// ConnectedModuleScreen wraps registered screens with AuroraBackground + a
// back/home PageHeader, so this screen renders only its own scroll content.
import React from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GlassCard from "../../../shared/components/GlassCard";
import { useTheme } from "../../../theme/ThemeContext";
import { colors } from "../../../shared/theme/colors";

const schoolLogo = require("../../../../assets/images/logo.png");

const DETAILS = [
  { icon: "pricetag-outline", label: "Version", value: "1.0.1" },
  { icon: "calendar-outline", label: "Release Date", value: "07 November 2026" },
];

export default function AboutScreen() {
  const { palette } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GlassCard style={styles.card}>
        <View style={styles.inner}>
          <Image source={schoolLogo} resizeMode="contain" style={styles.schoolLogo} />

          <Text style={[styles.appName, { color: palette.ink }]}>
            MGHUB — Marigold Secondary School
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
  schoolLogo: {
    width: 84,
    height: 84,
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
