interface CacheEntry<T> {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
}

const entries = new Map<string, CacheEntry<unknown>>();

export function getCachedValue<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const cached = entries.get(key) as CacheEntry<T> | undefined;
  if (cached?.pending) return cached.pending;
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T);

  const entry: CacheEntry<T> = { expiresAt: 0 };
  const pending = Promise.resolve().then(load).then(
    (value) => {
      if (entries.get(key) === entry) {
        entry.value = value;
        entry.expiresAt = Date.now() + ttlMs;
        entry.pending = undefined;
      }
      return value;
    },
    (error: unknown) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    },
  );
  entry.pending = pending;
  entries.set(key, entry);
  return pending;
}

export function invalidateCachedValue(key: string): void {
  entries.delete(key);
}
