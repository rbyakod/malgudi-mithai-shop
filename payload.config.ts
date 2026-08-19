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
import type { CollectionConfig, GlobalConfig } from "payload";

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
const CrestIconPath = "./components/payload-admin/graphics/CrestIcon";
const WordmarkLogoPath = "./components/payload-admin/graphics/WordmarkLogo";
const MishranLoginHeroPath = "./components/payload-admin/login/MishranLoginHero";
const MishranDashboardPath = "./components/payload-admin/dashboard/MishranDashboard";
const AdminThemeSwitcherPath = "./components/payload-admin/theme/AdminThemeSwitcher";
// Audit D8: every edit view gets a Cancel that backs out (left of
// Save/Publish). Slot keys differ by entity type — collections use
// components.edit, globals use components.elements
// (@payloadcms/next renderDocumentSlots reads both).
const CancelActionPath = "./components/payload-admin/actions/CancelAction";
// Product stubs — expanded by Task 7.
import { MithaiProducts } from "./collections/MithaiProducts";
import { GiftBoxes } from "./collections/GiftBoxes";
import { QsrMenuItems } from "./collections/QsrMenuItems";
import { SnackProducts } from "./collections/SnackProducts";
import { MerchProducts } from "./collections/MerchProducts";
// Ops collections (Task 9).
import { Leads } from "./collections/Leads";
import { Drafts } from "./collections/Drafts";
// Mobile app (Task 1.3): customer accounts.
import { Customers } from "./collections/Customers";
// Mobile app (Task 1.4): customer delivery addresses.
import { Addresses } from "./collections/Addresses";
// Mobile app (Task 1.5): orders.
import { Orders } from "./collections/Orders";
// Mobile app (Task 1.6): payments, shipments, serviceable pincodes.
import { Payments } from "./collections/Payments";
import { Shipments } from "./collections/Shipments";
import { ServiceablePincodes } from "./collections/ServiceablePincodes";
// Mobile app (Task 4.4): persisted cart snapshots (server-trust for create-order).
import { Snapshots } from "./collections/Snapshots";
// Mobile app (Task 1.7): auth + ops collections.
import { OtpRequests } from "./collections/OtpRequests";
import { Devices } from "./collections/Devices";
import { IdempotencyKeys } from "./collections/IdempotencyKeys";
import { RevokedTokens } from "./collections/RevokedTokens";
import { SecurityEvents } from "./collections/SecurityEvents";
// Mobile app (Task 19.1): Apple Wallet loyalty passes.
import { WalletPasses } from "./collections/WalletPasses";
// Conversion batch, Batch A: product reviews (capture-only) + server cart
// drafts (abandonment recovery).
import { Reviews } from "./collections/Reviews";
import { CartDrafts } from "./collections/CartDrafts";
import { Coupons } from "./collections/Coupons";
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

// Central Cancel injection (Audit D8) — one helper instead of edits in
// every collection/global file; future entities inherit it automatically.
function withCancelAction(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        edit: {
          ...collection.admin?.components?.edit,
          beforeDocumentControls: [
            ...(collection.admin?.components?.edit?.beforeDocumentControls ?? []),
            CancelActionPath,
          ],
        },
      },
    },
  };
}

function withCancelActionGlobal(global: GlobalConfig): GlobalConfig {
  return {
    ...global,
    admin: {
      ...global.admin,
      components: {
        ...global.admin?.components,
        elements: {
          ...global.admin?.components?.elements,
          beforeDocumentControls: [
            ...(global.admin?.components?.elements?.beforeDocumentControls ?? []),
            CancelActionPath,
          ],
        },
      },
    },
  };
}

export default buildConfig({
  admin: {
    // `user: "users"` references the Users collection registered below.
    user: "users",
    // Audit D5: browser tab read "Dashboard - Payload" — brand every title.
    meta: {
      titleSuffix: " — Mishran",
    },
    // Audit D10: lock Payload's native light/dark theme to "light". At the
    // default "all", html[data-theme] follows the OS Sec-CH header or a
    // sticky 365-day payload-theme cookie — flipping Payload's elevation
    // ladder dark. That was the source of the near-black form inputs: the
    // input bg token --theme-input-bg is var()-resolved on <html>, out of
    // reach of body-level overrides. The Mishran sidebar switcher owns
    // admin theming now; the stock appearance toggle is retired.
    theme: "light",
    // Auto-login in dev so /admin opens without credentials during local development.
    autoLogin: isLocalDev
      ? {
          email: "dev@mithai.shop",
          password: "dev-password",
        }
      : false,
    // baseDir MUST be set so Payload's import-map generator resolves our
    // custom component paths. Without it, paths like "@/components/..." or
    // "./components/..." are skipped silently and the components never
    // render in the admin panel (Task 19 E2E caught this regression).
    importMap: {
      baseDir: path.resolve(dirname, "."),
    },
    components: {
      graphics: {
        Icon: CrestIconPath,
        Logo: WordmarkLogoPath,
      },
      beforeLogin: [MishranLoginHeroPath],
      beforeDashboard: [MishranDashboardPath],
      // Audit D4: the switcher previously sat in `settingsMenu`, where it
      // leaked into every edit form as a stray "Admin theme" field. The
      // sidebar (below the nav links) is its home — visible everywhere,
      // outside every form.
      afterNavLinks: [AdminThemeSwitcherPath],
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
    // Mobile app (Task 1.3): customer accounts.
    Customers,
    // Mobile app (Task 1.4): customer delivery addresses.
    Addresses,
    // Mobile app (Task 1.5): orders.
    Orders,
    // Mobile app (Task 1.6): payments, shipments, serviceable pincodes.
    Payments,
    Shipments,
    ServiceablePincodes,
    // Mobile app (Task 4.4): cart snapshots.
    Snapshots,
    // Mobile app (Task 1.7): auth + ops collections.
    OtpRequests,
    Devices,
    IdempotencyKeys,
    RevokedTokens,
    SecurityEvents,
    // Mobile app (Task 19.1): Apple Wallet loyalty passes.
    WalletPasses,
    // Conversion batch, Batch A.
    Reviews,
    CartDrafts,
    // Known-gaps campaign (B6): coupon codes.
    Coupons,
    // Audit D8: Cancel on every edit view (create + edit).
  ].map(withCancelAction),
  globals: [
    BrandSettings,
    NavSettings,
    ThemeSettings,
    AnalyticsSettings,
    StoreSettings,
    HomeHero,
    // Audit D8: Cancel on every global edit view.
  ].map(withCancelActionGlobal),
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
      // Same 30-day TTL for cart drafts (abandonment recovery, Batch A).
      try {
        const cartDraftsModel = adapter.collections["cart-drafts"];
        if (cartDraftsModel) {
          await cartDraftsModel.collection.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0 },
          );
          console.log("Created TTL index on cart-drafts.expiresAt");
        }
      } catch (error) {
        console.warn("Failed to create TTL index on cart-drafts.expiresAt:", error);
      }
    },
  }),
  editor: lexicalEditor(),
  sharp,
});
