# greatstorage

Gives `localStorage` superpowers. Handles serialization of rich types, key expiration, namespacing, and schema validation — so you don't have to.

## Features

- **Store anything**: Stores `Set`, `Map`, `Date`, `RegExp`, `BigInt`, circular references, and more using [devalue](https://github.com/sveltejs/devalue)
- **TTL / expiration**: Set a `ttl` in milliseconds or an absolute `expiresAt` timestamp. Expired items are treated as missing, can be removed on `getItem()`, and can be swept with `clearExpired()`
- **Namespacing**: Isolate keys with a configurable `prefix` and `separator`
- **Schema validation**: Validate retrieved values against any [Standard Schema](https://github.com/standard-schema/standard-schema) with synchronous validation (Zod, Valibot, ArkType, etc.)
- **Use any `Storage` backend**: Works with `localStorage`, `sessionStorage`, or any `Storage`-compatible implementation. An in-memory storage implementation is provided as well
- **ESM and CJS**: Tree-shakeable dual builds with full TypeScript types

## Installation

```sh
npm install greatstorage
```

## Usage

### Basic

Store and retrieve objects without the `JSON.stringify` dance. You're welcome.

```ts
// lib/storage.ts
import { createStorage } from 'greatstorage';

// Create an app-wide singleton instance.
export const storage = createStorage();
```

```ts
// app.ts
import { storage } from './lib/storage';

storage.setItem('user', { name: 'Alice', age: 30 });
storage.getItem('user'); // { name: 'Alice', age: 30 }
```

### Store anything

Yes, `localStorage` can finally handle a `Set`, or any data type you throw at it. It only took the entire JavaScript ecosystem to get here.

Uses [devalue](https://github.com/sveltejs/devalue) by default, but you can bring your own serializer.

```ts
storage.setItem('tags', new Set(['a', 'b', 'c']));
storage.getItem('tags'); // Set {'a', 'b', 'c'}

storage.setItem('metadata', new Map([['key', 'value']]));
storage.getItem('metadata'); // Map {'key' => 'value'}

storage.setItem('date', new Date('2025-01-01'));
storage.getItem('date'); // Date 2025-01-01T00:00:00.000Z
```

### TTL / expiration

Store data temporarily. Like Snapchat, but for your storage keys.

**Note**: Expired data behaves like a missing key. `getItem()` removes expired entries on read, while `has()`, `key()`, and `length` simply ignore them. Use `clearExpired()` to proactively sweep them.

```ts
// Expires in 60 seconds
storage.setItem('token', 'abc123', { ttl: 60_000 });

// Expires at a specific date
storage.setItem('session', { id: 1 }, { expiresAt: new Date('2025-12-31') });

// Expired items return null
storage.getItem('token'); // null (after 60s)
```

### Namespacing

Because your keys deserve their own personal space, away from whatever chaos other libraries left behind.

```ts
const appStorage = createStorage({ prefix: 'my-vibe-coded-app' });

appStorage.setItem('theme', 'dark'); // stored as "my-vibe-coded-app:theme"
appStorage.getItem('theme'); // 'dark'

localStorage.getItem('theme'); // null

// clear() only removes keys within the namespace
appStorage.clear();
```

### Check, remove, and clear

The usual housekeeping. Someone has to take out the trash.

```ts
storage.has('user'); // true
storage.removeItem('user');
storage.has('user'); // false

storage.clear(); // remove all greatstorage entries
storage.clearExpired(); // remove only expired entries
```

### Type-safe access

TypeScript can't read `localStorage` at compile time (yet), but you can at least pretend your data is typed.

```ts
interface User {
  name: string;
  age: number;
}

const user = storage.getItem<User>('user');
// user is typed as User | null

storage.getOrInit<User>('user', () => ({ name: 'Alice', age: 30 }));

storage.updateItem<User>('user', (current) => ({
  ...current!,
  age: current!.age + 1,
}));
```

However, the true safe way is to validate with a [schema during read](#schema-validation).

### Schema validation

Trust no one — especially since browser storage is open to tampering by users. Validate with any libraries that support [Standard Schema](https://github.com/standard-schema/standard-schema), as long as validation is synchronous.

```ts
import { z } from 'zod';

const UserSchema = z.object({ name: z.string(), age: z.number() });

// Returns typed value if valid, null if validation fails
const user = storage.getItem('user', { schema: UserSchema });
```

### Not just `localStorage`

Pass any `Storage`-compatible backend. Use `sessionStorage` for tab-scoped data, or `createMemoryStorage()` for tests and server-side rendering.

```ts
import { createStorage, createMemoryStorage } from 'greatstorage';

const storage = createStorage({
  storage: typeof window === 'undefined' ? createMemoryStorage() : undefined,
});
```

### Custom serializer

Don't like devalue? Bring your own `stringify`/`parse` and we won't judge. Much.

```ts
import superjson from 'superjson';

const storage = createStorage({
  serializer: { stringify: superjson.stringify, parse: superjson.parse },
});
```

### Additional APIs

Because `getItem` and `setItem` weren't enough, here are some bonus methods you didn't know you needed.

#### `getOrInit()`

Get the value if it exists, or writes to storage if it doesn't. Either way, you're getting something back.

```ts
const prefs = storage.getOrInit('prefs', () => ({
  theme: 'light',
  lang: 'en',
}));
```

#### `updateItem()`

Read-modify-write in one call. Three separate statements was apparently too much work even when AI is writing all the code.

```ts
storage.updateItem('count', (current) => (current ?? 0) + 1);
```

## API

### `createStorage(options?: CreateStorageOptions): GreatStorage`

Creates a new storage instance. All options are optional.

| Option       | Type         | Default        | Description                                            |
| ------------ | ------------ | -------------- | ------------------------------------------------------ |
| `prefix`     | `string`     | —              | Key prefix for namespacing                             |
| `separator`  | `string`     | `":"`          | Separator between prefix and key                       |
| `storage`    | `Storage`    | `localStorage` | Underlying Storage backend                             |
| `serializer` | `Serializer` | `devalue`      | Custom serializer with `stringify` and `parse` methods |

Returns a `GreatStorage` instance with the following methods:

### `getItem<T = unknown>(key: string): T | null`

Retrieves and deserializes a value. Returns `null` if the key is missing or expired. If the entry is expired, `getItem()` removes it from storage.

### `getItem<T>(key: string, options: { schema: StandardSchema }): T | null`

Retrieves and deserializes a value. Returns `null` if the key is missing, expired, or fails schema validation. If the entry is expired, `getItem()` removes it from storage.

Options:

| Option   | Type             | Description                                                     |
| -------- | ---------------- | --------------------------------------------------------------- |
| `schema` | `StandardSchema` | Validate the value during read. Async schemas are not supported |

### `setItem<T = unknown>(key: string, value: T, options?: StorageOptions): void`

Serializes and stores a value. Options:

| Option      | Type             | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `ttl`       | `number`         | Time-to-live in milliseconds |
| `expiresAt` | `Date \| number` | Absolute expiration time     |

`ttl` and `expiresAt` cannot be used together.

### `getOrInit<T>(key: string, factory: () => T, options?: StorageOptions): T`

Returns the existing value for `key`, or calls `factory()` to create, store, and return a new value.

Options:

| Option      | Type             | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `ttl`       | `number`         | Time-to-live in milliseconds |
| `expiresAt` | `Date \| number` | Absolute expiration time     |

`ttl` and `expiresAt` cannot be used together.

### `updateItem<T = unknown>(key: string, updater: (value: T | null) => T, options?: StorageOptions): T`

Calls `updater(currentValue)` where `currentValue` is the existing value (or `null`), stores the result, and returns it.

Options:

| Option      | Type             | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `ttl`       | `number`         | Time-to-live in milliseconds |
| `expiresAt` | `Date \| number` | Absolute expiration time     |

`ttl` and `expiresAt` cannot be used together.

### `removeItem(key: string): void`

Removes a single key from the current namespace.

### `has(key: string): boolean`

Returns `true` if the key exists and is not expired. Expired entries are treated as missing and are not removed by `has()`.

### `key(index: number): string | null`

Returns the key at the given zero-based index among non-expired entries, or `null` if the index is out of bounds. Expired entries are skipped but not removed.

### `clear(): void`

Removes all greatstorage entries in the current namespace.

Entries outside the namespace and values not written by greatstorage are left untouched.

### `clearExpired(): void`

Removes only expired entries in the current namespace.

### `length: number`

The number of non-expired entries in the current namespace.

Expired entries are excluded from the count but not removed unless read via `getItem()` or swept with `clearExpired()`.

### `createMemoryStorage(): Storage`

Returns an in-memory `Storage` implementation. Useful for testing or server-side usage.

## See also

- [store2](https://github.com/nbubna/store2) by Nathan Bubna: feature-rich `localStorage` wrapper with namespacing and plugins
- [store.js](https://github.com/marcuswestin/store.js) by Marcus Westin: cross-browser `localStorage` wrapper with fallback plugins
- [unstorage](https://github.com/unjs/unstorage) by UnJS: universal key-value storage with pluggable drivers (memory, filesystem, Redis, etc.)
- [storage-box](https://github.com/shahradelahi/storage-box) by Shahrad Elahi: simple `localStorage` wrapper with TTL support
- [lscache](https://github.com/pamelafox/lscache) by Pamela Fox: `localStorage` wrapper with memcached-inspired expiration

## License

MIT
