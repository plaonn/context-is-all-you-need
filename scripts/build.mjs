import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sourceState = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
  cwd: root,
  encoding: "utf8"
}).trim() ? "modified" : "clean";

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
execFileSync(resolve(root, "node_modules/.bin/tsc"), ["-p", resolve(root, "tsconfig.build.json")], { cwd: root, stdio: "inherit" });
cpSync(resolve(root, "extension/manifest.json"), resolve(dist, "manifest.json"));
cpSync(resolve(root, "extension/index.html"), resolve(dist, "index.html"));
cpSync(resolve(root, "extension/styles.css"), resolve(dist, "styles.css"));
writeFileSync(resolve(dist, "build-info.json"), `${JSON.stringify({
  schemaVersion: 1,
  artifact: "unpacked-mv3",
  sourceRevision,
  sourceState
}, null, 2)}\n`);
console.log(`Built unpacked extension for ${sourceRevision.slice(0, 12)} (${sourceState} source).`);
