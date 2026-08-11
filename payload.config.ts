// payload.config.ts
// Minimal Payload 3.x config for Mishran.
// Collections/globals are added in later tasks (Task 6+).
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    // `user: "users"` references the users collection slug, registered in a later task.
    // Auto-login in dev so /admin opens without credentials during local development.
    autoLogin:
      process.env.NODE_ENV === "production"
        ? false
        : {
            email: "dev@mithai.shop",
            password: "dev-password",
          },
  },
  collections: [],
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
