import {
  OAUTH_CLIENT_REGISTRATION_VERSION,
  TODOIST_OAUTH_AUTHORIZATION_ENDPOINT,
  TODOIST_OAUTH_ISSUER,
  TODOIST_OAUTH_REGISTRATION_ENDPOINT,
  TODOIST_OAUTH_TOKEN_ENDPOINT,
  type KeyValueStorage,
  type OAuthClientRegistration,
  type OAuthConfig,
  type OAuthSession
} from "./model.js";

const SESSION_KEY = "todoist-oauth-session-v1";
const PENDING_KEY = "todoist-oauth-pending-v1";
const EXPIRY_SAFETY_MS = 60_000;
const REGISTRATION_ENDPOINT = TODOIST_OAUTH_REGISTRATION_ENDPOINT;
const AUTHORIZATION_ENDPOINT = TODOIST_OAUTH_AUTHORIZATION_ENDPOINT;
const TOKEN_ENDPOINT = TODOIST_OAUTH_TOKEN_ENDPOINT;
const SAFE_OAUTH_ERROR_CODES = new Set([
  "access_denied",
  "bad_authorization_code",
  "incorrect_application_credentials",
  "invalid_application_status",
  "invalid_client",
  "invalid_client_metadata",
  "invalid_grant",
  "invalid_request",
  "invalid_scope",
  "unsupported_grant_type",
  "unsupported_response_type"
]);

let registrationFlight: { redirectUri: string; promise: Promise<OAuthClientRegistration> } | null = null;

export type AuthIdentity = {
  getRedirectURL(path?: string): string;
  launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string | undefined>;
};

export class OAuthError extends Error {
  constructor(
    public readonly code:
      | "invalid_config"
      | "cancelled"
      | "state_mismatch"
      | "provider_error"
      | "network_error"
      | "oauth_error"
      | "invalid_response"
      | "registration_failed"
      | "registration_rate_limited"
      | "redirect_mismatch"
      | "client_mismatch",
    message: string
  ) {
    super(message);
  }
}

export async function ensureTodoistClientRegistration(
  existing: OAuthClientRegistration | null | undefined,
  identity: AuthIdentity,
  redirectPath: string,
  fetcher: typeof fetch = fetch
): Promise<OAuthClientRegistration> {
  const redirectUri = identity.getRedirectURL(redirectPath);
  const stored = normalizeOAuthClientRegistration(existing);
  if (stored && stored.redirectUri === redirectUri) return stored;

  if (registrationFlight?.redirectUri === redirectUri) return registrationFlight.promise;
  const promise = registerTodoistClient(redirectUri, fetcher);
  registrationFlight = { redirectUri, promise };
  try {
    return await promise;
  } finally {
    if (registrationFlight?.promise === promise) registrationFlight = null;
  }
}

export async function registerTodoistClient(
  redirectUri: string,
  fetcher: typeof fetch = fetch
): Promise<OAuthClientRegistration> {
  if (!isValidRedirectUri(redirectUri)) {
    throw new OAuthError("invalid_config", "Todoist redirect identity was not a valid HTTPS URL");
  }

  let response: Response;
  try {
    response = await fetcher(REGISTRATION_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Context Is All You Need",
        redirect_uris: [redirectUri],
        scope: "data:read",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none"
      })
    });
  } catch {
    throw new OAuthError("registration_failed", "Could not reach Todoist client registration.");
  }
  if (response.status === 429) {
    throw new OAuthError("registration_rate_limited", "Todoist client registration is rate-limited; wait before trying again.");
  }
  if (!response.ok) {
    throw new OAuthError("registration_failed", `Todoist client registration failed (${response.status})`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OAuthError("invalid_response", "Todoist client registration returned invalid metadata.");
  }
  return parseRegistrationResponse(body, redirectUri);
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
    if (redirectUri !== this.config.redirectUri) {
      throw new OAuthError(
        "redirect_mismatch",
        "This extension's current redirect identity changed. Click Connect Todoist to register this installation again."
      );
    }
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
      let callbackUrl: URL;
      try {
        callbackUrl = new URL(callback);
      } catch {
        throw new OAuthError("invalid_response", "Todoist authorization returned an invalid callback URL");
      }
      const expectedRedirect = new URL(redirectUri);
      if (callbackUrl.origin !== expectedRedirect.origin || callbackUrl.pathname !== expectedRedirect.pathname) {
        throw new OAuthError("redirect_mismatch", "Todoist authorization returned a different extension redirect identity");
      }
      const error = callbackUrl.searchParams.get("error");
      if (isClientMismatchCode(error)) throw clientMismatchError();
      if (error) {
        const safeCode = safeOAuthErrorCode(error);
        throw new OAuthError("oauth_error", `Todoist authorization was rejected${safeCode ? ` (${safeCode})` : ""}`);
      }
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
    }, refreshToken);
  }

  private async tokenRequest(values: Record<string, string>, fallbackRefreshToken: string | null = null): Promise<OAuthSession> {
    let response: Response;
    try {
      response = await this.fetcher(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(values).toString()
      });
    } catch {
      throw new OAuthError("network_error", "Todoist token exchange could not reach the authorization server; check your connection and try again.");
    }
    if (!response.ok) {
      const errorCode = await responseErrorCode(response);
      if (isClientMismatchCode(errorCode)) throw clientMismatchError();
      throw new OAuthError("oauth_error", oauthHttpError("Todoist token exchange", response.status, errorCode));
    }
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
      refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : fallbackRefreshToken,
      expiresAt: this.now() + Math.max(60, expiresIn) * 1_000,
      scope: typeof body.scope === "string" ? body.scope : this.config.scope
    };
  }
}

