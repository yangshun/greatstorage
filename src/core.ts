import { stringify, parse } from "devalue";
import type { CreateStorageOptions, GreatStorage, Serializer, StorageOptions } from "./types";

const ENTRY_MARKER = "__gs";

interface StorageEntryEnvelope {
  [key: string]: unknown;
  value: unknown;
  version: number;
  expiry: number | null;
}

function isStorageEntry(data: unknown): data is StorageEntryEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    ENTRY_MARKER in data &&
    (data as Record<string, unknown>)[ENTRY_MARKER] === true &&
    "value" in data &&
    "version" in data &&
    "expiry" in data
  );
}

export function createStorage(options: CreateStorageOptions = {}): GreatStorage {
  const storage = options.storage ?? localStorage;
  const separator = options.separator ?? ":";
  const prefix = options.prefix ? options.prefix + separator : "";
  const serializer: Serializer = options.serializer ?? { stringify, parse };

  function prefixedKey(key: string): string {
    return prefix + key;
  }

  function get<T = unknown>(key: string): T | null {
    const raw = storage.getItem(prefixedKey(key));
    if (raw === null) {
      return null;
    }

    let entry: unknown;
    try {
      entry = serializer.parse(raw);
    } catch {
      // Unrecognized format — try JSON.parse for backwards compatibility
      try {
        entry = JSON.parse(raw);
      } catch {
        // Raw string that isn't valid JSON — return null to avoid confusion, since Storage always returns null for missing keys
        return null;
      }
    }

    if (!isStorageEntry(entry)) {
      // Only return values that were created by greatstorage (has the entry marker). This allows greatstorage to coexist with other data in the same storage.
      return null;
    }

    if (entry.expiry != null && Date.now() > entry.expiry) {
      storage.removeItem(prefixedKey(key));
      return null;
    }

    return entry.value as T;
  }

  function set<T = unknown>(key: string, value: T, options?: StorageOptions): void {
    const entry: StorageEntryEnvelope = {
      [ENTRY_MARKER]: true as const,
      version: 1, // Useful for future-proofing in case we need to change the storage format
      value,
      expiry: options?.ttl != null ? Date.now() + options.ttl : null,
    };
    storage.setItem(prefixedKey(key), serializer.stringify(entry));
  }

  function remove(key: string): void {
    storage.removeItem(prefixedKey(key));
  }

  function removeEntries(predicate: (entry: StorageEntryEnvelope) => boolean): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === null) {
        continue;
      }

      if (prefix && !key.startsWith(prefix)) {
        continue;
      }

      const raw = storage.getItem(key);
      if (raw === null) {
        continue;
      }

      try {
        const entry = serializer.parse(raw);
        if (isStorageEntry(entry) && predicate(entry)) {
          keysToRemove.push(key);
        }
      } catch {
        // Not a greatstorage entry, skip
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  }

  function clear(): void {
    removeEntries(() => true);
  }

  function clearExpired(): void {
    removeEntries((entry) => entry.expiry != null && Date.now() > entry.expiry);
  }

  function has(key: string): boolean {
    const raw = storage.getItem(prefixedKey(key));

    if (raw === null) {
      return false;
    }

    try {
      const entry = serializer.parse(raw);
      if (!isStorageEntry(entry)) {
        return false;
      }

      if (entry.expiry != null && Date.now() > entry.expiry) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  return { get, set, remove, clear, clearExpired, has };
}
