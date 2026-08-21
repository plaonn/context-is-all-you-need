import { TodoistApi } from "../core/api.js";
import { ensureTodoistClientRegistration, TodoistOAuthClient, OAuthError } from "../core/auth.js";
import {
  ProjectContextBoardCache,
  ProjectContextCacheError,
  PROJECT_CONTEXT_BOARD_CACHE_KEY,
  PROJECT_CONTEXT_CACHE_KEY
} from "../core/cache.js";
import { renderBoard, renderContextSettings, renderError } from "../core/renderer.js";
import type { ProjectContextContext } from "../core/model.js";
import { ChromeStorage } from "../core/storage.js";
import { DEFAULT_CONFIG, loadConfig, saveConfig, type ContextConfig, type UserConfig } from "./config.js";

const localStorage = new ChromeStorage(chrome.storage.local);
const sessionStorage = new ChromeStorage(chrome.storage.session);
const setup = document.querySelector<HTMLElement>("#setup")!;
const setupForm = document.querySelector<HTMLFormElement>("#setup-form")!;
const contextLabelInput = document.querySelector<HTMLInputElement>("#context-label")!;
const sectionInput = document.querySelector<HTMLInputElement>("#section-id")!;
const dashboard = document.querySelector<HTMLElement>("#dashboard")!;
const status = document.querySelector<HTMLElement>("#status")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#settings")!;
const disconnectButton = document.querySelector<HTMLButtonElement>("#disconnect")!;
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel")!;
const contextSettings = document.querySelector<HTMLElement>("#context-settings")!;

let config: UserConfig | null = null;
let auth: TodoistOAuthClient | null = null;
let boardCache: ProjectContextBoardCache | null = null;
const expandedProjectIds = new Set<string>();

void boot();

async function boot(): Promise<void> {
  config = await loadConfig(localStorage);
  if (!config) {
    showSetup();
    return;
  }
  if (config.needsMigration) {
    config = await saveConfig(localStorage, {
      contexts: config.contexts,
      selectedContextKey: config.selectedContextKey,
      registration: config.registration
    });
  }
  renderSettings();
  if (!config.registration || config.contexts.length === 0) {
    showSetup(config.contexts.length === 0 ? "Add a local Context mapping to begin." : undefined);
    return;
  }
  if (config.registration.redirectUri !== chrome.identity.getRedirectURL("todoist")) {
    showSetup("This unpacked extension identity changed. Click Connect Todoist to register it again.");
    return;
  }
  configure(config);
  if (!(await auth!.hasSession())) {
    showSetup("Connect Todoist with the read-only data:read scope to render context board.");
    return;
  }
  hideSetup();
  await readBoard();
}

function configure(next: UserConfig): void {
  config = next;
  if (!next.registration) {
    auth = null;
    boardCache = null;
    renderSettings();
    return;
  }
  auth = new TodoistOAuthClient({
    clientId: next.registration.clientId,
    scope: DEFAULT_CONFIG.scope,
    redirectPath: DEFAULT_CONFIG.redirectPath,
    redirectUri: next.registration.redirectUri
  }, sessionStorage, chrome.identity);
  const api = new TodoistApi(auth);
  boardCache = new ProjectContextBoardCache(api, {
    storage: sessionStorage,
    freshTtlMs: next.freshTtlMs,
    staleTtlMs: next.staleTtlMs,
    maxProjectConcurrency: 4
  });
  renderSettings();
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveAndConnect();
});

refreshButton.addEventListener("click", () => {
  void readBoard(true);
});

settingsButton.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

disconnectButton.addEventListener("click", () => {
  void disconnect();
});

