# Changelog

All notable changes to this project will be documented in this file.

## 0.5.0 - 2026-03-10

`greatstorage` 0.5.0 focuses on better bundle control for custom serializers and safer development ergonomics.

### Highlights

- Added a new `greatstorage/core` entry point for applications that provide their own serializer and want to avoid bundling `devalue`.
- Added development-only warnings for two easy-to-miss cases:
  - writing `null`, which reads back the same as a missing key via `getItem()`
  - writing values with an expiry that is already in the past
- Expanded test coverage for the new core entry point and the warning behavior.
- Improved the README to document the new entry point and clarify the public API.

### Why `greatstorage/core` exists

The default `greatstorage` entry point still includes `devalue` so rich JavaScript values work out of the box. If you already use a custom serializer such as `superjson`, `greatstorage/core` lets you keep the same storage API while making the serializer explicit and avoiding the extra default serialization dependency in your bundle.

### Upgrade notes

- No breaking changes in the default `greatstorage` entry point.
- `greatstorage/core` is new in this release. Its `createStorage()` requires a `serializer`.
- The new warnings only run outside production builds and do not change runtime behavior.
