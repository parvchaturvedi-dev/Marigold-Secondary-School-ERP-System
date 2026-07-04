// App-wide light/dark theme. Manual toggle, persisted per-device.
// Plain, simple, solid cards (no glassmorphism / no blur) — clean and readable.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "mgps_erp_theme_mode";
const ThemeContext = createContext(null);

const PALETTES = {
  light: {
    mode: "light",
    statusBar: "dark",
    // Aurora gradient background + solid white cards
    bg: "#eef2ff",
    aurora: ["#eef2ff", "#eff6ff", "#faf5ff"],
    blobs: ["rgba(129,140,248,0.22)", "rgba(125,211,252,0.20)", "rgba(240,171,252,0.18)"],
    card: "#ffffff",
    cardBorder: "#e6e8ee",
    cardSoft: "#f7f8fa",
    shadow: "#0f172a",
    shadowOpacity: 0.06,
    // Text
    ink: "#0f172a",
    inkSoft: "#64748b",
    inkFaint: "#94a3b8",
    inkLabel: "#475569",
    // Accent + tiles
    accent: "#6366f1",
    accentDeep: "#4f46e5",
    tile: "#eef2ff",
    tileBorder: "#eceef4",
    inputBg: "#ffffff",
    inputBorder: "#dfe3ea",
    // Header (text sitting directly on the page bg)
    headerInk: "#0f172a",
    headerChipBg: "#ffffff",
  },
  dark: {
    mode: "dark",
    statusBar: "light",
    bg: "#0b1020",
    aurora: ["#0b1020", "#131a2e", "#1e1b4b"],
    blobs: ["rgba(99,102,241,0.32)", "rgba(56,189,248,0.18)", "rgba(168,85,247,0.22)"],
    card: "#161d2e",
    cardBorder: "#273248",
    cardSoft: "#1b2334",
    shadow: "#000000",
    shadowOpacity: 0.5,
    ink: "#e8ecf4",
    inkSoft: "#9aa6bd",
    inkFaint: "#6b7793",
    inkLabel: "#b3bdd2",
    accent: "#818cf8",
    accentDeep: "#a5b4fc",
    tile: "#20293e",
    tileBorder: "#273248",
    inputBg: "#1b2334",
    inputBorder: "#2f3a52",
    headerInk: "#e8ecf4",
    headerChipBg: "#1b2334",
  },
};

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark") setModeState(saved);
      })
      .catch(() => {});
  }, []);

  const value = useMemo(() => {
    const setMode = (next) => {
      setModeState(next);
      AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
    };
    return {
      mode,
      palette: PALETTES[mode],
      setMode,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
      isDark: mode === "dark",
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return (
    useContext(ThemeContext) || {
      mode: "light",
      palette: PALETTES.light,
      setMode: () => {},
      toggle: () => {},
      isDark: false,
    }
  );
}
