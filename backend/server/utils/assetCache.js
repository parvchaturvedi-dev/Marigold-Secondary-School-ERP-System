// ---------------------------------------------------------------------------
// In-memory LRU cache for Cloudinary asset bytes.
//
// Cloudinary's free tier bills *delivery bandwidth*. Without this, every time a
// user opened an event or assignment we fetched the file from Cloudinary again
// — 600 users x a few page loads a month would blow past the 25 GB allowance on
// event posters alone. With it, each asset crosses the wire from Cloudinary at
// most once per server lifetime; after that it is served from memory.
//
// Bounded by total bytes (not entry count) so a handful of large PDFs can never
// balloon the process. Least-recently-used entries are evicted first.
// ---------------------------------------------------------------------------

const MAX_BYTES = 64 * 1024 * 1024; // 64 MB ceiling
const MAX_ENTRY_BYTES = 8 * 1024 * 1024; // never cache a single file above 8 MB

const cache = new Map(); // key -> Buffer (Map preserves insertion order = LRU order)
let totalBytes = 0;

export const getCachedAsset = (key) => {
  if (!cache.has(key)) return null;
  const buffer = cache.get(key);
  // Refresh recency: delete + re-insert moves it to the end.
  cache.delete(key);
  cache.set(key, buffer);
  return buffer;
};

export const setCachedAsset = (key, buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_ENTRY_BYTES) return;

  if (cache.has(key)) {
    totalBytes -= cache.get(key).length;
    cache.delete(key);
  }

  cache.set(key, buffer);
  totalBytes += buffer.length;

  // Evict oldest until we're back under the ceiling.
  while (totalBytes > MAX_BYTES && cache.size > 0) {
    const oldestKey = cache.keys().next().value;
    const oldest = cache.get(oldestKey);
    cache.delete(oldestKey);
    totalBytes -= oldest.length;
  }
};

// Called when an asset is replaced or deleted so we never serve stale bytes.
export const invalidateCachedAsset = (key) => {
  if (!cache.has(key)) return;
  totalBytes -= cache.get(key).length;
  cache.delete(key);
};

export const assetCacheStats = () => ({ entries: cache.size, bytes: totalBytes });
