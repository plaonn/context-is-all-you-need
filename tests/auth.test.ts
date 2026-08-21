import { describe, expect, it } from "vitest";
import {
  ensureTodoistClientRegistration,
  normalizeOAuthClientRegistration,
  TodoistOAuthClient,
  authorizationUrl,
  registerTodoistClient,
  validateConfig
} from "../src/core/auth.js";
import { MemoryStorage } from "../src/core/storage.js";
import { loadConfig, saveConfig } from "../src/extension/config.js";
import {
  TODOIST_OAUTH_AUTHORIZATION_ENDPOINT,
  TODOIST_OAUTH_ISSUER,
  TODOIST_OAUTH_REGISTRATION_ENDPOINT,
  TODOIST_OAUTH_TOKEN_ENDPOINT
} from "../src/core/model.js";
import type { OAuthClientRegistration, OAuthConfig } from "../src/core/model.js";

const redirectUri = "https://extension.chromiumapp.org/todoist";
const config: OAuthConfig = {
  clientId: "tdd_fixture_client",
  scope: "data:read",
  redirectPath: "todoist",
  redirectUri
};
const identity = {
  getRedirectURL: () => redirectUri,
  launchWebAuthFlow: async ({ url }: { url: string }) => {
    const authorization = new URL(url);
    return `${redirectUri}?code=code-fixture&state=${authorization.searchParams.get("state")}`;
  }
};

