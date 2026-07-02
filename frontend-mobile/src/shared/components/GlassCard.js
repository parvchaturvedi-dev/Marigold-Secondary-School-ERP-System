import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { glassColors } from "../theme/glass";

/**
 * Frosted glass card. Uses real blur (expo-blur) with a translucent white
 * wash + hairline border, matching the web `.glass-card` look.
 *
 * Props:
 *  - strong: more opaque variant (modals/dropdowns)
 *  - soft: lighter nested tile (no blur, cheaper)
 *  - style: outer container style (radius/margins/padding)
 */
export default function GlassCard({ children, strong = false, soft = false, style, ...rest }) {
  if (soft) {
    return (
      <View
        style={[
          {
            backgroundColor: glassColors.cardBgSoft,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.6)",
            borderRadius: 16,
          },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: 24,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: strong ? "rgba(255,255,255,0.85)" : glassColors.cardBorder,
          shadowColor: "#4f46e5",
          shadowOpacity: strong ? 0.1 : 0.08,
          shadowRadius: strong ? 20 : 16,
          shadowOffset: { width: 0, height: strong ? 10 : 8 },
          elevation: strong ? 6 : 4,
          backgroundColor: "transparent",
        },
        style,
      ]}
      {...rest}
    >
      <BlurView
        intensity={strong ? 55 : 40}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? glassColors.cardBgStrong : glassColors.cardBg },
        ]}
      />
      <View style={{ position: "relative" }}>{children}</View>
    </View>
  );
}
