import { TodoistApi } from "../core/api.js";
import { TodoistOAuthClient, OAuthError } from "../core/auth.js";
import { ProjectContextCache, ProjectContextCacheError, PROJECT_CONTEXT_CACHE_KEY } from "../core/cache.js";
import { renderError, renderSelection } from "../core/renderer.js";
import { ChromeStorage } from "../core/storage.js";
import { loadConfig, saveConfig, type UserConfig } from "./config.js";

const localStorage = new ChromeStorage(chrome.storage.local);
const sessionStorage = new ChromeStorage(chrome.storage.session);
const setup = document.querySelector<HTMLElement>("#setup")!;
const setupForm = document.querySelector<HTMLFormElement>("#setup-form")!;
const sectionInput = document.querySelector<HTMLInputElement>("#section-id")!;
const clientIdInput = document.querySelector<HTMLInputElement>("#client-id")!;
const redirectOutput = document.querySelector<HTMLElement>("#redirect-uri")!;
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
  redirectOutput.textContent = chrome.identity.getRedirectURL("todoist");
  config = await loadConfig(localStorage);
  if (!config) {
    showSetup();
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
  auth = new TodoistOAuthClient(config, sessionStorage, chrome.identity);
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
  const clientId = clientIdInput.value.trim();
  if (!sectionId || !clientId) {
    setStatus("Section ID and public client metadata URL are required.", "error");
    return;
  }
  try {
    const saved = await saveConfig(localStorage, { sectionId, clientId });
    configure(saved);
    setStatus("Opening Todoist authorization…", "info");
    await auth!.connect();
    hideSetup();
    await readDashboard(true);
  } catch (error) {
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
    clientIdInput.value = config.clientId;
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
