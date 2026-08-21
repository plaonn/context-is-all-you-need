import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
execFileSync(resolve(root, "node_modules/.bin/tsc"), ["-p", resolve(root, "tsconfig.build.json")], { cwd: root, stdio: "inherit" });
cpSync(resolve(root, "extension/manifest.json"), resolve(dist, "manifest.json"));
cpSync(resolve(root, "extension/index.html"), resolve(dist, "index.html"));
cpSync(resolve(root, "extension/styles.css"), resolve(dist, "styles.css"));
console.log(`Built unpacked extension at ${dist}`);
