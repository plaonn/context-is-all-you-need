import { TodoistApi } from "../core/api.js";
import { ensureTodoistClientRegistration, TodoistOAuthClient, OAuthError } from "../core/auth.js";
import { ProjectContextCache, ProjectContextCacheError, PROJECT_CONTEXT_CACHE_KEY } from "../core/cache.js";
import { renderError, renderSelection } from "../core/renderer.js";
import { ChromeStorage } from "../core/storage.js";
import { DEFAULT_CONFIG, loadConfig, saveConfig, type UserConfig } from "./config.js";

const localStorage = new ChromeStorage(chrome.storage.local);
const sessionStorage = new ChromeStorage(chrome.storage.session);
const setup = document.querySelector<HTMLElement>("#setup")!;
const setupForm = document.querySelector<HTMLFormElement>("#setup-form")!;
const sectionInput = document.querySelector<HTMLInputElement>("#section-id")!;
const dashboard = document.querySelector<HTMLElement>("#dashboard")!;
const status = document.querySelector<HTMLElement>("#status")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#settings")!;
const disconnectButton = document.querySelector<HTMLButtonElement>("#disconnect")!;
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel")!;

let config: UserConfig | null = null;
let auth: TodoistOAuthClient | null = null;
let cache: ProjectContextCache | null = null;
let selectedRootId: string | undefined;

void boot();

async function boot(): Promise<void> {
  config = await loadConfig(localStorage);
  if (!config?.registration) {
    showSetup();
    return;
  }
  if (config.registration.redirectUri !== chrome.identity.getRedirectURL("todoist")) {
    showSetup("This unpacked extension identity changed. Click Connect Todoist to register it again.");
    return;
  }
  configure(config);
  if (!(await auth!.hasSession())) {
    showSetup("Connect Todoist with the read-only data:read scope to render project context.");
    return;
  }
  await readDashboard();
}

function configure(next: UserConfig): void {
  config = next;
  if (!next.registration) {
    auth = null;
    cache = null;
    return;
  }
  auth = new TodoistOAuthClient({
    clientId: next.registration.clientId,
    scope: DEFAULT_CONFIG.scope,
    redirectPath: DEFAULT_CONFIG.redirectPath,
    redirectUri: next.registration.redirectUri
  }, sessionStorage, chrome.identity);
  const api = new TodoistApi(auth);
  cache = new ProjectContextCache(api, config.sectionId, {
    storage: sessionStorage,
    freshTtlMs: config.freshTtlMs,
    staleTtlMs: config.staleTtlMs
  });
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveAndConnect();
});

refreshButton.addEventListener("click", () => {
  void readDashboard(true);
});

settingsButton.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

disconnectButton.addEventListener("click", () => {
  void disconnect();
});

async function saveAndConnect(): Promise<void> {
  const sectionId = sectionInput.value.trim();
  if (!sectionId) {
    setStatus("A Todoist section ID is required.", "error");
    return;
  }
  try {
    const registration = await ensureTodoistClientRegistration(config?.registration, chrome.identity, DEFAULT_CONFIG.redirectPath);
    const saved = await saveConfig(localStorage, { sectionId, registration });
    configure(saved);
    setStatus("Opening Todoist authorization…", "info");
    await auth!.connect();
    hideSetup();
    await readDashboard(true);
  } catch (error) {
    if (error instanceof OAuthError && error.code === "client_mismatch") {
      config = await saveConfig(localStorage, { sectionId, registration: null });
      auth = null;
      cache = null;
      showSetup("Todoist rejected this client registration. The saved registration was cleared; click Connect Todoist to register this installation again.");
      return;
    }
    setStatus(error instanceof OAuthError ? error.message : "Could not connect to Todoist.", "error");
  }
}

async function disconnect(): Promise<void> {
  await auth?.disconnect();
  await sessionStorage.remove(PROJECT_CONTEXT_CACHE_KEY);
  cache = null;
  selectedRootId = undefined;
  dashboard.replaceChildren();
  showSetup("Todoist connection removed from this browser session.");
}

async function readDashboard(forceRefresh = false): Promise<void> {
  if (!cache) return;
  setStatus(forceRefresh ? "Refreshing bounded Todoist context…" : "Reading cached project context…", "info");
  try {
    const selection = await cache.readSelection(selectedRootId, forceRefresh);
    selectedRootId = selection.snapshot.id;
    dashboard.innerHTML = renderSelection(selection);
    const picker = dashboard.querySelector<HTMLSelectElement>("#project-select");
    picker?.addEventListener("change", () => {
      selectedRootId = picker.value;
      void readDashboard(false);
    });
    setStatus("Read-only projection ready.", selection.freshness.snapshot.error ? "warn" : "ok");
    if (selection.freshness.discovery.refreshing || selection.freshness.snapshot.refreshing) {
      window.setTimeout(() => void readDashboard(false), 0);
    }
  } catch (error) {
    const message = error instanceof ProjectContextCacheError || error instanceof OAuthError
      ? error.message
      : "Todoist project context could not be read.";
    dashboard.innerHTML = renderError(message);
    setStatus(message, "error");
  }
}

function showSetup(message?: string): void {
  setup.hidden = false;
  dashboard.hidden = true;
  if (config) {
    sectionInput.value = config.sectionId;
  }
  if (message) setStatus(message, "info");
}

function hideSetup(): void {
  setup.hidden = true;
  dashboard.hidden = false;
}

function setStatus(message: string, kind: "info" | "ok" | "warn" | "error"): void {
  status.textContent = message;
  status.dataset.kind = kind;
}
