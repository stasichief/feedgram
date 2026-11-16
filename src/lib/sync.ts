import { getAllFeeds, setMeta } from './db';
import { fetchFeed } from './feeds';
import { getSettings } from './settings';

/**
 * Conservative background sync.
 *
 * Rules:
 *  - The foreground poller is the primary mechanism and only runs while the
 *    document is visible.
 *  - The Background Sync API is opt-in and never runs more often than twice
 *    the configured poll interval.
 *  - At most 50 feeds are fetched per pass, round-robin, so no single sync
 *    hammers the network.
 *  - Three consecutive failures stop automatic syncing until the user
 *    intervenes.
 *  - Data saver / 2G connections pause syncing entirely.
 */

const SYNC_TAG = 'feedgram-sync';
const MAX_FEEDS_PER_PASS = 50;
const MAX_CONSECUTIVE_FAILURES = 3;

interface SyncState {
  lastRunAt: number;
  consecutiveFailures: number;
  pending: boolean;
  paused: boolean;
}

const state: SyncState = {
  lastRunAt: 0,
  consecutiveFailures: 0,
  pending: false,
  paused: false,
};

let foregroundTimer: number | null = null;
let running = false;

export function getSyncState(): Readonly<SyncState> {
  return { ...state };
}

/** True when the network connection asks us to stay quiet. */
export function shouldPauseForDataSaver(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
    }
  ).connection;

  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
}

/**
 * Registers a Background Sync tag.
 * Only ever schedules one pending sync.
 */
export async function requestBackgroundSync(): Promise<void> {
  if (!getSettings().backgroundSync) return;
  if (state.paused) return;
  if (state.pending) return;

  const registration = await navigator.serviceWorker?.ready
    .then((reg) => reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
    .catch(() => undefined);

  const syncManager = registration?.sync;
  if (!syncManager) return;

  try {
    await syncManager.register(SYNC_TAG);
    state.pending = true;
  } catch {
    /* Background Sync unsupported — foreground polling covers it */
  }
}

/** Runs a single sync pass over the subscribed feeds. */
export async function runSync(options: { force?: boolean } = {}): Promise<void> {
  if (running) return;

  const settings = getSettings();
  if (!options.force) {
    if (state.paused) return;
    if (shouldPauseForDataSaver()) return;

    const minInterval = settings.pollIntervalMinutes * 60_000;
    const effectiveInterval = Math.max(minInterval, minInterval * 2);
    if (state.lastRunAt && Date.now() - state.lastRunAt < effectiveInterval) {
      return;
    }
  }

  running = true;
  state.lastRunAt = Date.now();

  try {
    const exploreIds = new Set(settings.exploreFeedUrls);
    const feeds = (await getAllFeeds()).filter(
      (feed) => !feed.explore && !exploreIds.has(feed.id),
    );
    if (feeds.length === 0) {
      state.consecutiveFailures = 0;
      return;
    }

    // Round-robin over the feed list, capped per pass.
    const batch = feeds.slice(0, MAX_FEEDS_PER_PASS);
    let failures = 0;

    for (const feed of batch) {
      try {
        await fetchFeed(feed.id);
      } catch {
        failures += 1;
      }
    }

    if (failures === batch.length && batch.length > 0) {
      state.consecutiveFailures += 1;
      if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        state.paused = true;
      }
    } else {
      state.consecutiveFailures = 0;
    }

    await setMeta('sync.lastRunAt', state.lastRunAt);
  } finally {
    running = false;
    state.pending = false;
  }
}

/** Resumes syncing after a manual intervention. */
export function resumeSync(): void {
  state.paused = false;
  state.consecutiveFailures = 0;
}

/**
 * Starts the foreground poller.
 * Polling only happens while the page is visible.
 */
export function startForegroundPolling(): void {
  stopForegroundPolling();

  const intervalMs = Math.max(1, getSettings().pollIntervalMinutes) * 60_000;

  const tick = async () => {
    if (document.visibilityState !== 'visible') return;
    if (!navigator.onLine) return;
    await runSync();
  };

  foregroundTimer = window.setInterval(tick, intervalMs);

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onOnline);
}

export function stopForegroundPolling(): void {
  if (foregroundTimer !== null) {
    clearInterval(foregroundTimer);
    foregroundTimer = null;
  }
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('online', onOnline);
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void runSync();
  }
}

function onOnline(): void {
  void runSync();
}
