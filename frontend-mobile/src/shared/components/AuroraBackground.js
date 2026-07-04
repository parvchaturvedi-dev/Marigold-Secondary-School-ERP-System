import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme/ThemeContext";

/**
 * Full-screen aurora gradient backdrop with soft color blobs.
 * Adapts to the active light/dark theme.
 */
export default function AuroraBackground() {
  const { palette } = useTheme();
  const [b1, b2, b3] = palette.blobs;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={palette.aurora}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobIndigo, { backgroundColor: b1 }]} />
      <View style={[styles.blob, styles.blobSky, { backgroundColor: b2 }]} />
      <View style={[styles.blob, styles.blobFuchsia, { backgroundColor: b3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", borderRadius: 9999 },
  blobIndigo: { width: 320, height: 320, top: -120, left: -100 },
  blobSky: { width: 360, height: 360, top: "35%", right: -140 },
  blobFuchsia: { width: 340, height: 340, bottom: -140, left: "18%" },
});
