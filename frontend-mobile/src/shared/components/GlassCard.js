import React from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

/**
 * Plain solid card (no glass / no blur). Simple surface + hairline border and a
 * soft shadow. Adapts to the active light/dark theme. Kept the name/props for
 * drop-in compatibility across the app.
 *
 * Props:
 *  - strong: slightly stronger shadow (modals/dropdowns)
 *  - soft: lighter nested tile
 *  - style: outer container style (radius/margins/padding)
 */
export default function GlassCard({ children, strong = false, soft = false, style, ...rest }) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: soft ? palette.cardSoft : palette.card,
          borderRadius: soft ? 16 : 20,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          shadowColor: palette.shadow,
          shadowOpacity: soft ? 0 : strong ? palette.shadowOpacity + 0.04 : palette.shadowOpacity,
          shadowRadius: strong ? 16 : 10,
          shadowOffset: { width: 0, height: strong ? 6 : 3 },
          elevation: soft ? 0 : strong ? 4 : 2,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
