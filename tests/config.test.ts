import { describe, expect, it } from "vitest";
import { loadConfig, saveConfig } from "../src/extension/config.js";
import { MemoryStorage } from "../src/core/storage.js";
import type { OAuthClientRegistration } from "../src/core/model.js";

const registration: OAuthClientRegistration = {
  clientId: "tdd_fixture_public_client",
  redirectUri: "https://extension.chromiumapp.org/todoist",
  issuer: "https://todoist.com",
  registrationEndpoint: "https://api.todoist.com/oauth/register",
  authorizationEndpoint: "https://app.todoist.com/oauth/authorize",
  tokenEndpoint: "https://api.todoist.com/oauth/access_token",
  registrationVersion: 3
};

describe("local Context configuration", () => {
  it("migrates the original one-section config without changing OAuth registration", async () => {
    const storage = new MemoryStorage();
    await storage.set({
      "project-context-config-v1": {
        sectionId: "section-fixture",
        registration
      }
    });

    const loaded = await loadConfig(storage);
    expect(loaded).toMatchObject({
      contexts: [{ localKey: "default", label: "Current context", sectionId: "section-fixture" }],
      selectedContextKey: "default",
      registration
    });
    expect(loaded?.needsMigration).toBe(true);

    const migrated = await saveConfig(storage, {
      contexts: loaded?.contexts,
      selectedContextKey: loaded?.selectedContextKey ?? null,
      registration: loaded?.registration ?? null
    });
    expect(migrated.needsMigration).toBeUndefined();
    expect(await storage.get<Record<string, unknown>>("project-context-config-v1")).not.toHaveProperty("sectionId");
  });

  it("keeps multiple local Context mappings bounded and gives duplicate keys a stable suffix", async () => {
    const storage = new MemoryStorage();
    const saved = await saveConfig(storage, {
      contexts: [
        { localKey: "work", label: "Work", sectionId: "section-work" },
        { localKey: "work", label: "Personal", sectionId: "section-personal" },
        { localKey: "bad key", label: "Ignored key is normalized", sectionId: "section-other" }
      ],
      selectedContextKey: "work-2",
      registration
    });

    expect(saved.contexts).toEqual([
      { localKey: "work", label: "Work", sectionId: "section-work" },
      { localKey: "work-2", label: "Personal", sectionId: "section-personal" },
      { localKey: "context-3", label: "Ignored key is normalized", sectionId: "section-other" }
    ]);
    expect(saved.selectedContextKey).toBe("work-2");
  });
});
