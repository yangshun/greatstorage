import { stringify, parse } from 'devalue';
import type {
  CreateStorageOptions,
  GetOptions,
  GreatStorage,
  Serializer,
  StorageOptions,
} from './types';

const ENTRY_MARKER = '__gs';

interface StorageEntryEnvelope {
  [key: string]: unknown;
  value: unknown;
  version: number;
  expiry: number | null;
}

function isStorageEntry(data: unknown): data is StorageEntryEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    ENTRY_MARKER in data &&
    (data as Record<string, unknown>)[ENTRY_MARKER] === true &&
    'value' in data &&
    'version' in data &&
    'expiry' in data
  );
}

export function createStorage(options: CreateStorageOptions = {}): GreatStorage {
  const storage = options.storage ?? localStorage;
  const separator = options.separator ?? ':';
  const prefix = options.prefix ? options.prefix + separator : '';
  const serializer: Serializer = options.serializer ?? { stringify, parse };

  function prefixedKey(key: string): string {
    return prefix + key;
  }

  function getItem<T = unknown>(key: string, options?: GetOptions<T>): T | null {
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

    if (options?.schema) {
      const result = options.schema['~standard'].validate(entry.value);

      if (result instanceof Promise) {
        throw new TypeError(
          'Schema validation must be synchronous. Async schemas are not supported.',
        );
      }

      if ('issues' in result) {
        return null;
      }

      return result.value as T;
    }

    return entry.value as T;
  }

  function resolveExpiry(options?: StorageOptions): number | null {
    if (options?.ttl != null && options?.expiresAt != null) {
      throw new TypeError('Cannot specify both "ttl" and "expiresAt". Use one or the other.');
    }

    if (options?.ttl != null) {
      return Date.now() + options.ttl;
    }

    if (options?.expiresAt != null) {
      return options.expiresAt instanceof Date ? options.expiresAt.getTime() : options.expiresAt;
    }

    return null;
  }

  function setItem<T = unknown>(key: string, value: T, options?: StorageOptions): void {
    const entry: StorageEntryEnvelope = {
      [ENTRY_MARKER]: true as const,
      version: 1, // Useful for future-proofing in case we need to change the storage format
      value,
      expiry: resolveExpiry(options),
    };
    storage.setItem(prefixedKey(key), serializer.stringify(entry));
  }

  function getOrInit<T>(key: string, factory: () => T, options?: StorageOptions): T {
    const existing = getItem<T>(key);
    if (existing !== null) {
      return existing;
    }

    const value = factory();
    setItem(key, value, options);
    return value;
  }

  function removeItem(key: string): void {
    storage.removeItem(prefixedKey(key));
  }

  function* entries(): Generator<[key: string, entry: StorageEntryEnvelope]> {
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
        if (isStorageEntry(entry)) {
          yield [key, entry];
        }
      } catch {
        // Not a greatstorage entry, skip
      }
    }
  }

  function removeEntries(predicate: (entry: StorageEntryEnvelope) => boolean): void {
    const keysToRemove: string[] = [];

    for (const [key, entry] of entries()) {
      if (predicate(entry)) {
        keysToRemove.push(key);
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

  function key(index: number): string | null {
    let count = 0;
    for (const [rawKey, entry] of entries()) {
      if (entry.expiry == null || Date.now() <= entry.expiry) {
        if (count === index) {
          return prefix ? rawKey.slice(prefix.length) : rawKey;
        }
        count++;
      }
    }
    return null;
  }

  return {
    get length() {
      let count = 0;
      for (const [, entry] of entries()) {
        if (entry.expiry == null || Date.now() <= entry.expiry) {
          count++;
        }
      }
      return count;
    },
    getItem,
    setItem,
    getOrInit,
    removeItem,
    key,
    clear,
    clearExpired,
    has,
  };
}
