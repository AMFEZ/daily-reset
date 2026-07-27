// Daily Reset service-worker retirement file.
//
// A previous cache-first worker intercepted Next.js React Server
// Component requests and could leave the app on app/loading.tsx.
// This worker removes Daily Reset caches and unregisters itself.
// It deliberately contains no fetch handler.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map((cacheName) =>
          caches.delete(cacheName)
        )
      );

      await self.registration.unregister();
      await self.clients.claim();
    })()
  );
});
