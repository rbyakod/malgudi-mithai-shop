// collections/Users.ts
// Admin user collection. Payload requires an auth-enabled collection
// referenced by `admin.user` in payload.config.ts.
//
// Security note: brief suggested `read: () => true` but public read on users
// is a credential-disclosure smell. Restricted to authenticated users instead.
import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  access: {
    // Authenticated users only. Tighten further (admin-only) in a later task
    // once role-based access is wired through the rest of the config.
    read: ({ req: { user } }) => Boolean(user),
  },
  admin: { useAsTitle: "email" },
  fields: [
    { name: "name", type: "text" },
    {
      name: "role",
      type: "select",
      options: ["admin", "editor", "ops"],
      defaultValue: "editor",
      required: true,
    },
  ],
};