async function saveAndConnect(): Promise<void> {
  const label = contextLabelInput.value.trim();
  const sectionId = sectionInput.value.trim();
  if (!label) {
    setStatus("A Context label is required.", "error");
    return;
  }
  if (!sectionId) {
    setStatus("A Todoist section ID is required.", "error");
    return;
  }
  try {
    const registration = await ensureTodoistClientRegistration(config?.registration, chrome.identity, DEFAULT_CONFIG.redirectPath);
    const existing = selectedContext();
    const contexts = existing
      ? (config?.contexts ?? []).map((context) => context.localKey === existing.localKey ? { ...context, label, sectionId } : context)
      : [...(config?.contexts ?? []), newContext(label, sectionId)];
    const selectedContextKey = existing?.localKey ?? contexts.at(-1)?.localKey ?? null;
    const saved = await saveConfig(localStorage, { contexts, selectedContextKey, registration });
    configure(saved);
    setStatus("Opening Todoist authorization…", "info");
    await auth!.connect();
    hideSetup();
    await readBoard(true);
  } catch (error) {
    if (error instanceof OAuthError && error.code === "client_mismatch") {
      config = await saveConfig(localStorage, {
        contexts: config?.contexts ?? [],
        selectedContextKey: config?.selectedContextKey ?? null,
        registration: null
      });
      configure(config);
      showSetup("Todoist rejected this client registration. The saved registration was cleared; click Connect Todoist to register this installation again.");
      return;
    }
    setStatus(error instanceof OAuthError ? error.message : "Could not connect to Todoist.", "error");
  }
}

async function disconnect(): Promise<void> {
  await auth?.disconnect();
  await sessionStorage.remove([PROJECT_CONTEXT_CACHE_KEY, PROJECT_CONTEXT_BOARD_CACHE_KEY]);
  boardCache = null;
  expandedProjectIds.clear();
  dashboard.replaceChildren();
  showSetup("Todoist connection removed from this browser session.");
}

async function readBoard(forceRefresh = false): Promise<void> {
  const context = selectedContext();
  if (!boardCache || !config || !context) {
    showSetup("Add a local Context mapping to begin.");
    return;
  }
  setStatus(forceRefresh ? "Refreshing selected Context…" : "Reading cached Context board…", "info");
  try {
    const board = await boardCache.readBoard(context, forceRefresh);
    dashboard.innerHTML = renderBoard(board, config.contexts, expandedProjectIds);
    bindBoardControls();
    const hasWarnings = Boolean(board.freshness.error) || board.projects.some((project) => project.error);
    setStatus(hasWarnings ? "Context board ready with bounded read warnings." : "Context board ready.", hasWarnings ? "warn" : "ok");
  } catch (error) {
    const message = error instanceof ProjectContextCacheError || error instanceof OAuthError
      ? error.message
      : "Todoist context board could not be read.";
    dashboard.innerHTML = renderError(message);
    setStatus(message, "error");
  }
}

function bindBoardControls(): void {
  const picker = dashboard.querySelector<HTMLSelectElement>("#context-select");
  picker?.addEventListener("change", () => {
    void switchContext(picker.value);
  });
  dashboard.querySelectorAll<HTMLButtonElement>("[data-project-expand]").forEach((button) => {
    button.addEventListener("click", () => {
      void toggleProject(button.dataset.projectExpand ?? "");
    });
  });
}

async function switchContext(localKey: string): Promise<void> {
  if (!config || !config.contexts.some((context) => context.localKey === localKey)) return;
  config = await saveConfig(localStorage, {
    contexts: config.contexts,
    selectedContextKey: localKey,
    registration: config.registration
  });
  expandedProjectIds.clear();
  configure(config);
  await readBoard();
}

async function toggleProject(rootTaskId: string): Promise<void> {
  if (!rootTaskId || !config || !boardCache) return;
  if (expandedProjectIds.has(rootTaskId)) {
    expandedProjectIds.delete(rootTaskId);
    await readBoard();
    return;
  }
  expandedProjectIds.add(rootTaskId);
  const context = selectedContext();
  if (!context) return;
  setStatus("Loading bounded project history…", "info");
  try {
    await boardCache.readDetail(context, rootTaskId);
    await readBoard();
  } catch (error) {
    expandedProjectIds.delete(rootTaskId);
    const message = error instanceof ProjectContextCacheError ? error.message : "Project detail could not be read.";
    setStatus(message, "warn");
    await readBoard();
  }
}

function renderSettings(): void {
  if (!config) {
    contextSettings.replaceChildren();
    return;
  }
  contextSettings.innerHTML = renderContextSettings(config.contexts, config.selectedContextKey);
  const form = contextSettings.querySelector<HTMLFormElement>("#context-settings-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveContextMapping();
  });
  contextSettings.querySelector<HTMLButtonElement>("#context-cancel")?.addEventListener("click", resetContextForm);
  contextSettings.querySelectorAll<HTMLButtonElement>("[data-context-edit]").forEach((button) => {
    button.addEventListener("click", () => startContextEdit(button.dataset.contextEdit ?? ""));
  });
  contextSettings.querySelectorAll<HTMLButtonElement>("[data-context-remove]").forEach((button) => {
    button.addEventListener("click", () => void removeContext(button.dataset.contextRemove ?? ""));
  });
}

