import { describe, expect, it } from "vitest";
import { authorizationUrl, TodoistOAuthClient, validateConfig } from "../src/core/auth.js";
import { MemoryStorage } from "../src/core/storage.js";
import type { OAuthConfig } from "../src/core/model.js";

const config: OAuthConfig = { clientId: "https://public.example/oauth/client.json", scope: "data:read", redirectPath: "todoist" };

describe("Todoist public-client PKCE auth", () => {
  it("requests only data:read and includes state plus PKCE", () => {
    const url = new URL(authorizationUrl(config, "https://extension.chromiumapp.org/todoist", "state-fixture", "challenge-fixture"));
    expect(url.searchParams.get("client_id")).toBe(config.clientId);
    expect(url.searchParams.get("scope")).toBe("data:read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-fixture");
    expect(url.searchParams.get("state")).toBe("state-fixture");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  it("rejects non-public client configuration", () => {
    expect(() => validateConfig({ ...config, clientId: "http://localhost/client.json" })).toThrow("HTTPS");
    expect(() => validateConfig({ ...config, scope: "data:read_write" as "data:read" })).toThrow("data:read");
  });

  it("exchanges code without a client secret and stores only session credentials", async () => {
    const storage = new MemoryStorage();
    let exchangeBody = "";
    const identity = {
      getRedirectURL: () => "https://extension.chromiumapp.org/todoist",
      launchWebAuthFlow: async ({ url }: { url: string }) => {
        const authorization = new URL(url);
        return `https://extension.chromiumapp.org/todoist?code=code-fixture&state=${authorization.searchParams.get("state")}`;
      }
    };
    const client = new TodoistOAuthClient(config, storage, identity, (async (_input, init) => {
      exchangeBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ access_token: "access-fixture", refresh_token: "refresh-fixture", expires_in: 3600, scope: "data:read" }), { status: 200 });
    }) as typeof fetch, () => 1_000_000);
    await client.connect();
    expect(exchangeBody).toContain("grant_type=authorization_code");
    expect(exchangeBody).toContain("code_verifier=");
    expect(exchangeBody).not.toContain("client_secret");
    expect(await client.getAccessToken()).toBe("access-fixture");
    expect(JSON.stringify(await storage.get("todoist-oauth-session-v1"))).not.toContain("client_secret");
  });
});
