/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare let self: ServiceWorkerGlobalScope;

/* --------------------------------------------------------------- precache */

clientsClaim();
self.skipWaiting();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/* ------------------------------------------------------- runtime caching */

// App shell navigations fall back to the cached index.html.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'feedgram-pages',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
);

// Static build assets.
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'feedgram-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// Images shown inline in social-style posts are kept in a separate cache.
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'feedgram-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 160, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// Feed and article responses.
//
// Failures are queued for background sync, but the queue is deliberately
// conservative: entries expire after a day, and the app's own sync policy
// decides whether a background sync actually runs.
const feedSyncPlugin = new BackgroundSyncPlugin('feedgram-feed-queue', {
  maxRetentionTime: 24 * 60, // 1 day
});

registerRoute(
  ({ request }) =>
    request.destination === '' &&
    (request.headers.get('Accept') ?? '').includes('xml'),
  new NetworkFirst({
    cacheName: 'feedgram-feeds',
    networkTimeoutSeconds: 10,
    plugins: [
      feedSyncPlugin,
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 60 * 24 * 14,
      }),
    ],
  }),
);

// Article HTML is expensive to refetch, so it is cached aggressively.
registerRoute(
  ({ request }) =>
    request.destination === 'document' &&
    !request.headers.get('X-feedgram-Feed'),
  new CacheFirst({
    cacheName: 'feedgram-articles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 14,
      }),
    ],
  }),
);

/* --------------------------------------------------------- background sync */

const SYNC_TAG = 'feedgram-sync';

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as ExtendableEvent & { tag: string };
  if (syncEvent.tag === SYNC_TAG) {
    syncEvent.waitUntil(notifyClientsToSync());
  }
});

/**
 * The service worker does not fetch feeds itself — the client owns the
 * IndexedDB schema and the sync policy. Instead it asks any open client to
 * run a sync pass. When no client is open the sync simply does not happen,
 * which keeps the background behaviour conservative.
 */
async function notifyClientsToSync(): Promise<void> {
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    client.postMessage({ type: 'feedgram:sync' });
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string })?.type === 'feedgram:skip-waiting') {
    self.skipWaiting();
  }
});
