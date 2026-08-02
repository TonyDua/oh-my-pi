#!/usr/bin/env node
// Restore the local bash-tool-description patch into the global omp package.
// Run after `omp update` / `bun install -g @oh-my-pi/pi-coding-agent` wiped node_modules.
// Idempotent: skips dist replacement when the patch is already applied.
// See LOCAL-PATCH-NOTES.md at the repo root.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcTemplate = join(
  repoRoot,
  "packages/coding-agent/src/prompts/tools/bash.md"
);
const globalPkg = join(
  homedir(),
  ".bun/install/global/node_modules/@oh-my-pi/pi-coding-agent"
);
const gSrc = join(globalPkg, "src/prompts/tools/bash.md");
const gDist = join(globalPkg, "dist/cli.js");

if (!existsSync(srcTemplate)) {
  console.error("FAIL: template not found in repo:", srcTemplate);
  process.exit(1);
}
if (!existsSync(gSrc) || !existsSync(gDist)) {
  console.error(
    "FAIL: global omp package not found at",
    globalPkg,
    "\n(bun install -g @oh-my-pi/pi-coding-agent first)"
  );
  process.exit(1);
}

const tpl = readFileSync(srcTemplate, "utf8");

// 1. src template copy
writeFileSync(gSrc, tpl);
console.log("OK: src template copied ->", gSrc);

// 2. dist/cli.js inline template replacement.
// The template lives in the bundle as a single-quoted JS string with \\n / \\u2026 / \\u2192 escapes.
const esc = (s) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/…/g, "\\u2026")
    .replace(/→/g, "\\u2192");

let dist = readFileSync(gDist, "utf8");
const OLD_START = "'Runs commands in a persistent shell.";
const OLD_END = "displayed output is complete.";
const start = dist.indexOf(OLD_START);
if (start === -1) {
  if (dist.includes("Runs commands in the embedded")) {
    console.log("SKIP: dist/cli.js already patched");
    process.exit(0);
  }
  console.error(
    "FAIL: old template not found in dist/cli.js (omp version changed?)"
  );
  process.exit(1);
}
const endMarkAt = dist.indexOf(OLD_END, start);
if (endMarkAt === -1) {
  console.error("FAIL: template end marker not found in dist/cli.js");
  process.exit(1);
}
// The old string closes with a quote right after the end marker (preceded by a \\n escape).
let end = dist.indexOf("'", endMarkAt + OLD_END.length);
if (end === -1) {
  console.error("FAIL: closing quote not found in dist/cli.js");
  process.exit(1);
}
end += 1;

dist = dist.slice(0, start) + "'" + esc(tpl) + "'" + dist.slice(end);
writeFileSync(gDist, dist);
console.log("OK: dist/cli.js inline template replaced");
console.log("Restart omp for new sessions to pick up the patch.");
