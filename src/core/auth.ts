import type { KeyValueStorage, OAuthConfig, OAuthSession } from "./model.js";

const SESSION_KEY = "todoist-oauth-session-v1";
const PENDING_KEY = "todoist-oauth-pending-v1";
const EXPIRY_SAFETY_MS = 60_000;

export type AuthIdentity = {
  getRedirectURL(path?: string): string;
  launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string | undefined>;
};

export class OAuthError extends Error {
  constructor(public readonly code: "invalid_config" | "cancelled" | "state_mismatch" | "provider_error" | "invalid_response", message: string) {
    super(message);
  }
}

export class TodoistOAuthClient {
  constructor(
    private readonly config: OAuthConfig,
    private readonly storage: KeyValueStorage,
    private readonly identity: AuthIdentity,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now
  ) {}

  async connect(): Promise<void> {
    validateConfig(this.config);
    const redirectUri = this.identity.getRedirectURL(this.config.redirectPath);
    const state = randomBase64Url(32);
    const verifier = randomBase64Url(48);
    const challenge = await codeChallenge(verifier);
    await this.storage.set({ [PENDING_KEY]: { state, verifier, redirectUri } });
    try {
      const callback = await this.identity.launchWebAuthFlow({
        url: authorizationUrl(this.config, redirectUri, state, challenge),
        interactive: true
      });
      if (!callback) throw new OAuthError("cancelled", "Todoist authorization was cancelled");
      const callbackUrl = new URL(callback);
      const error = callbackUrl.searchParams.get("error");
      if (error) throw new OAuthError("provider_error", `Todoist authorization failed: ${safeToken(error)}`);
      const returnedState = callbackUrl.searchParams.get("state");
      const code = callbackUrl.searchParams.get("code");
      if (!code || returnedState !== state) throw new OAuthError("state_mismatch", "Todoist authorization state did not match");
      const session = await this.exchangeCode(code, verifier, redirectUri);
      await this.storage.set({ [SESSION_KEY]: session });
    } finally {
      await this.storage.remove(PENDING_KEY);
    }
  }

  async disconnect(): Promise<void> {
    await this.storage.remove([SESSION_KEY, PENDING_KEY]);
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    const session = await this.storage.get<OAuthSession>(SESSION_KEY);
    if (!session || typeof session.accessToken !== "string") {
      throw new OAuthError("provider_error", "Todoist is not connected");
    }
    if (!forceRefresh && session.expiresAt > this.now() + EXPIRY_SAFETY_MS) return session.accessToken;
    if (!session.refreshToken) throw new OAuthError("provider_error", "Todoist authorization needs to be renewed");
    const refreshed = await this.refresh(session.refreshToken);
    await this.storage.set({ [SESSION_KEY]: refreshed });
    return refreshed.accessToken;
  }

  async hasSession(): Promise<boolean> {
    const session = await this.storage.get<OAuthSession>(SESSION_KEY);
    return Boolean(session?.accessToken);
  }

  private async exchangeCode(code: string, verifier: string, redirectUri: string): Promise<OAuthSession> {
    return this.tokenRequest({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    });
  }

  private async refresh(refreshToken: string): Promise<OAuthSession> {
    return this.tokenRequest({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      scope: this.config.scope
    });
  }

  private async tokenRequest(values: Record<string, string>): Promise<OAuthSession> {
    let response: Response;
    try {
      response = await this.fetcher("https://api.todoist.com/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(values).toString()
      });
    } catch {
      throw new OAuthError("provider_error", "Todoist token exchange failed");
    }
    if (!response.ok) throw new OAuthError("provider_error", `Todoist token exchange failed (${response.status})`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new OAuthError("invalid_response", "Todoist token response was not valid JSON");
    }
    if (!isRecord(body) || typeof body.access_token !== "string") {
      throw new OAuthError("invalid_response", "Todoist token response did not contain an access token");
    }
    const expiresIn = typeof body.expires_in === "number" && Number.isFinite(body.expires_in) ? body.expires_in : 3_600;
    return {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
      expiresAt: this.now() + Math.max(60, expiresIn) * 1_000,
      scope: typeof body.scope === "string" ? body.scope : this.config.scope
    };
  }
}

export function authorizationUrl(config: OAuthConfig, redirectUri: string, state: string, challenge: string): string {
  validateConfig(config);
  const url = new URL("https://app.todoist.com/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function validateConfig(config: OAuthConfig): void {
  try {
    const url = new URL(config.clientId);
    if (url.protocol !== "https:" || !url.pathname || url.pathname === "/") throw new Error("client id URL must be HTTPS with a path");
  } catch {
    throw new OAuthError("invalid_config", "Todoist client ID must be an HTTPS metadata URL");
  }
  if (config.scope !== "data:read") throw new OAuthError("invalid_config", "Only Todoist data:read scope is supported");
  if (!/^[a-z0-9/_-]{1,64}$/i.test(config.redirectPath)) throw new OAuthError("invalid_config", "Invalid extension redirect path");
}

function randomBase64Url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeToken(value: string): string {
  return value.replace(/[\r\n]/g, " ").slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
