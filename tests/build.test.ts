import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(new URL("..", import.meta.url).pathname);
const verifier = join(repositoryRoot, "scripts/verify-build.mjs");

function createArtifact(sourceRevision: string): string {
  const artifactRoot = mkdtempSync(join(tmpdir(), "context-extension-artifact-"));
  mkdirSync(join(artifactRoot, "extension"));
  writeFileSync(join(artifactRoot, "build-info.json"), `${JSON.stringify({
    schemaVersion: 1,
    artifact: "unpacked-mv3",
    sourceRevision,
    sourceState: "clean"
  })}\n`);
  writeFileSync(join(artifactRoot, "manifest.json"), JSON.stringify({
    manifest_version: 3,
    options_page: "index.html",
    background: { service_worker: "extension/service-worker.js", type: "module" }
  }));
  writeFileSync(join(artifactRoot, "index.html"), '<link rel="stylesheet" href="styles.css"><script type="module" src="extension/app.js"></script>');
  writeFileSync(join(artifactRoot, "styles.css"), "body {}");
  writeFileSync(join(artifactRoot, "extension/app.js"), 'fetch("build-info.json");');
  writeFileSync(join(artifactRoot, "extension/service-worker.js"), "chrome.tabs.create();");
  return artifactRoot;
}

function verify(artifactRoot: string, expectedRevision: string) {
  return spawnSync(process.execPath, [verifier, "--root", artifactRoot, "--expected-revision", expectedRevision], {
    encoding: "utf8"
  });
}

describe("unpacked extension artifact provenance", () => {
  it("accepts a complete artifact whose marker matches the source revision", () => {
    const revision = "a".repeat(40);
    const artifactRoot = createArtifact(revision);
    try {
      const result = verify(artifactRoot, revision);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Build artifact verified");
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  });

  it("rejects a stale artifact marker from another source revision", () => {
    const artifactRoot = createArtifact("a".repeat(40));
    try {
      const result = verify(artifactRoot, "b".repeat(40));
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("sourceRevision mismatch");
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  });

  it("rejects an artifact missing a required runtime entrypoint", () => {
    const revision = "c".repeat(40);
    const artifactRoot = createArtifact(revision);
    try {
      unlinkSync(join(artifactRoot, "extension/service-worker.js"));
      const result = verify(artifactRoot, revision);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extension/service-worker.js");
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  });
});
