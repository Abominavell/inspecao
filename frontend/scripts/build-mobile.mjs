import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const stashRoot = path.join(frontendRoot, ".capacitor-web-only-stash");

/** Arquivos/pastas exclusivos do web (Auth.js) — quebram `output: export`. */
const webOnlyPaths = [
  "src/app/api",
  "src/middleware.ts",
  "src/auth.ts",
  "src/app/admin-master",
];

function stashWebOnly() {
  fs.rmSync(stashRoot, { recursive: true, force: true });
  fs.mkdirSync(stashRoot, { recursive: true });
  for (const rel of webOnlyPaths) {
    const src = path.join(frontendRoot, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(stashRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
  }
}

function restoreWebOnly() {
  if (!fs.existsSync(stashRoot)) return;
  for (const rel of webOnlyPaths) {
    const dest = path.join(frontendRoot, rel);
    const src = path.join(stashRoot, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  fs.rmSync(stashRoot, { recursive: true, force: true });
}

process.env.CAPACITOR = "true";
process.env.NEXT_PUBLIC_OFFLINE_ONLY = "true";

stashWebOnly();
let exitCode = 0;
try {
  const result = spawnSync("npx", ["next", "build", "--webpack"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
    cwd: frontendRoot,
  });
  exitCode = result.status ?? 1;
} finally {
  restoreWebOnly();
}

if (exitCode !== 0) {
  process.exit(exitCode);
}

const legacyCleanupScript = `<script>(function(){try{var k=["local_session","field_session_epoch","field_launch_id","field_auth_listener","field_was_paused","field_dev_launch_epoch","field_dev_process_id","field_dev_session","campo_dev_process_id","campo_dev_session"];for(var i=0;i<k.length;i++){sessionStorage.removeItem(k[i]);localStorage.removeItem(k[i]);}}catch(e){}})();</script>`;
const marker = "field_session_epoch";

function injectLegacyCleanup(htmlPath) {
  let html = fs.readFileSync(htmlPath, "utf8");
  if (html.includes(marker)) return;
  html = html.includes("<head>")
    ? html.replace("<head>", `<head>${legacyCleanupScript}`)
    : `${legacyCleanupScript}${html}`;
  fs.writeFileSync(htmlPath, html);
}

function walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full);
    else if (entry.name.endsWith(".html")) injectLegacyCleanup(full);
  }
}

const outDir = path.join(frontendRoot, "out");
if (fs.existsSync(outDir)) {
  walkHtml(outDir);
}

process.exit(0);
