/**
 * AnimeNetRec V3 - Cache System
 * 
 * 24h cache with signed keys, rate limiting, and exponential backoff
 */

import type { CacheEntry, RateLimitState } from "./types";
import { devLog, devWarn, logError } from "@utils/logger";


// ============================================================================
// CACHE MANAGER
// ============================================================================

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private ttl: number;

  constructor(ttl: number = 24 * 60 * 60 * 1000) {
    this.ttl = ttl;
  }

  /**
   * Generate cache key with signature
   */
  private generateKey(namespace: string, id: string | number): string {
    const timestamp = Date.now();
    const signature = this.sign(`${namespace}:${id}:${timestamp}`);
    return `${namespace}:${id}:${signature}`;
  }

  /**
   * Simple signature (can be replaced with crypto.subtle)
   */
  private sign(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Set cache entry
   */
  set<T>(namespace: string, id: string | number, data: T): void {
    const key = `${namespace}:${id}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      signature: this.sign(key),
    };
    this.cache.set(key, entry);
  }

  /**
   * Get cache entry
   */
  get<T>(namespace: string, id: string | number): T | null {
    const key = `${namespace}:${id}`;
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Check if key exists and is valid
   */
  has(namespace: string, id: string | number): boolean {
    return this.get(namespace, id) !== null;
  }

  /**
   * Clear specific namespace
   */
  clear(namespace?: string): void {
    if (!namespace) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${namespace}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; namespaces: Record<string, number> } {
    const namespaces: Record<string, number> = {};
    
    for (const key of this.cache.keys()) {
      const ns = key.split(":")[0];
      namespaces[ns] = (namespaces[ns] || 0) + 1;
    }
    
    return {
      size: this.cache.size,
      namespaces,
    };
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

export class RateLimiter {
  private state: RateLimitState = {
    requestCount: 0,
    resetTime: Date.now() + 60000, // 1 minute
  };
  
  private maxRequests: number;
  private windowMs: number;
  private backoffMultiplier: number;

  constructor(
    maxRequests: number = 90, // AniList allows 90/min
    windowMs: number = 60000,
    backoffMultiplier: number = 2
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.backoffMultiplier = backoffMultiplier;
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    
    // Check backoff
    if (this.state.backoffUntil && now < this.state.backoffUntil) {
      const waitMs = this.state.backoffUntil - now;
      devWarn(`[RateLimiter] In backoff, wait ${waitMs}ms`);
      await this.sleep(waitMs);
      return this.checkLimit();
    }
    
    // Reset window
    if (now >= this.state.resetTime) {
      this.state.requestCount = 0;
      this.state.resetTime = now + this.windowMs;
    }
    
    // Check limit
    if (this.state.requestCount >= this.maxRequests) {
      devWarn("[RateLimiter] Rate limit reached, waiting...");
      const waitMs = this.state.resetTime - now;
      await this.sleep(waitMs);
      return this.checkLimit();
    }
    
    this.state.requestCount++;
    return true;
  }

  /**
   * Handle 429 (Too Many Requests)
   */
  handle429(retryAfterSeconds?: number): void {
    const backoffMs = retryAfterSeconds 
      ? retryAfterSeconds * 1000
      : this.windowMs * this.backoffMultiplier;
    
    this.state.backoffUntil = Date.now() + backoffMs;
    logError(`[RateLimiter] 429 detected, backing off for ${backoffMs}ms`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current state
   */
  getState(): RateLimitState {
    return { ...this.state };
  }
}

// ============================================================================
// REQUEST QUEUE (Deduplication)
// ============================================================================

export class RequestQueue {
  private pending = new Map<string, Promise<any>>();

  /**
   * Execute request with deduplication
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Check if already pending
    if (this.pending.has(key)) {
      devLog(`[RequestQueue] Deduplicating request: ${key}`);
      return this.pending.get(key) as Promise<T>;
    }

    // Execute
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Clear all pending
   */
  clear(): void {
    this.pending.clear();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.pending.size;
  }
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

export const cacheManager = new CacheManager();
export const rateLimiter = new RateLimiter();
export const requestQueue = new RequestQueue();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Cached API call with rate limiting and deduplication
 */
export async function cachedFetch<T>(
  namespace: string,
  id: string | number,
  fetcher: () => Promise<T>,
  options?: {
    bypassCache?: boolean;
    ttl?: number;
  }
): Promise<T> {
  const cacheKey = `${namespace}:${id}`;

  // Check cache
  if (!options?.bypassCache) {
    const cached = cacheManager.get<T>(namespace, id);
    if (cached) {
      devLog(`[Cache] HIT: ${cacheKey}`);
      return cached;
    }
  }

  devLog(`[Cache] MISS: ${cacheKey}`);

  // Rate limit
  await rateLimiter.checkLimit();

  // Deduplicate
  const result = await requestQueue.execute(cacheKey, async () => {
    try {
      const data = await fetcher();
      cacheManager.set(namespace, id, data);
      return data;
    } catch (error: any) {
      // Handle 429
      if (error.status === 429 || error.message?.includes("429")) {
        const retryAfter = error.headers?.get?.("Retry-After");
        rateLimiter.handle429(retryAfter ? parseInt(retryAfter) : undefined);
        
        // Retry after backoff
        devLog("[Cache] Retrying after 429...");
        await rateLimiter.checkLimit();
        return fetcher();
      }
      throw error;
    }
  });

  return result;
}

/**
 * Batch fetch with deduplication
 */
export async function batchFetch<T>(
  namespace: string,
  ids: (string | number)[],
  fetcher: (batchIds: (string | number)[]) => Promise<T[]>,
  options?: {
    batchSize?: number;
    bypassCache?: boolean;
  }
): Promise<T[]> {
  const batchSize = options?.batchSize || 10;
  const results: T[] = [];
  
  // Split into batches
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    
    // Check cache first
    const uncachedIds: (string | number)[] = [];
    const cachedResults: T[] = [];
    
    if (!options?.bypassCache) {
      for (const id of batch) {
        const cached = cacheManager.get<T>(namespace, id);
        if (cached) {
          cachedResults.push(cached);
        } else {
          uncachedIds.push(id);
        }
      }
    } else {
      uncachedIds.push(...batch);
    }
    
    // Fetch uncached
    if (uncachedIds.length > 0) {
      await rateLimiter.checkLimit();
      
      const batchKey = `${namespace}:batch:${uncachedIds.join(",")}`;
      const fetched = await requestQueue.execute(batchKey, async () => {
        try {
          return await fetcher(uncachedIds);
        } catch (error: any) {
          if (error.status === 429) {
            rateLimiter.handle429();
            await rateLimiter.checkLimit();
            return fetcher(uncachedIds);
          }
          throw error;
        }
      });
      
      // Cache results
      for (let j = 0; j < fetched.length; j++) {
        cacheManager.set(namespace, uncachedIds[j], fetched[j]);
      }
      
      results.push(...cachedResults, ...fetched);
    } else {
      results.push(...cachedResults);
    }
  }
  
  return results;
}