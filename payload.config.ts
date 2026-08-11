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
// Product stubs — expanded by Task 7.
import { MithaiProducts } from "./collections/MithaiProducts";
import { GiftBoxes } from "./collections/GiftBoxes";
import { QsrMenuItems } from "./collections/QsrMenuItems";
import { SnackProducts } from "./collections/SnackProducts";
import { MerchProducts } from "./collections/MerchProducts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    // `user: "users"` references the Users collection registered below.
    user: "users",
    // Auto-login in dev so /admin opens without credentials during local development.
    autoLogin:
      process.env.NODE_ENV === "production"
        ? false
        : {
            email: "dev@mithai.shop",
            password: "dev-password",
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
  ],
  globals: [],
  secret: process.env.PAYLOAD_SECRET ?? "dev-secret-change-me",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url:
      process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mishran-dev",
  }),
  editor: lexicalEditor(),
  sharp,
});
