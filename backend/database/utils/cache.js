// Simple in-memory cache for dashboard data
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 30000; // 30 seconds
  }

  set(key, value, ttl = this.defaultTTL) {
    const expires = Date.now() + ttl;
    this.cache.set(key, { value, expires });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Generate cache key for tenant-specific data
  generateKey(tenantId, type) {
    return `tenant:${tenantId}:${type}`;
  }
}

export const cache = new SimpleCache();