export function authorizationUrl(config: OAuthConfig, redirectUri: string, state: string, challenge: string): string {
  validateConfig(config);
  if (redirectUri !== config.redirectUri) {
    throw new OAuthError("redirect_mismatch", "Todoist authorization redirect did not match the registered extension identity");
  }
  const url = new URL(AUTHORIZATION_ENDPOINT);
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
  if (!isDynamicClientId(config.clientId) && !isMetadataClientId(config.clientId)) {
    throw new OAuthError("invalid_config", "Todoist client ID must be a dynamic public ID or an HTTPS metadata URL");
  }
  if (config.scope !== "data:read") throw new OAuthError("invalid_config", "Only Todoist data:read scope is supported");
  if (!/^[a-z0-9/_-]{1,64}$/i.test(config.redirectPath)) throw new OAuthError("invalid_config", "Invalid extension redirect path");
  if (!isValidRedirectUri(config.redirectUri)) throw new OAuthError("invalid_config", "Todoist redirect identity was not a valid HTTPS URL");
}

export function isOAuthClientRegistration(value: unknown): value is OAuthClientRegistration {
  return normalizeOAuthClientRegistration(value) !== null;
}

export function normalizeOAuthClientRegistration(value: unknown): OAuthClientRegistration | null {
  if (isRecord(value)
    && value.registrationVersion === OAUTH_CLIENT_REGISTRATION_VERSION
    && value.issuer === TODOIST_OAUTH_ISSUER
    && value.registrationEndpoint === TODOIST_OAUTH_REGISTRATION_ENDPOINT
    && value.authorizationEndpoint === TODOIST_OAUTH_AUTHORIZATION_ENDPOINT
    && value.tokenEndpoint === TODOIST_OAUTH_TOKEN_ENDPOINT
    && typeof value.clientId === "string"
    && isDynamicClientId(value.clientId)
    && typeof value.redirectUri === "string"
    && isValidRedirectUri(value.redirectUri)) {
    return {
      clientId: value.clientId,
      redirectUri: value.redirectUri,
      issuer: TODOIST_OAUTH_ISSUER,
      registrationEndpoint: TODOIST_OAUTH_REGISTRATION_ENDPOINT,
      authorizationEndpoint: TODOIST_OAUTH_AUTHORIZATION_ENDPOINT,
      tokenEndpoint: TODOIST_OAUTH_TOKEN_ENDPOINT,
      registrationVersion: OAUTH_CLIENT_REGISTRATION_VERSION
    };
  }
  return null;
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

function clientMismatchError(): OAuthError {
  return new OAuthError("client_mismatch", "Todoist rejected this client registration. Click Connect Todoist to register this installation again.");
}

function oauthHttpError(operation: string, status: number, errorCode: string | null): string {
  const safeCode = safeOAuthErrorCode(errorCode);
  return `${operation} was rejected by Todoist (${status}${safeCode ? `: ${safeCode}` : ""})`;
}

function isClientMismatchCode(value: string | null): boolean {
  return value === "invalid_client" || value === "incorrect_application_credentials";
}

function safeOAuthErrorCode(value: string | null): string | null {
  if (!value || !/^[a-z0-9_]{1,64}$/.test(value)) return null;
  return SAFE_OAUTH_ERROR_CODES.has(value) ? value : null;
}

async function responseErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

function parseRegistrationResponse(body: unknown, redirectUri: string): OAuthClientRegistration {
  if (!isRecord(body) || Object.prototype.hasOwnProperty.call(body, "client_secret")) {
    throw new OAuthError("invalid_response", "Todoist client registration did not return a public client.");
  }
  const clientId = body.client_id;
  const redirectUris = body.redirect_uris;
  if (
    typeof clientId !== "string"
    || !isDynamicClientId(clientId)
    || !Array.isArray(redirectUris)
    || !redirectUris.includes(redirectUri)
    || body.scope !== "data:read"
    || body.token_endpoint_auth_method !== "none"
    || !includesString(body.grant_types, "authorization_code")
    || !includesString(body.grant_types, "refresh_token")
    || !includesString(body.response_types, "code")
  ) {
    throw new OAuthError("invalid_response", "Todoist client registration metadata did not match the public read-only contract.");
  }
  return {
    clientId,
    redirectUri,
    issuer: TODOIST_OAUTH_ISSUER,
    registrationEndpoint: TODOIST_OAUTH_REGISTRATION_ENDPOINT,
    authorizationEndpoint: TODOIST_OAUTH_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: TODOIST_OAUTH_TOKEN_ENDPOINT,
    registrationVersion: OAUTH_CLIENT_REGISTRATION_VERSION
  };
}

function includesString(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string") && value.includes(expected);
}

function isDynamicClientId(value: string): boolean {
  return /^tdd_[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isMetadataClientId(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.pathname) && url.pathname !== "/";
  } catch {
    return false;
  }
}

function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
