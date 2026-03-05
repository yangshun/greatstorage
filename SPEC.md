# greatstorage — Spec

## Problems

The native `localStorage` API has several pain points. This library solves the most common ones:

### 1. Strings only

`localStorage` only stores string values. Storing any other type requires manual `JSON.stringify()` on write and `JSON.parse()` on read. This is tedious, error-prone (parsing can throw), and easy to forget.

**greatstorage** uses [`devalue`](https://github.com/Rich-Harris/devalue) for serialization, which handles all JSON-compatible types plus rich types that `JSON.stringify` silently mangles or drops: `Set`, `Map`, `Date`, `RegExp`, `BigInt`, `NaN`, `Infinity`, `-0`, `undefined`, and circular references.

### 2. No expiration mechanism

`localStorage` has no built-in TTL or expiry. Data persists indefinitely until explicitly removed. Implementing expiration manually requires storing timestamps alongside values and checking them on every read.

**greatstorage** supports an optional `ttl` (time-to-live) in milliseconds. Expired items are lazily cleaned up — they are removed from storage when read after their expiry time.

### 3. No namespacing

All keys in `localStorage` share a single flat namespace per origin. When multiple apps, modules, or versions write to the same storage, key collisions can silently overwrite data.

**greatstorage** supports an optional `prefix` that is transparently prepended to every key. Each namespace is fully isolated — `clear()` only removes keys within that namespace, not the entire storage.

## API

```ts
import { createStorage } from 'greatstorage';

const storage = createStorage(); // defaults to localStorage, no prefix

// Automatic serialization (primitives, objects, arrays)
storage.set('user', { name: 'Alice', age: 30 });
storage.get('user'); // → { name: 'Alice', age: 30 }

// Rich types (Set, Map, Date, RegExp)
storage.set('tags', new Set(['a', 'b']));
storage.get('tags'); // → Set {'a', 'b'}

storage.set('created', new Date('2025-01-15'));
storage.get('created'); // → Date 2025-01-15T00:00:00.000Z

// TTL support
storage.set('token', 'abc123', { ttl: 60_000 }); // expires in 60s
storage.get('token'); // → 'abc123' (or null if expired)

// Utility methods
storage.has('key'); // check existence (respects TTL)
storage.remove('key'); // remove a single key
storage.clear(); // remove all keys

// Namespacing
const appStorage = createStorage({ prefix: 'myapp:' });
appStorage.set('user', 'Alice'); // stored as "myapp:user"
appStorage.get('user'); // → 'Alice'
appStorage.clear(); // only removes "myapp:*" keys

// Custom serializer (defaults to devalue)
const storage2 = createStorage({
  serializer: {
    stringify: JSON.stringify,
    parse: JSON.parse,
  },
});
```

## Design decisions

- **Factory function (`createStorage`)** — Accepts an options object with `storage` (any `Storage`-compatible backend) and `prefix`, making it testable and usable with `sessionStorage` or custom implementations.
- **Lazy expiration** — Expired items are removed on read rather than with background timers. This keeps the implementation simple and avoids unnecessary work.
- **Backwards compatible reads** — Values written directly to `localStorage` (not via greatstorage) are still readable. Raw strings and plain JSON objects are returned as-is.
- **Wrapper envelope** — Each value is stored as `{ __gs: true, value, expiry }` to co-locate data and metadata in a single key. The `__gs` marker distinguishes greatstorage entries from arbitrary objects.
- **Serialization via `devalue`** — Rich types are handled by [`devalue`](https://github.com/Rich-Harris/devalue) (~1KB) by default. Users can provide a custom `serializer` with `stringify` and `parse` methods (e.g. `superjson`, or plain `JSON` for minimal setups).
- **Scoped `clear()`** — When a prefix is set, `clear()` only removes keys belonging to that namespace rather than wiping the entire storage.
