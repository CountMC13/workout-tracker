// Persistence + storage-estimate helpers. The app is offline-only with no cloud,
// so if the browser evicts IndexedDB the user loses everything. We request durable
// storage at startup and surface the current state + usage in Settings.

export interface StorageStatus {
  persisted: boolean; // browser has promised not to evict our data
  usageBytes: number | null;
  quotaBytes: number | null;
}

// Request durable storage (call once at startup). Returns whether it's granted.
export async function ensurePersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  let persisted = false;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usageBytes = est.usage ?? null;
      quotaBytes = est.quota ?? null;
    }
  } catch {
    /* Storage API unsupported — leave defaults. */
  }
  return { persisted, usageBytes, quotaBytes };
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
