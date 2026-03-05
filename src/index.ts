import { stringify, parse } from 'devalue';

export interface StorageOptions {
  /**
   * Time-to-live in milliseconds. If not set, the item never expires.
   */
  ttl?: number;
}

export interface GreatStorage {
  get<T = unknown>(key: string): T | null;
  set<T = unknown>(key: string, value: T, options?: StorageOptions): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

const ENTRY_MARKER = '__gs';

interface StorageEntryEnvelope {
  [key: string]: unknown;
  value: unknown;
  expiry: number | null;
}

function isStorageEntry(data: unknown): data is StorageEntryEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    ENTRY_MARKER in data &&
    (data as Record<string, unknown>)[ENTRY_MARKER] === true &&
    'value' in data &&
    'expiry' in data
  );
}

export interface Serializer {
  stringify: (value: unknown) => string;
  parse: (raw: string) => unknown;
}

export interface CreateStorageOptions {
  /**
   * Key prefix for namespacing. All keys will be stored as `${prefix}${key}`.
   */
  prefix?: string;

  /**
   * The underlying Storage backend. Defaults to `localStorage`.
   */
  storage?: Storage;

  /**
   * Custom serializer with `stringify` and `parse` methods.
   * Defaults to `devalue`.
   */
  serializer?: Serializer;
}

export function createStorage(options: CreateStorageOptions = {}): GreatStorage {
  const storage = options.storage ?? localStorage;
  const prefix = options.prefix ?? '';
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
      // Not devalue format — try JSON.parse for backwards compatibility
      try {
        entry = JSON.parse(raw);
      } catch {
        // Raw string that isn't valid JSON — return as-is
        return raw as T;
      }
    }

    if (!isStorageEntry(entry)) {
      return entry as T;
    }

    if (entry.expiry !== null && Date.now() > entry.expiry) {
      storage.removeItem(prefixedKey(key));
      return null;
    }

    return entry.value as T;
  }

  function set<T = unknown>(
    key: string,
    value: T,
    options?: StorageOptions,
  ): void {
    const entry = {
      [ENTRY_MARKER]: true as const,
      value,
      expiry: options?.ttl != null ? Date.now() + options.ttl : null,
    };
    storage.setItem(prefixedKey(key), serializer.stringify(entry));
  }

  function remove(key: string): void {
    storage.removeItem(prefixedKey(key));
  }

  function clear(): void {
    if (!prefix) {
      storage.clear();
      return;
    }
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  }

  function has(key: string): boolean {
    return get(key) !== null;
  }

  return { get, set, remove, clear, has };
}
