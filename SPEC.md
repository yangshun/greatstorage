# greatstorage — Spec

## Problems

The native `localStorage` API has several pain points. This library solves the most common ones:

### 1. Strings only

`localStorage` only stores string values. Storing any other type requires manual `JSON.stringify()` on write and `JSON.parse()` on read. This is tedious, error-prone (parsing can throw), and easy to forget.

`greatstorage` uses [`devalue`](https://github.com/sveltejs/devalue) for serialization, which handles all JSON-compatible types plus rich types that `JSON.stringify` silently mangles or drops: `Set`, `Map`, `Date`, `RegExp`, `BigInt`, `NaN`, `Infinity`, `-0`, `undefined`, and circular references.

### 2. No expiration mechanism

`localStorage` has no built-in TTL or expiry. Data persists indefinitely until explicitly removed. Implementing expiration manually requires storing timestamps alongside values and checking them on every read.

`greatstorage` supports an optional `ttl` (time-to-live) in milliseconds or an absolute `expiresAt` timestamp. Expired items are treated as missing. `getItem()` removes expired entries on read, while `has()`, `key()`, and `length` ignore them until `clearExpired()` is called.

### 3. No namespacing

All keys in `localStorage` share a single flat namespace per origin. When multiple apps, modules, or versions write to the same storage, key collisions can silently overwrite data.

`greatstorage` supports an optional `prefix` that is transparently prepended to every key. Each namespace is fully isolated — `clear()` only removes keys within that namespace, not the entire storage.

## API

```ts
import { createMemoryStorage, createStorage } from 'greatstorage';
import { z } from 'zod';

const storage = createStorage(); // defaults to localStorage, no prefix

// Automatic serialization (primitives, objects, arrays)
storage.setItem('user', { name: 'Alice', age: 30 });
storage.getItem('user'); // → { name: 'Alice', age: 30 }

// Rich types (Set, Map, Date, RegExp)
storage.setItem('tags', new Set(['a', 'b']));
storage.getItem('tags'); // → Set {'a', 'b'}

storage.setItem('created', new Date('2025-01-15'));
storage.getItem('created'); // → Date 2025-01-15T00:00:00.000Z

// TTL support
storage.setItem('token', 'abc123', { ttl: 60_000 }); // expires in 60s
storage.getItem('token'); // → 'abc123' (or null if expired)

// Utility methods
storage.has('key'); // check existence (respects TTL)
storage.removeItem('key'); // remove a single key
storage.clear(); // remove all keys written by `greatstorage`
storage.clearExpired(); // proactively remove expired keys

// Namespacing
const appStorage = createStorage({ prefix: 'myapp', separator: ':' });
appStorage.setItem('user', 'Alice'); // stored as "myapp:user"
appStorage.getItem('user'); // → 'Alice'
appStorage.clear(); // only removes "myapp:*" keys

// Schema validation during read
const UserSchema = z.object({ name: z.string(), age: z.number() });
storage.getItem('user', { schema: UserSchema }); // typed value or null

// Use a different storage backend
const memoryStorage = createStorage({
  storage: createMemoryStorage(),
});

// Custom serializer (defaults to devalue)
const customStorage = createStorage({
  serializer: {
    stringify: JSON.stringify,
    parse: JSON.parse,
  },
});
```

## Design decisions

- **Factory function (`createStorage`)** — Accepts an options object with `storage` (any `Storage`-compatible backend), `prefix`, `separator`, and `serializer`, making it testable and usable with `sessionStorage`, memory storage, or custom implementations.
- **Lazy expiration** — Expired items are treated as missing. `getItem()` removes them on read, while `has()`, `key()`, and `length` stay side-effect free.
- **Schema validation on read** — `getItem()` can validate retrieved values against any synchronous Standard Schema. Invalid values return `null`; async schemas are rejected.
- **No implicit reads of foreign values** — Values written directly to the underlying storage (not via `greatstorage`) are ignored rather than returned as raw strings or plain JSON.
- **Wrapper envelope** — Each value is stored as an internal envelope with metadata such as `__gs`, `version`, `value`, and `expiry`. The `__gs` marker distinguishes `greatstorage` entries from arbitrary objects.
- **Serialization via `devalue`** — Rich types are handled by [`devalue`](https://github.com/sveltejs/devalue) by default. Users can provide a custom `serializer` with `stringify` and `parse` methods (e.g. `superjson`, or plain `JSON` for minimal setups).
- **Scoped `clear()`** — When a prefix is set, `clear()` only removes keys belonging to that namespace rather than wiping the entire storage.
