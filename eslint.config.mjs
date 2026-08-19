import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mobile build artifacts (iOS archives carry Razorpay's minified
    // EncryptedOtpelf.js, which trips the parser; Android gradle output).
    "apps/ios/build/**",
    "apps/android/**/build/**",
  ]),
  {
    // #123: the DI container lazy-loads heavy service implementations with
    // synchronous require() inside factory functions (singletons resolve
    // synchronously on first use; swapping to await import() would force
    // every factory async for no runtime win). Scoped exemption, not a
    // repo-wide rule change.
    files: ["lib/container.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
