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
  clearExpired(): void;
  has(key: string): boolean;
}

export interface Serializer {
  stringify: (value: unknown) => string;
  parse: (raw: string) => unknown;
}

export interface CreateStorageOptions {
  /**
   * Key prefix for namespacing. All keys will be stored as `${prefix}${separator}${key}`.
   */
  prefix?: string;

  /**
   * Separator between prefix and key. Defaults to `":"`.
   */
  separator?: string;

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
