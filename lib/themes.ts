export type Theme =
  | "mishran-default"
  | "diwali-saffron"
  | "wedding-heritage"
  | "everyday-sage"
  | "navy"
  | "mblue2"
  | "mindbox"
  | "yoshida";

type ThemeGroup = "House Themes" | "Design Systems";

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

export const DEFAULT_THEME: Theme = "mblue2";

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
  {
    id: "navy",
    label: "Evening Navy",
    group: "House Themes",
    source: "Malgudi Original",
    blurb: "A soft slate storefront with refined blue and teal accents.",
    docPath: "/design-systems/evening-navy.md",
    preview: {
      canvas: "#e2e8f0",
      surface: "#edf1f5",
      accent: "#2563a8",
      pop: "#4fd1c5",
      ink: "#1a2332",
    },
  },
  {
    id: "mblue2",
    label: "Malgudi Blue v2",
    group: "House Themes",
    source: "Active DESIGN.md",
    blurb: "Flat deep navy surfaces, bright action blue, restrained festive gold.",
    docPath: "/design-systems/malgudi-blue-v2.md",
    preview: {
      canvas: "#041e42",
      surface: "#0a2b57",
      accent: "#0053e2",
      pop: "#ffc220",
      ink: "#edf5ff",
    },
  },
  {
    id: "mindbox",
    label: "MindBox Studio",
    group: "Design Systems",
    source: "Inspired by awesome-design-md",
    blurb: "Luminous indigo, teal highlights, subtle grid, and a digital lab mood.",
    docPath: "/design-systems/mindbox-studio.md",
    preview: {
      canvas: "#0f0e26",
      surface: "#17143a",
      accent: "#5b3ffa",
      pop: "#00d4c8",
      ink: "#e8e6ff",
    },
  },
  {
    id: "yoshida",
    label: "Yoshida",
    group: "House Themes",
    source: "Hiroshi Yoshida shin-hanga",
    blurb: "Muted teal, warm ochre, and soft lavender — Japanese woodblock print atmosphere.",
    docPath: "/design-systems/yoshida.md",
    preview: {
      canvas: "#2B4F6F",
      surface: "#355A7A",
      accent: "#C4A265",
      pop: "#9B7DA8",
      ink: "#D4C5A9",
    },
  },
];

export const THEME_GROUP_ORDER: ThemeGroup[] = [
  "House Themes",
  "Design Systems",
];

export const VALID_THEMES = THEMES.map((theme) => theme.id) as Theme[];

// Legacy theme rebrands: old id -> current id.
// Fully-archived themes (heritage-2, coinbase, ibm, myblue) are intentionally
// NOT mapped here so normalizeTheme() returns null for them, letting callers
// fall back to DEFAULT_THEME. The inline boot script in app/layout.tsx carries
// the broader migration map so stored localStorage values still resolve.
const LEGACY_THEME_ALIASES: Record<string, Theme> = {
  festive: "diwali-saffron",
  heritage: "wedding-heritage",
  "heritage-2": "wedding-heritage",
  sage: "everyday-sage",
  myblue: "mblue2",
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
