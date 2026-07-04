// Reusable animated skeleton primitives — shimmer/pulse loaders.
// Adapts to the active light/dark theme. Uses native driver → 60fps smooth.
import React, { useEffect, useRef } from "react";
import { Animated, View, Easing } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

/** Single animated skeleton block. Props: width, height, borderRadius, style. */
export function Skeleton({ width = "100%", height = 14, borderRadius = 8, style }) {
  const { palette, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const base = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: base, opacity },
        style,
      ]}
    >
      {/* keep palette reference so the linter doesn't warn */}
      {palette ? null : null}
    </Animated.View>
  );
}

/** A card-shaped skeleton row (avatar/circle + two lines + trailing chip). */
export function SkeletonRow({ withAvatar = true }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
      {withAvatar && <Skeleton width={44} height={44} borderRadius={14} style={{ marginRight: 12 }} />}
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="65%" height={13} />
        <Skeleton width="42%" height={10} />
      </View>
      <Skeleton width={54} height={22} borderRadius={11} style={{ marginLeft: 10 }} />
    </View>
  );
}

/** A stack of N skeleton rows inside a card surface. */
export function SkeletonList({ rows = 5, withAvatar = true }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        padding: 12,
        marginBottom: 14,
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>
          <SkeletonRow withAvatar={withAvatar} />
          {i < rows - 1 && (
            <View style={{ height: 1, backgroundColor: palette.cardBorder, marginHorizontal: 4 }} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Grid of module-tile skeletons for dashboards. */
export function SkeletonTiles({ count = 8, columns = 4 }) {
  const width = `${Math.floor(100 / columns) - 2}%`;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width, alignItems: "center" }}>
          <Skeleton width={48} height={48} borderRadius={15} style={{ marginBottom: 8, marginTop: 6 }} />
          <Skeleton width="70%" height={10} />
          <Skeleton width="48%" height={8} style={{ marginTop: 4, marginBottom: 10 }} />
        </View>
      ))}
    </View>
  );
}

/** A single hero/action card skeleton (image + two text lines + pill button). */
export function SkeletonHero() {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
      }}
    >
      <Skeleton width={54} height={54} borderRadius={17} style={{ marginRight: 14 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="80%" height={18} />
        <Skeleton width="42%" height={10} />
      </View>
    </View>
  );
}

export default Skeleton;
