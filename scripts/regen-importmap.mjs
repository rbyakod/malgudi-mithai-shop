// Regenerate Payload importMap via getPayload() — same code path as `payload`
// CLI bin but using native ESM import() to avoid tsx's sync loader TLA bug.
//
// Usage: node --import tsx scripts/regen-importmap.mjs
import { getPayload } from "../node_modules/payload/dist/index.js";
import { generateImportMap } from "../node_modules/payload/dist/bin/generateImportMap/index.js";

const configModule = await import("../payload.config.ts");
const config = configModule.default;

// Build the sanitized config (same as CLI path)
const payload = await getPayload({ config });

// payload.config is the sanitized config — pass it to the generator.
await generateImportMap(payload.config);
console.log("importMap regenerated OK");
process.exit(0);