function startContextEdit(localKey: string): void {
  const context = config?.contexts.find((candidate) => candidate.localKey === localKey);
  if (!context) return;
  const label = contextSettings.querySelector<HTMLInputElement>("#context-label-input");
  const section = contextSettings.querySelector<HTMLInputElement>("#context-section-input");
  const editKey = contextSettings.querySelector<HTMLInputElement>("#context-edit-key");
  const save = contextSettings.querySelector<HTMLButtonElement>("#context-save");
  const cancel = contextSettings.querySelector<HTMLButtonElement>("#context-cancel");
  if (!label || !section || !editKey || !save || !cancel) return;
  label.value = context.label;
  section.value = context.sectionId;
  editKey.value = context.localKey;
  save.textContent = "Save context";
  cancel.hidden = false;
  label.focus();
}

function resetContextForm(): void {
  const form = contextSettings.querySelector<HTMLFormElement>("#context-settings-form");
  const editKey = contextSettings.querySelector<HTMLInputElement>("#context-edit-key");
  const save = contextSettings.querySelector<HTMLButtonElement>("#context-save");
  const cancel = contextSettings.querySelector<HTMLButtonElement>("#context-cancel");
  form?.reset();
  if (editKey) editKey.value = "";
  if (save) save.textContent = "Add context";
  if (cancel) cancel.hidden = true;
}

async function saveContextMapping(): Promise<void> {
  if (!config) return;
  const labelInput = contextSettings.querySelector<HTMLInputElement>("#context-label-input");
  const sectionInputElement = contextSettings.querySelector<HTMLInputElement>("#context-section-input");
  const editKey = contextSettings.querySelector<HTMLInputElement>("#context-edit-key");
  const label = labelInput?.value.trim() ?? "";
  const sectionId = sectionInputElement?.value.trim() ?? "";
  const editingKey = editKey?.value.trim() ?? "";
  if (!label || !sectionId) {
    setStatus("A Context label and Todoist section ID are required.", "error");
    return;
  }
  const contexts = editingKey
    ? config.contexts.map((context) => context.localKey === editingKey ? { ...context, label, sectionId } : context)
    : [...config.contexts, newContext(label, sectionId)];
  config = await saveConfig(localStorage, {
    contexts,
    selectedContextKey: config.selectedContextKey ?? contexts[0]?.localKey ?? null,
    registration: config.registration
  });
  configure(config);
  resetContextForm();
  if (config.contexts.length === 0 || !auth || !(await auth.hasSession())) {
    showSetup("Connect Todoist after adding a Context mapping.");
    return;
  }
  hideSetup();
  await readBoard(true);
}

async function removeContext(localKey: string): Promise<void> {
  if (!config) return;
  await boardCache?.forgetContext(localKey);
  const contexts = config.contexts.filter((context) => context.localKey !== localKey);
  const selectedContextKey = config.selectedContextKey === localKey ? contexts[0]?.localKey ?? null : config.selectedContextKey;
  config = await saveConfig(localStorage, { contexts, selectedContextKey, registration: config.registration });
  expandedProjectIds.clear();
  configure(config);
  if (contexts.length === 0) {
    showSetup("All Context mappings were removed locally. Add one to continue.");
    return;
  }
  if (auth && await auth.hasSession()) await readBoard(true);
  else showSetup("Connect Todoist after adding a Context mapping.");
}

function selectedContext(): ContextConfig | null {
  if (!config) return null;
  return config.contexts.find((context) => context.localKey === config?.selectedContextKey) ?? config.contexts[0] ?? null;
}

function newContext(label: string, sectionId: string): ContextConfig {
  const localKey = typeof crypto.randomUUID === "function" ? `context-${crypto.randomUUID()}` : `context-${Date.now().toString(36)}`;
  return { localKey, label, sectionId };
}

function showSetup(message?: string): void {
  setup.hidden = false;
  dashboard.hidden = true;
  settingsPanel.hidden = true;
  const context = selectedContext();
  contextLabelInput.value = context?.label ?? "";
  sectionInput.value = context?.sectionId ?? "";
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
