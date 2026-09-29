// キャッシュ名のバージョン。アプリを更新したら必ず上げること
const VERSION = 'v1';
const CACHE = `line-defense-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/main.js',
  './src/config/constants.js',
  './src/config/units.js',
  './src/config/stages.js',
  './src/core/storage.js',
  './src/core/loop.js',
  './src/game/Battle.js',
  './src/game/Unit.js',
  './src/game/Projectile.js',
  './src/render/Renderer.js',
  './src/render/sprites.js',
  './src/ui/screens.js',
  './src/ui/battleUI.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 同一オリジンはキャッシュ優先、なければネットワークから取得してキャッシュ
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
