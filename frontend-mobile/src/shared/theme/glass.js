// MGHUB Glass Design System — mobile tokens (mirrors web design language)
export const gradients = {
  // Full-screen aurora backdrop (indigo-50 → sky-50 → purple-50)
  aurora: ["#eef2ff", "#f0f9ff", "#faf5ff"],
  // Primary action gradient (indigo-500 → violet-500)
  primary: ["#6366f1", "#8b5cf6"],
  // Icon chip gradient
  chip: ["#6366f1", "#8b5cf6"],
  // Header accent
  header: ["rgba(99,102,241,0.12)", "rgba(139,92,246,0.12)"],
};

export const glassColors = {
  ink: "#0f172a", // slate-900
  inkSoft: "#64748b", // slate-500
  inkFaint: "#94a3b8", // slate-400
  accent: "#6366f1", // indigo-500
  accentDeep: "#4f46e5", // indigo-600
  violet: "#8b5cf6",
  sky: "#0ea5e9",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#f43f5e",
  cardBg: "rgba(255,255,255,0.62)",
  cardBgStrong: "rgba(255,255,255,0.82)",
  cardBgSoft: "rgba(255,255,255,0.45)",
  cardBorder: "rgba(255,255,255,0.75)",
};

// Reusable style fragments
export const glassStyles = {
  card: {
    backgroundColor: glassColors.cardBg,
    borderWidth: 1,
    borderColor: glassColors.cardBorder,
    borderRadius: 24,
    shadowColor: "#4f46e5",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardStrong: {
    backgroundColor: glassColors.cardBgStrong,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 24,
    shadowColor: "#4f46e5",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardSoft: {
    backgroundColor: glassColors.cardBgSoft,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 18,
  },
};
