import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignored = new Set([".git", "node_modules", "dist", "coverage"]);
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    const info = statSync(path);
    if (info.isDirectory()) walk(path);
    else if (/\.(?:ts|mjs|json|md|html|css|yml|yaml)$/.test(entry)) files.push(path);
  }
}

walk(root);
const findings = [];
for (const path of files) {
  const text = readFileSync(path, "utf8");
  const relative = path.slice(root.length + 1);
  if (relative === "scripts/check-public-safety.mjs") continue;
  if (/\/Users\/[^\s`"']+|Bearer\s+[A-Za-z0-9._-]{24,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[A-Za-z0-9+/=_-]{24,}/i.test(text)) {
    findings.push(`${relative}: possible private path or credential literal`);
  }
  if (/MMCP_|NOTION_API_TOKEN|WORDPRESS_ACCESS_TOKEN|DASHBOARD_PASSWORD/i.test(text)) {
    findings.push(`${relative}: private runtime configuration name`);
  }
}

const apiSource = readFileSync(join(root, "src/core/api.ts"), "utf8");
if (/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i.test(apiSource)) {
  findings.push("src/core/api.ts: provider adapter contains a mutating HTTP method");
}
if (/\/tasks\/[^/]+\/(?:close|move)|\/projects|\/comments/i.test(apiSource)) {
  findings.push("src/core/api.ts: provider adapter references a mutation endpoint");
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Public-safety scan passed (${files.length} source/docs files).`);
}
