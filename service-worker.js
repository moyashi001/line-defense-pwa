// キャッシュ名のバージョン。アプリを更新したら必ず上げること
const VERSION = 'v12';
const CACHE = `line-defense-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/sprites/soldier.png',
  './assets/sprites/guard.png',
  './assets/sprites/archer.png',
  './assets/sprites/slime.png',
  './assets/sprites/orcKing.png',
  './assets/sprites/lancer.png',
  './assets/sprites/cannon.png',
  './assets/sprites/mage.png',
  './assets/sprites/healer.png',
  './assets/sprites/wing.png',
  './assets/sprites/knight.png',
  './assets/sprites/orc.png',
  './assets/sprites/skeletonArcher.png',
  './assets/sprites/bat.png',
  './assets/sprites/giantSlime.png',
  './assets/sprites/iceGiant.png',
  './assets/sprites/goblin.png',
  './assets/sprites/shieldbearer.png',
  './assets/sprites/iceSprite.png',
  './assets/sprites/shaman.png',
  './assets/sprites/dragon.png',
  './assets/sprites/demonLord.png',
  './assets/title.jpg',
  './assets/bg/world1.jpg',
  './assets/bg/world2.jpg',
  './assets/bg/world3.jpg',
  './assets/bg/world4.jpg',
  './assets/castle/ally.png',
  './assets/castle/enemy.png',
  './src/main.js',
  './src/config/constants.js',
  './src/config/units.js',
  './src/config/stages.js',
  './src/core/storage.js',
  './src/core/loop.js',
  './src/game/Battle.js',
  './src/game/Unit.js',
  './src/game/Projectile.js',
  './src/game/Castle.js',
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
