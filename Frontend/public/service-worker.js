const CACHE_PREFIX = 'kudiba-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const appShell = new URL('index.html', self.registration.scope).toString();
      return cache.add(appShell);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    /\/(?:api|auth|health|ready|metrics)(?:\/|$)/.test(url.pathname)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const shellUrl = new URL('index.html', self.registration.scope).toString();
        const cachedShell = await caches.match(shellUrl);
        if (cachedShell) return cachedShell;
        return Response.error();
      })
    );
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
