import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requiredFiles = [
  "manifest.json",
  "index.html",
  "styles.css",
  "build-info.json",
  "extension/app.js",
  "extension/service-worker.js"
];

export function verifyBuildOutput(artifactRoot, expectedRevision) {
  for (const relativePath of requiredFiles) {
    if (!existsSync(join(artifactRoot, relativePath))) {
      throw new Error(`missing required artifact file: ${relativePath}`);
    }
  }

  const buildInfo = readJson(join(artifactRoot, "build-info.json"), "build-info.json");
  if (buildInfo.schemaVersion !== 1 || buildInfo.artifact !== "unpacked-mv3") {
    throw new Error("unsupported build provenance schema");
  }
  if (!/^[0-9a-f]{40}$/i.test(buildInfo.sourceRevision)) {
    throw new Error("build provenance has no full source revision");
  }
  if (buildInfo.sourceRevision !== expectedRevision) {
    throw new Error(`artifact sourceRevision mismatch: expected ${expectedRevision}, found ${buildInfo.sourceRevision}`);
  }
  if (buildInfo.sourceState !== "clean" && buildInfo.sourceState !== "modified") {
    throw new Error("build provenance has an invalid source state");
  }

  const manifest = readJson(join(artifactRoot, "manifest.json"), "manifest.json");
  if (manifest.manifest_version !== 3 || manifest.options_page !== "index.html") {
    throw new Error("artifact manifest does not describe the expected MV3 options page");
  }
  if (manifest.background?.service_worker !== "extension/service-worker.js" || manifest.background?.type !== "module") {
    throw new Error("artifact manifest does not point to the expected module service worker");
  }

  const html = readFileSync(join(artifactRoot, "index.html"), "utf8");
  if (!html.includes('href="styles.css"') || !html.includes('src="extension/app.js"')) {
    throw new Error("artifact options page is missing its runtime entrypoints");
  }
  const app = readFileSync(join(artifactRoot, "extension/app.js"), "utf8");
  if (!app.includes("build-info.json")) {
    throw new Error("artifact app does not expose build provenance at runtime");
  }

  return {
    sourceRevision: buildInfo.sourceRevision,
    sourceState: buildInfo.sourceState
  };
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`invalid ${label}`);
  }
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--expected-revision") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      args.set(argument, value);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const artifactRoot = resolve(args.get("--root") ?? join(repositoryRoot, "dist"));
    const expectedRevision = args.get("--expected-revision") ?? execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8"
    }).trim();
    const result = verifyBuildOutput(artifactRoot, expectedRevision);
    console.log(`Build artifact verified for ${result.sourceRevision.slice(0, 12)} (${result.sourceState} source).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Build artifact verification failed.");
    process.exitCode = 1;
  }
}
