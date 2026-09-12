import { cp, mkdir, rm, readdir, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
try {
  await access("package-lock.json");
  throw Error(
    "Remove package-lock.json; this project intentionally disables it.",
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const files = [
  "public/app.js",
  "public/core.js",
  "server/api.js",
  "server/aero.js",
  "server/validation.js",
  "functions/api/[[path]].js",
];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await cp("public", "dist", { recursive: true });
console.log(
  "Built static assets in dist/. Cloudflare Pages bundles functions/ separately. No dependencies or lockfile required.",
);
