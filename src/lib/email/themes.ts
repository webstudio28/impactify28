export type ColorTheme = {
  label: string;
  primary: string;
  accent: string;
  bg: string;
  bgLight: string;
  text: string;
  textMuted: string;
  heroText: string;
};

export type ThemeKey =
  | "midnight_blue"
  | "forest_green"
  | "crimson_red"
  | "royal_purple"
  | "sunset_orange"
  | "ocean_teal"
  | "rose_gold"
  | "slate_gray"
  | "amber_gold"
  | "deep_navy";

export const COLOR_THEMES: Record<ThemeKey, ColorTheme> = {
  midnight_blue: {
    label: "Midnight Blue",
    primary: "#1a237e",
    accent: "#5c6bc0",
    bg: "#ebebf5",
    bgLight: "#f0f2ff",
    text: "#1a1a2e",
    textMuted: "#5c5c80",
    heroText: "#ffffff",
  },
  forest_green: {
    label: "Forest Green",
    primary: "#1b5e20",
    accent: "#2e7d32",
    bg: "#e8f5e9",
    bgLight: "#f1f8f2",
    text: "#1a2e1b",
    textMuted: "#4a6b4c",
    heroText: "#ffffff",
  },
  crimson_red: {
    label: "Crimson Red",
    primary: "#7f1d1d",
    accent: "#dc2626",
    bg: "#fef2f2",
    bgLight: "#fff5f5",
    text: "#2e1a1a",
    textMuted: "#7a4040",
    heroText: "#ffffff",
  },
  royal_purple: {
    label: "Royal Purple",
    primary: "#3b0764",
    accent: "#9333ea",
    bg: "#faf5ff",
    bgLight: "#f5eeff",
    text: "#1e0a2e",
    textMuted: "#6b3e8a",
    heroText: "#ffffff",
  },
  sunset_orange: {
    label: "Sunset Orange",
    primary: "#7c2d12",
    accent: "#ea580c",
    bg: "#fff7ed",
    bgLight: "#fef3e5",
    text: "#2e1a0a",
    textMuted: "#7a4a2a",
    heroText: "#ffffff",
  },
  ocean_teal: {
    label: "Ocean Teal",
    primary: "#0f4c5c",
    accent: "#0891b2",
    bg: "#ecfeff",
    bgLight: "#f0fdff",
    text: "#0a2228",
    textMuted: "#2e6070",
    heroText: "#ffffff",
  },
  rose_gold: {
    label: "Rose Gold",
    primary: "#881337",
    accent: "#e11d48",
    bg: "#fff1f2",
    bgLight: "#fff5f6",
    text: "#2e0a14",
    textMuted: "#7a3040",
    heroText: "#ffffff",
  },
  slate_gray: {
    label: "Slate Gray",
    primary: "#1e293b",
    accent: "#475569",
    bg: "#f8fafc",
    bgLight: "#f1f5f9",
    text: "#1e293b",
    textMuted: "#64748b",
    heroText: "#ffffff",
  },
  amber_gold: {
    label: "Amber Gold",
    primary: "#78350f",
    accent: "#d97706",
    bg: "#fffbeb",
    bgLight: "#fef9e8",
    text: "#2e1a04",
    textMuted: "#7a5a20",
    heroText: "#ffffff",
  },
  deep_navy: {
    label: "Deep Navy",
    primary: "#0c1445",
    accent: "#2563eb",
    bg: "#eff6ff",
    bgLight: "#f0f4ff",
    text: "#0c1445",
    textMuted: "#3a5080",
    heroText: "#ffffff",
  },
};

export const THEME_KEYS = Object.keys(COLOR_THEMES) as ThemeKey[];

export const DEFAULT_THEME_KEY: ThemeKey = "midnight_blue";

export function getTheme(key: string | null | undefined): ColorTheme {
  if (key && key in COLOR_THEMES) return COLOR_THEMES[key as ThemeKey];
  return COLOR_THEMES[DEFAULT_THEME_KEY];
}
