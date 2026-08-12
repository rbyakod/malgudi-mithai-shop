// payload.config.ts
// Payload 3.x config for Mishran.
// Brand collections (Task 6): users, media, stories, karigars, farms,
// packaging, occasions. Plus minimal stub product collections so the
// brand-collection relationship fields (Stories.relatedProducts,
// Karigars.specialties, Occasions.recommendedProducts) resolve during
// config sanitization. Task 7 will expand the product stubs into full
// schemas; the slugs must remain stable.
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Stories } from "./collections/Stories";
import { Karigars } from "./collections/Karigars";
import { Farms } from "./collections/Farms";
import { Packaging } from "./collections/Packaging";
import { Occasions } from "./collections/Occasions";
// Mishran admin aesthetics (Task 18 wiring).
// String paths are used because Payload 3.x's CustomComponent type expects
// a component client-referenced through importMap; direct component refs
// trip TS2322 against CustomComponent<Record<string, any>>.
const CrestIconPath = "@/components/payload-admin/graphics/CrestIcon";
const WordmarkLogoPath = "@/components/payload-admin/graphics/WordmarkLogo";
const MishranLoginHeroPath = "@/components/payload-admin/login/MishranLoginHero";
const MishranDashboardPath = "@/components/payload-admin/dashboard/MishranDashboard";
const AdminThemeSwitcherPath = "@/components/payload-admin/theme/AdminThemeSwitcher";
// Product stubs — expanded by Task 7.
import { MithaiProducts } from "./collections/MithaiProducts";
import { GiftBoxes } from "./collections/GiftBoxes";
import { QsrMenuItems } from "./collections/QsrMenuItems";
import { SnackProducts } from "./collections/SnackProducts";
import { MerchProducts } from "./collections/MerchProducts";
// Ops collections (Task 9).
import { Leads } from "./collections/Leads";
import { Drafts } from "./collections/Drafts";
// Globals (Task 8).
import { BrandSettings } from "./globals/BrandSettings";
import { NavSettings } from "./globals/NavSettings";
import { ThemeSettings } from "./globals/ThemeSettings";
import { AnalyticsSettings } from "./globals/AnalyticsSettings";
import { StoreSettings } from "./globals/StoreSettings";
import { HomeHero } from "./globals/HomeHero";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Auto-login uses hardcoded `dev@mithai.shop` / `dev-password` credentials
// and must ONLY activate on a truly local development machine. Vercel
// Preview environments run NODE_ENV=development, so gating on production
// alone would expose /admin on every preview deploy. Tighten to local dev
// by also excluding Vercel-hosted and CI environments.
const isLocalDev =
  process.env.NODE_ENV !== "production" &&
  !process.env.VERCEL &&
  !process.env.CI;

export default buildConfig({
  admin: {
    // `user: "users"` references the Users collection registered below.
    user: "users",
    // Auto-login in dev so /admin opens without credentials during local development.
    autoLogin: isLocalDev
      ? {
          email: "dev@mithai.shop",
          password: "dev-password",
        }
      : false,
    components: {
      graphics: {
        Icon: CrestIconPath,
        Logo: WordmarkLogoPath,
      },
      beforeLogin: [MishranLoginHeroPath],
      beforeDashboard: [MishranDashboardPath],
      settingsMenu: [AdminThemeSwitcherPath],
    },
  },
  collections: [
    // Brand collections (Task 6 scope).
    Users,
    Media,
    Stories,
    Karigars,
    Farms,
    Packaging,
    Occasions,
    // Product stubs (Task 7 expands these).
    MithaiProducts,
    GiftBoxes,
    QsrMenuItems,
    SnackProducts,
    MerchProducts,
    // Ops collections (Task 9).
    Leads,
    Drafts,
  ],
  globals: [
    BrandSettings,
    NavSettings,
    ThemeSettings,
    AnalyticsSettings,
    StoreSettings,
    HomeHero,
  ],
  secret: process.env.PAYLOAD_SECRET ?? "dev-secret-change-me",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url:
      process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mishran-dev",
    afterOpenConnection: async (adapter) => {
      // Create TTL index on drafts.expiresAt for 30-day auto-deletion
      try {
        const draftsModel = adapter.collections.drafts;
        if (draftsModel) {
          await draftsModel.collection.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0 },
          );
          console.log("Created TTL index on drafts.expiresAt");
        }
      } catch (error) {
        console.warn("Failed to create TTL index on drafts.expiresAt:", error);
      }
    },
  }),
  editor: lexicalEditor(),
  sharp,
});
