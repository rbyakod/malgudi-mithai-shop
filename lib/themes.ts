export type Theme =
  | "mishran-default"
  | "diwali-saffron"
  | "wedding-heritage"
  | "everyday-sage";

type ThemeGroup = "House Themes";

export type ThemeDefinition = {
  id: Theme;
  label: string;
  group: ThemeGroup;
  source: string;
  blurb: string;
  docPath: string;
  preview: {
    canvas: string;
    surface: string;
    accent: string;
    pop: string;
    ink: string;
  };
};

export const DEFAULT_THEME: Theme = "mishran-default";

export const THEMES: ThemeDefinition[] = [
  {
    id: "mishran-default",
    label: "Mishran Default",
    group: "House Themes",
    source: "Mishran Brand Strategy",
    blurb: "Warm milk-cream canvas, deep kakvi brown ink, festive saffron accent — the canonical Mishran mood.",
    docPath: "/design-systems/mishran-default.md",
    preview: {
      canvas: "#f7efe0",
      surface: "#fbf6ec",
      accent: "#9b4d2a",
      pop: "#d79a35",
      ink: "#2c1810",
    },
  },
  {
    id: "diwali-saffron",
    label: "Diwali Saffron",
    group: "House Themes",
    source: "Malgudi Original",
    blurb: "Warm terracotta, soft cream, celebratory gold.",
    docPath: "/design-systems/festive-saffron.md",
    preview: {
      canvas: "#f0e4d4",
      surface: "#f7ece0",
      accent: "#b94b4b",
      pop: "#f0b35c",
      ink: "#3b221b",
    },
  },
  {
    id: "wedding-heritage",
    label: "Wedding Heritage",
    group: "House Themes",
    source: "Mishran Menu Editorial",
    blurb: "Parchment, oxblood, saffron, cocoa with a literary old-India mood.",
    docPath: "/design-systems/mishran-heritage.md",
    preview: {
      canvas: "#f4e7d0",
      surface: "#fbf4e6",
      accent: "#8c0e2f",
      pop: "#d79a35",
      ink: "#3b2419",
    },
  },
  {
    id: "everyday-sage",
    label: "Everyday Sage",
    group: "House Themes",
    source: "Malgudi Original",
    blurb: "Quiet botanical neutrals with low-contrast elegance.",
    docPath: "/design-systems/minimal-sage.md",
    preview: {
      canvas: "#e4e0d4",
      surface: "#edeae3",
      accent: "#4a7c59",
      pop: "#c9a96e",
      ink: "#2d3a2e",
    },
  },
];

export const THEME_GROUP_ORDER: ThemeGroup[] = ["House Themes"];

export const VALID_THEMES = THEMES.map((theme) => theme.id) as Theme[];

// Legacy theme rebrands: old id -> new occasion-theme id.
// Fully-archived themes (navy, mblue2, mindbox, coinbase, ibm, yoshida, myblue)
// are intentionally NOT mapped here so normalizeTheme() returns null for them,
// letting callers fall back to DEFAULT_THEME. The inline boot script in
// app/layout.tsx carries the broader migration map (including the archived
// ids -> mishran-default) so stored localStorage values still resolve.
const LEGACY_THEME_ALIASES: Record<string, Theme> = {
  festive: "diwali-saffron",
  heritage: "wedding-heritage",
  "heritage-2": "wedding-heritage",
  sage: "everyday-sage",
};

export function getThemeDefinition(theme: Theme) {
  return THEMES.find((entry) => entry.id === theme) ?? THEMES[0];
}

export function normalizeTheme(value: string | null | undefined): Theme | null {
  if (!value) return null;
  const normalized = LEGACY_THEME_ALIASES[value] ?? value;
  return VALID_THEMES.includes(normalized as Theme)
    ? (normalized as Theme)
    : null;
}
