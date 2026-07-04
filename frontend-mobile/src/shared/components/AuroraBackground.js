import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

/**
 * Plain solid page background (no gradient / no glass blobs). Adapts to the
 * active light/dark theme. Render as the first child of a screen; content
 * stacks above it. Name kept for drop-in compatibility.
 */
export default function AuroraBackground() {
  const { palette } = useTheme();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} pointerEvents="none" />;
}
