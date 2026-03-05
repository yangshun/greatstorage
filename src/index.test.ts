import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStorage, createMemoryStorage } from './index';

describe('greatstorage', () => {
  let storage: ReturnType<typeof createStorage>;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMemoryStorage();
    storage = createStorage({ storage: mockStorage });
    vi.restoreAllMocks();
  });

  describe('set and get', () => {
    it('stores and retrieves a string', () => {
      storage.set('name', 'Alice');
      expect(storage.get('name')).toBe('Alice');
    });

    it('stores and retrieves a number', () => {
      storage.set('count', 42);
      expect(storage.get('count')).toBe(42);
    });

    it('stores and retrieves a boolean', () => {
      storage.set('active', true);
      expect(storage.get('active')).toBe(true);
    });

    it('stores and retrieves an object', () => {
      const obj = { foo: 'bar', nested: { a: 1 } };
      storage.set('data', obj);
      expect(storage.get('data')).toEqual(obj);
    });

    it('stores and retrieves an array', () => {
      const arr = [1, 'two', { three: 3 }];
      storage.set('list', arr);
      expect(storage.get('list')).toEqual(arr);
    });

    it('stores and retrieves null value', () => {
      storage.set('empty', null);
      expect(storage.get('empty')).toBeNull();
      expect(storage.has('empty')).toBe(true);
    });

    it('returns null for non-existent key', () => {
      expect(storage.get('missing')).toBeNull();
    });
  });

  describe('TTL', () => {
    it('returns value before TTL expires', () => {
      vi.useFakeTimers();
      storage.set('temp', 'value', { ttl: 1000 });
      vi.advanceTimersByTime(500);
      expect(storage.get('temp')).toBe('value');
      vi.useRealTimers();
    });

    it('returns null after TTL expires', () => {
      vi.useFakeTimers();
      storage.set('temp', 'value', { ttl: 1000 });
      vi.advanceTimersByTime(1001);
      expect(storage.get('temp')).toBeNull();
      vi.useRealTimers();
    });

    it('removes expired item from underlying storage on read', () => {
      vi.useFakeTimers();
      storage.set('temp', 'value', { ttl: 1000 });
      vi.advanceTimersByTime(1001);
      storage.get('temp');
      expect(mockStorage.getItem('temp')).toBeNull();
      vi.useRealTimers();
    });

    it('persists value when no TTL is set', () => {
      vi.useFakeTimers();
      storage.set('permanent', 'value');
      vi.advanceTimersByTime(999_999_999);
      expect(storage.get('permanent')).toBe('value');
      vi.useRealTimers();
    });
  });

  describe('remove', () => {
    it('removes an existing key', () => {
      storage.set('key', 'value');
      storage.remove('key');
      expect(storage.get('key')).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes all greatstorage keys', () => {
      storage.set('a', 1);
      storage.set('b', 2);
      storage.clear();
      expect(storage.get('a')).toBeNull();
      expect(storage.get('b')).toBeNull();
    });

    it('does not remove non-greatstorage keys', () => {
      mockStorage.setItem('external', 'keep me');
      storage.set('a', 1);
      storage.clear();
      expect(storage.get('a')).toBeNull();
      expect(mockStorage.getItem('external')).toBe('keep me');
    });
  });

  describe('clearExpired', () => {
    it('removes expired entries', () => {
      vi.useFakeTimers();
      storage.set('temp1', 'a', { ttl: 1000 });
      storage.set('temp2', 'b', { ttl: 2000 });
      storage.set('permanent', 'c');
      vi.advanceTimersByTime(1500);
      storage.clearExpired();
      expect(storage.has('temp1')).toBe(false);
      expect(storage.has('temp2')).toBe(true);
      expect(storage.get('permanent')).toBe('c');
      vi.useRealTimers();
    });

    it('does not remove non-greatstorage entries', () => {
      vi.useFakeTimers();
      mockStorage.setItem('external', 'keep me');
      storage.set('temp', 'a', { ttl: 1000 });
      vi.advanceTimersByTime(1500);
      storage.clearExpired();
      expect(mockStorage.getItem('external')).toBe('keep me');
      vi.useRealTimers();
    });

    it('does nothing when no entries are expired', () => {
      vi.useFakeTimers();
      storage.set('a', 'value', { ttl: 5000 });
      storage.set('b', 'value');
      storage.clearExpired();
      expect(storage.has('a')).toBe(true);
      expect(storage.has('b')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('has', () => {
    it('returns true for existing key', () => {
      storage.set('key', 'value');
      expect(storage.has('key')).toBe(true);
    });

    it('returns false for missing key', () => {
      expect(storage.has('missing')).toBe(false);
    });

    it('returns false for expired key', () => {
      vi.useFakeTimers();
      storage.set('temp', 'value', { ttl: 1000 });
      vi.advanceTimersByTime(1001);
      expect(storage.has('temp')).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('rich types', () => {
    it('stores and retrieves a Set', () => {
      const set = new Set([1, 2, 3]);
      storage.set('set', set);
      const result = storage.get<Set<number>>('set');
      expect(result).toBeInstanceOf(Set);
      expect(result).toEqual(set);
    });

    it('stores and retrieves a Map', () => {
      const map = new Map<string, number>([
        ['a', 1],
        ['b', 2],
      ]);
      storage.set('map', map);
      const result = storage.get<Map<string, number>>('map');
      expect(result).toBeInstanceOf(Map);
      expect(result).toEqual(map);
    });

    it('stores and retrieves a Date', () => {
      const date = new Date('2025-01-15T12:00:00.000Z');
      storage.set('date', date);
      const result = storage.get<Date>('date');
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe(date.toISOString());
    });

    it('stores and retrieves a RegExp', () => {
      const regex = /foo bar/gi;
      storage.set('regex', regex);
      const result = storage.get<RegExp>('regex');
      expect(result).toBeInstanceOf(RegExp);
      expect(result!.source).toBe(regex.source);
      expect(result!.flags).toBe(regex.flags);
    });

    it('stores and retrieves undefined', () => {
      storage.set('undef', undefined);
      expect(storage.get('undef')).toBeUndefined();
    });

    it('handles nested rich types in objects', () => {
      const data = {
        tags: new Set(['a', 'b']),
        metadata: new Map([['created', new Date('2025-01-01')]]),
      };
      storage.set('complex', data);
      const result = storage.get<typeof data>('complex');
      expect(result!.tags).toBeInstanceOf(Set);
      expect(result!.tags).toEqual(data.tags);
      expect(result!.metadata).toBeInstanceOf(Map);
      expect(result!.metadata.get('created')).toBeInstanceOf(Date);
    });

    it('stores and retrieves BigInt', () => {
      storage.set('big', BigInt('9007199254740993'));
      expect(storage.get('big')).toBe(BigInt('9007199254740993'));
    });

    it('stores and retrieves NaN', () => {
      storage.set('nan', NaN);
      expect(storage.get<number>('nan')).toBeNaN();
    });

    it('stores and retrieves Infinity and -Infinity', () => {
      storage.set('inf', Infinity);
      storage.set('ninf', -Infinity);
      expect(storage.get('inf')).toBe(Infinity);
      expect(storage.get('ninf')).toBe(-Infinity);
    });

    it('stores and retrieves negative zero', () => {
      storage.set('nz', -0);
      expect(Object.is(storage.get('nz'), -0)).toBe(true);
    });
  });

  describe('coexistence with non-greatstorage entries', () => {
    it('returns null for raw strings not set by greatstorage', () => {
      mockStorage.setItem('raw', 'just a string');
      expect(storage.get('raw')).toBeNull();
    });

    it('returns null for JSON values not set by greatstorage', () => {
      mockStorage.setItem('obj', JSON.stringify({ hello: 'world' }));
      expect(storage.get('obj')).toBeNull();
    });

    it('has returns false for non-greatstorage entries', () => {
      mockStorage.setItem('external', 'value');
      expect(storage.has('external')).toBe(false);
    });

    it('does not interfere with non-greatstorage entries in underlying storage', () => {
      mockStorage.setItem('external', 'keep me');
      storage.set('internal', 'managed');
      expect(mockStorage.getItem('external')).toBe('keep me');
      expect(storage.get('internal')).toBe('managed');
    });
  });

  describe('namespacing', () => {
    let nsStorage: ReturnType<typeof createStorage>;

    beforeEach(() => {
      nsStorage = createStorage({ storage: mockStorage, prefix: 'app' });
    });

    it('stores keys with the prefix', () => {
      nsStorage.set('key', 'value');
      expect(mockStorage.getItem('app:key')).not.toBeNull();
      expect(mockStorage.getItem('key')).toBeNull();
    });

    it('retrieves values using unprefixed key', () => {
      nsStorage.set('key', { a: 1 });
      expect(nsStorage.get('key')).toEqual({ a: 1 });
    });

    it('does not see keys from other namespaces', () => {
      const otherStorage = createStorage({ storage: mockStorage, prefix: 'other' });
      nsStorage.set('key', 'from-app');
      otherStorage.set('key', 'from-other');
      expect(nsStorage.get('key')).toBe('from-app');
      expect(otherStorage.get('key')).toBe('from-other');
    });

    it('remove only removes the prefixed key', () => {
      mockStorage.setItem('key', '"unprefixed"');
      nsStorage.set('key', 'prefixed');
      nsStorage.remove('key');
      expect(nsStorage.get('key')).toBeNull();
      expect(mockStorage.getItem('key')).toBe('"unprefixed"');
    });

    it('clear only removes keys with the prefix', () => {
      mockStorage.setItem('other', '"keep me"');
      nsStorage.set('a', 1);
      nsStorage.set('b', 2);
      nsStorage.clear();
      expect(nsStorage.get('a')).toBeNull();
      expect(nsStorage.get('b')).toBeNull();
      expect(mockStorage.getItem('other')).toBe('"keep me"');
    });

    it('has respects the prefix', () => {
      nsStorage.set('key', 'value');
      expect(nsStorage.has('key')).toBe(true);
      expect(storage.has('key')).toBe(false);
    });

    it('TTL works with prefix', () => {
      vi.useFakeTimers();
      nsStorage.set('temp', 'value', { ttl: 1000 });
      vi.advanceTimersByTime(1001);
      expect(nsStorage.get('temp')).toBeNull();
      expect(mockStorage.getItem('app:temp')).toBeNull();
      vi.useRealTimers();
    });

    it('uses custom separator', () => {
      const s = createStorage({ storage: mockStorage, prefix: 'ns', separator: '/' });
      s.set('key', 'value');
      expect(mockStorage.getItem('ns/key')).not.toBeNull();
      expect(s.get('key')).toBe('value');
    });

    it('uses empty separator', () => {
      const s = createStorage({ storage: mockStorage, prefix: 'ns', separator: '' });
      s.set('key', 'value');
      expect(mockStorage.getItem('nskey')).not.toBeNull();
    });
  });

  describe('custom serializer', () => {
    it('uses a custom serializer for set and get', () => {
      const customSerializer = {
        stringify: (value: unknown) => JSON.stringify(value),
        parse: (raw: string) => JSON.parse(raw),
      };
      const customStorage = createStorage({
        storage: mockStorage,
        serializer: customSerializer,
      });
      customStorage.set('key', { hello: 'world' });
      expect(customStorage.get('key')).toEqual({ hello: 'world' });
    });

    it('custom serializer is used for writing', () => {
      const calls: unknown[] = [];
      const customSerializer = {
        stringify: (value: unknown) => {
          calls.push(value);
          return JSON.stringify(value);
        },
        parse: (raw: string) => JSON.parse(raw),
      };
      const customStorage = createStorage({
        storage: mockStorage,
        serializer: customSerializer,
      });
      customStorage.set('key', 'value');
      expect(calls.length).toBe(1);
    });

    it('TTL works with custom serializer', () => {
      vi.useFakeTimers();
      const customSerializer = {
        stringify: (value: unknown) => JSON.stringify(value),
        parse: (raw: string) => JSON.parse(raw),
      };
      const customStorage = createStorage({
        storage: mockStorage,
        serializer: customSerializer,
      });
      customStorage.set('temp', 'value', { ttl: 1000 });
      vi.advanceTimersByTime(500);
      expect(customStorage.get('temp')).toBe('value');
      vi.advanceTimersByTime(501);
      expect(customStorage.get('temp')).toBeNull();
      vi.useRealTimers();
    });
  });
});
