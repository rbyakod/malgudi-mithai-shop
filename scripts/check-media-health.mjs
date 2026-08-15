#!/usr/bin/env node

import {existsSync} from "node:fs";
import {join} from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3002";
const paths = [
  "/images/kaju-katli-box.jpg",
  "/images/kaju-katli.jpg",
  "/api/media/file/cashew_caramel_3_1_82b23a6b-6187-4b0f-9328-a2f25c035112.jpg",
  "/api/media/file/1_17966508-6230-43cc-a641-14bd2b412990.jpg",
];

let failed = false;

for (const path of paths) {
  const url = new URL(path, baseUrl).href;
  const localPath = path.startsWith("/api/media/file/")
    ? join(process.cwd(), "media", path.replace("/api/media/file/", ""))
    : path.startsWith("/images/")
      ? join(process.cwd(), "public", path)
      : null;
  const ok = Boolean(localPath && existsSync(localPath));
  console.log(`${ok ? "OK" : "FAIL"} ${localPath ?? url}`);
  if (!ok) failed = true;
}

if (failed) {
  console.error("Media health check failed. Copy or link media/ into this checkout.");
  process.exit(1);
}
