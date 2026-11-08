// Earlier versions of this site ran Little Borough at the root with an offline-caching service
// worker. Orbit doesn't use one, so this file replaces that worker for anyone who still has it:
// it clears Little Borough's old root caches, unregisters itself and reloads open tabs.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (/^(little-borough|window-seat)/i.test(key)) await caches.delete(key)
      }
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
    })(),
  )
})