describe("Todoist public-client PKCE auth", () => {
  it("requests only data:read and includes state plus PKCE", () => {
    const url = new URL(authorizationUrl(config, redirectUri, "state-fixture", "challenge-fixture"));
    expect(url.origin).toBe("https://app.todoist.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(config.clientId);
    expect(url.searchParams.get("scope")).toBe("data:read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-fixture");
    expect(url.searchParams.get("state")).toBe("state-fixture");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(() => authorizationUrl(config, "https://other-extension.chromiumapp.org/todoist", "state-fixture", "challenge-fixture"))
      .toThrow("redirect");
  });

  it("keeps issuer provenance separate from concrete OAuth endpoint origins", () => {
    expect(TODOIST_OAUTH_ISSUER).toBe("https://todoist.com");
    expect(new URL(TODOIST_OAUTH_REGISTRATION_ENDPOINT).origin).toBe("https://api.todoist.com");
    expect(new URL(TODOIST_OAUTH_AUTHORIZATION_ENDPOINT).origin).toBe("https://app.todoist.com");
    expect(new URL(TODOIST_OAUTH_TOKEN_ENDPOINT).origin).toBe("https://api.todoist.com");

    expect(normalizeOAuthClientRegistration(registrationFixture())).toEqual(registrationFixture());
    expect(normalizeOAuthClientRegistration({
      ...registrationFixture(),
      authorizationEndpoint: "https://todoist.com/oauth/authorize"
    })).toBeNull();
    expect(normalizeOAuthClientRegistration({
      ...registrationFixture(),
      issuer: "https://api.todoist.com"
    })).toBeNull();
  });

  it("accepts a dynamically registered public ID and rejects unsafe configuration", () => {
    expect(() => validateConfig(config)).not.toThrow();
    expect(() => validateConfig({ ...config, clientId: "https://public.example/oauth/client.json" })).not.toThrow();
    expect(() => validateConfig({ ...config, clientId: "http://localhost/client.json" })).toThrow("HTTPS");
    expect(() => validateConfig({ ...config, scope: "data:read_write" as "data:read" })).toThrow("data:read");
  });

  it("registers the exact redirect as a public read-only client", async () => {
    let request: RequestInit | undefined;
    let endpoint = "";
    const registration = await registerTodoistClient(redirectUri, (async (input, init) => {
      endpoint = String(input);
      request = init;
      return registrationResponse();
    }) as typeof fetch);
    const body = JSON.parse(String(request?.body));
    expect(request?.method).toBe("POST");
    expect(endpoint).toBe(TODOIST_OAUTH_REGISTRATION_ENDPOINT);
    expect(body).toEqual({
      client_name: "Context Is All You Need",
      redirect_uris: [redirectUri],
      scope: "data:read",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    });
    expect(registration).toEqual(registrationFixture());
    expect(JSON.stringify(registration)).not.toContain("secret");
  });

  it("persists registration metadata and reuses it without another registration", async () => {
    const localStorage = new MemoryStorage();
    const registration = await ensureTodoistClientRegistration(null, identity, "todoist", async () => registrationResponse());
    await saveConfig(localStorage, { sectionId: "section-fixture", registration });
    const loaded = await loadConfig(localStorage);
    let calls = 0;
    const reused = await ensureTodoistClientRegistration(loaded?.registration, identity, "todoist", async () => {
      calls += 1;
      return registrationResponse();
    });
    expect(loaded?.registration).toEqual(registration);
    expect(reused).toEqual(registration);
    expect(calls).toBe(0);

    await localStorage.set({ "project-context-config-v1": { sectionId: "section-fixture", registration: { ...registration, client_secret: "synthetic-secret" } } });
    const sanitized = await loadConfig(localStorage);
    expect(sanitized?.registration).toEqual(registration);
    expect(JSON.stringify(sanitized)).not.toContain("synthetic-secret");
  });

  it("invalidates a pre-canonical registration so the next connect re-registers it", async () => {
    const localStorage = new MemoryStorage();
    await localStorage.set({
      "project-context-config-v1": {
        sectionId: "section-fixture",
        registration: {
          clientId: "tdd_old_fixture",
          redirectUri,
          issuer: "https://api.todoist.com",
          registrationVersion: 1
        }
      }
    });
    const loaded = await loadConfig(localStorage);
    expect(loaded?.registration).toBeNull();
  });

  it("invalidates the previous issuer-derived registration schema", async () => {
    const localStorage = new MemoryStorage();
    await localStorage.set({
      "project-context-config-v1": {
        sectionId: "section-fixture",
        registration: {
          clientId: "tdd_old_canonical_fixture",
          redirectUri,
          issuer: "https://todoist.com",
          registrationVersion: 2
        }
      }
    });
    expect((await loadConfig(localStorage))?.registration).toBeNull();
  });

  it("re-registers once when the unpacked extension redirect identity changes", async () => {
    const existing: OAuthClientRegistration = { ...registrationFixture(), redirectUri: "https://old-extension.chromiumapp.org/todoist" };
    let calls = 0;
    const next = await ensureTodoistClientRegistration(existing, {
      getRedirectURL: () => redirectUri,
      launchWebAuthFlow: identity.launchWebAuthFlow
    }, "todoist", async () => {
      calls += 1;
      return registrationResponse();
    });
    expect(calls).toBe(1);
    expect(next.redirectUri).toBe(redirectUri);
  });

  it("coalesces concurrent explicit registration attempts", async () => {
    let calls = 0;
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetcher = (async () => {
      calls += 1;
      return new Promise<Response>((resolve) => { resolveResponse = resolve; });
    }) as typeof fetch;
    const first = ensureTodoistClientRegistration(null, identity, "todoist", fetcher);
    const second = ensureTodoistClientRegistration(null, identity, "todoist", fetcher);
    await Promise.resolve();
    expect(calls).toBe(1);
    resolveResponse?.(registrationResponse());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it("surfaces rate limits, provider failures, and malformed public metadata", async () => {
    await expect(registerTodoistClient(redirectUri, async () => new Response("", { status: 429 })))
      .rejects.toMatchObject({ code: "registration_rate_limited" });
    await expect(registerTodoistClient(redirectUri, async () => new Response("", { status: 503 })))
      .rejects.toMatchObject({ code: "registration_failed" });
    await expect(registerTodoistClient(redirectUri, async () => new Response(JSON.stringify({ client_id: "tdd_fixture_client" }), { status: 201 })))
      .rejects.toMatchObject({ code: "invalid_response" });
    await expect(registerTodoistClient(redirectUri, async () => new Response(JSON.stringify({ ...registrationResponseBody(), client_secret: "must-not-be-stored" }), { status: 201 })))
      .rejects.toMatchObject({ code: "invalid_response" });
  });

  it("exchanges code without a client secret and stores only session credentials", async () => {
    const storage = new MemoryStorage();
    let exchangeEndpoint = "";
    let exchangeBody = "";
    const client = new TodoistOAuthClient(config, storage, identity, (async (input, init) => {
      exchangeEndpoint = String(input);
      exchangeBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ access_token: "access-fixture", refresh_token: "refresh-fixture", expires_in: 3600, scope: "data:read" }), { status: 200 });
    }) as typeof fetch, () => 1_000_000);
    await client.connect();
    expect(exchangeEndpoint).toBe(TODOIST_OAUTH_TOKEN_ENDPOINT);
    expect(exchangeBody).toContain("grant_type=authorization_code");
    expect(exchangeBody).toContain("code_verifier=");
    expect(exchangeBody).not.toContain("client_secret");
    expect(await client.getAccessToken()).toBe("access-fixture");
    expect(JSON.stringify(await storage.get("todoist-oauth-session-v1"))).not.toContain("client_secret");
  });

  it("retains the current refresh token when a successful retry omits a replacement", async () => {
    const storage = new MemoryStorage();
    await storage.set({ "todoist-oauth-session-v1": { accessToken: "expired-access", refreshToken: "refresh-original", expiresAt: 1, scope: "data:read" } });
    const client = new TodoistOAuthClient(config, storage, identity, async () => new Response(JSON.stringify({ access_token: "access-refreshed", expires_in: 3600, scope: "data:read" }), { status: 200 }), () => 1_000_000);
    await expect(client.getAccessToken(true)).resolves.toBe("access-refreshed");
    expect((await storage.get<{ refreshToken: string }>("todoist-oauth-session-v1"))?.refreshToken).toBe("refresh-original");
  });

  it("distinguishes token network failures from sanitized OAuth HTTP errors", async () => {
    const networkClient = new TodoistOAuthClient(config, new MemoryStorage(), identity, async () => {
      throw new Error("network-secret-fixture");
    });
    await expect(networkClient.connect()).rejects.toMatchObject({
      code: "network_error",
      message: "Todoist token exchange could not reach the authorization server; check your connection and try again."
    });

    const httpClient = new TodoistOAuthClient(config, new MemoryStorage(), identity, async () => new Response(
      JSON.stringify({ error: "invalid_grant", error_description: "token-secret-fixture" }),
      { status: 400 }
    ));
    await expect(httpClient.connect()).rejects.toMatchObject({
      code: "oauth_error",
      message: "Todoist token exchange was rejected by Todoist (400: invalid_grant)"
    });
  });

  it("fails before authorization when the stored redirect binding is stale", async () => {
    let launched = false;
    const client = new TodoistOAuthClient({ ...config, redirectUri: "https://old-extension.chromiumapp.org/todoist" }, new MemoryStorage(), {
      getRedirectURL: () => redirectUri,
      launchWebAuthFlow: async () => { launched = true; return undefined; }
    });
    await expect(client.connect()).rejects.toMatchObject({ code: "redirect_mismatch" });
    expect(launched).toBe(false);
  });

  it("turns provider client-identity errors into an actionable reconnect error", async () => {
    const callbackIdentity = {
      getRedirectURL: () => redirectUri,
      launchWebAuthFlow: async () => `${redirectUri}?error=invalid_client`
    };
    await expect(new TodoistOAuthClient(config, new MemoryStorage(), callbackIdentity).connect())
      .rejects.toMatchObject({ code: "client_mismatch" });
    const tokenIdentity = {
      getRedirectURL: () => redirectUri,
      launchWebAuthFlow: identity.launchWebAuthFlow
    };
    await expect(new TodoistOAuthClient(config, new MemoryStorage(), tokenIdentity, async () => new Response(JSON.stringify({ error: "incorrect_application_credentials" }), { status: 400 })).connect())
      .rejects.toMatchObject({ code: "client_mismatch" });
  });

  it("disconnects session tokens while preserving local registration metadata", async () => {
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    const registration = registrationFixture();
    await saveConfig(localStorage, { sectionId: "section-fixture", registration });
    await sessionStorage.set({ "todoist-oauth-session-v1": { accessToken: "access-fixture", refreshToken: "refresh-fixture", expiresAt: 2_000_000, scope: "data:read" } });
    await new TodoistOAuthClient(config, sessionStorage, identity).disconnect();
    expect(await sessionStorage.get("todoist-oauth-session-v1")).toBeUndefined();
    expect((await loadConfig(localStorage))?.registration).toEqual(registration);
  });
});

function registrationFixture(): OAuthClientRegistration {
  return {
    clientId: "tdd_fixture_client",
    redirectUri,
    issuer: TODOIST_OAUTH_ISSUER,
    registrationEndpoint: TODOIST_OAUTH_REGISTRATION_ENDPOINT,
    authorizationEndpoint: TODOIST_OAUTH_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: TODOIST_OAUTH_TOKEN_ENDPOINT,
    registrationVersion: 3
  };
}

function registrationResponseBody(): Record<string, unknown> {
  return {
    client_id: "tdd_fixture_client",
    redirect_uris: [redirectUri],
    scope: "data:read",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none"
  };
}

function registrationResponse(): Response {
  return new Response(JSON.stringify(registrationResponseBody()), { status: 201 });
}
