/* The app shell is cached only when the user opts into Supercharged setup. */
const SHELL_CACHE = 'hands-on-deck-shell-v12';
const ROOT = new URL('./', self.location.href).href;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL_CACHE);
  const response = await fetch(new URL('index.html', ROOT), { cache: 'reload' });
  if (!response.ok) throw new Error('Could not save the editor for offline use.');
  await cache.put(ROOT, response);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'STATUS') event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    event.ports[0]?.postMessage({ ready: !!(await cache.match(ROOT)) });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || ![ROOT, ROOT + 'index.html'].includes(url.origin + url.pathname)) return;
  event.respondWith((async () => {
    try { return await fetch(event.request); }
    catch {
      const cached = await (await caches.open(SHELL_CACHE)).match(ROOT);
      return cached || new Response('Reconnect once to prepare Hands on Deck for offline use.', { status: 503 });
    }
  })());
});
