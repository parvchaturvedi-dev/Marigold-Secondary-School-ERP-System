import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients } from "../theme/glass";

/**
 * Full-screen light gradient backdrop with soft color blobs.
 * Render as the first child of a screen; content stacks above it.
 */
export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={gradients.aurora}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobIndigo]} />
      <View style={[styles.blob, styles.blobSky]} />
      <View style={[styles.blob, styles.blobFuchsia]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    borderRadius: 9999,
  },
  blobIndigo: {
    width: 320,
    height: 320,
    top: -120,
    left: -100,
    backgroundColor: "rgba(129,140,248,0.22)",
  },
  blobSky: {
    width: 360,
    height: 360,
    top: "35%",
    right: -140,
    backgroundColor: "rgba(125,211,252,0.22)",
  },
  blobFuchsia: {
    width: 340,
    height: 340,
    bottom: -140,
    left: "18%",
    backgroundColor: "rgba(240,171,252,0.18)",
  },
});
