import type { KeyValueStorage } from "./model.js";

export class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : clone(value) as T;
  }

  async set(values: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(values)) this.values.set(key, clone(value));
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of (Array.isArray(keys) ? keys : [keys])) this.values.delete(key);
  }
}

export class ChromeStorage implements KeyValueStorage {
  constructor(private readonly area: ChromeStorageAreaLike) {}

  async get<T>(key: string): Promise<T | undefined> {
    const values = await this.area.get([key]);
    return values[key] as T | undefined;
  }

  async set(values: Record<string, unknown>): Promise<void> {
    await this.area.set(values);
  }

  async remove(keys: string | string[]): Promise<void> {
    await this.area.remove(keys);
  }
}

export type ChromeStorageAreaLike = {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
