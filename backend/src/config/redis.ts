import Redis from 'ioredis';
import { env } from './env';

/**
 * Common interface implemented by both the real Redis client and the
 * in-memory fallback. This lets the rest of the app (e.g. the idempotency
 * middleware) depend on an abstraction rather than a concrete cache
 * implementation — swapping Redis in/out never requires touching
 * business logic.
 */
export interface ICache {
  /** Returns the stored string value for a key, or null if absent/expired. */
  get(key: string): Promise<string | null>;
  /** Stores a value with a TTL (seconds). Overwrites any existing value. */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /**
   * Atomically sets a key only if it does NOT already exist, with a TTL.
   * Returns true if the key was newly set (lock acquired), false if it
   * already existed (lock already held by another request).
   * This is the core primitive idempotency locking relies on.
   */
  setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
}

/**
 * Production-grade cache backed by Redis. Used when USE_IN_MEMORY_CACHE=false.
 * Works correctly across multiple horizontally-scaled server instances,
 * which an in-memory map cannot do.
 */
class RedisCache implements ICache {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    this.client.on('connect', () => console.log('[Redis] Connected successfully.'));
    this.client.on('error', (err) => console.error('[Redis] Client error:', err.message));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    // NX = only set if key does not already exist. EX = expiry in seconds.
    // This is a single atomic Redis operation — no race condition window.
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

/**
 * Development/demo fallback cache that stores everything in a process-local
 * Map. NOT suitable for production or multi-instance deployments (data is
 * lost on restart and not shared across instances), but lets this project
 * run end-to-end with zero external infrastructure for local testing.
 */
class InMemoryCache implements ICache {
  private store: Map<string, { value: string; expiresAt: number }> = new Map();

  constructor() {
    // Periodically sweep expired keys so the map doesn't grow unbounded.
    setInterval(() => this.sweepExpired(), 60_000).unref();
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private isExpired(entry: { expiresAt: number } | undefined): boolean {
    return !entry || entry.expiresAt <= Date.now();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry!.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const existing = this.store.get(key);
    if (!this.isExpired(existing)) {
      return false; // Key already held — lock not acquired.
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Singleton cache instance used throughout the app. The choice between
 * Redis and the in-memory fallback is made once, at module load time,
 * based on configuration — keeping the decision in one place.
 */
export const cache: ICache = env.USE_IN_MEMORY_CACHE ? new InMemoryCache() : new RedisCache();

if (env.USE_IN_MEMORY_CACHE) {
  console.log('[Cache] Using IN-MEMORY idempotency cache (development mode). ' +
    'Set USE_IN_MEMORY_CACHE=false and configure Redis for production.');
}
