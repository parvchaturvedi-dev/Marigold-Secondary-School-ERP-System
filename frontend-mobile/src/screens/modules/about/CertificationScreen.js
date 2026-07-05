// Certification — a "Coming Soon" placeholder available to every role.
// ConnectedModuleScreen already wraps registered screens with AuroraBackground
// + a back/home PageHeader, so this screen only renders its own scroll content.
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import GlassCard from "../../../shared/components/GlassCard";
import { useTheme } from "../../../theme/ThemeContext";
import { gradients, glassColors } from "../../../shared/theme/glass";

export default function CertificationScreen() {
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
            <Ionicons name="ribbon-outline" size={44} color="#fff" />
          </LinearGradient>

          <Text style={[styles.title, { color: palette.ink }]}>Certifications</Text>

          <View style={styles.pill}>
            <Ionicons name="time-outline" size={14} color="#fff" />
            <Text style={styles.pillText}>COMING SOON</Text>
          </View>

          <Text style={[styles.subtitle, { color: palette.inkSoft }]}>
            Digital certificates & achievement records are on the way.
          </Text>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = {
  content: { padding: 16, paddingBottom: 40, flexGrow: 1, justifyContent: "center" },
  card: { borderRadius: 24 },
  inner: { padding: 30, alignItems: "center" },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  pill: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: glassColors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },
  subtitle: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "600",
  },
};
