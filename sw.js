const CACHE_NAME = 'ayg-depo-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/state.js',
  './js/theme.js',
  './js/voice.js',
  './js/backup.js',
  './js/profiles.js',
  './js/orders.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Service Worker Yükleme (Install) - Dosyaları Önbelleğe Al
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Tüm kaynaklar önbelleğe alınıyor...');
      // Bazı dosyalar eksik olsa bile kurulumun kırılmaması için tek tek veya sessizce yükleyelim
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[Service Worker] Bazı varlıklar önbelleğe alınamadı:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Etkinleştirme (Activate) - Eski Önbellekleri Temizle
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Eski önbellek siliniyor:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// İstekleri Yakalama (Fetch)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Supabase API istekleri, POST/PUT istekleri, harita kütüphaneleri (Leaflet) veya dış CDN kaynaklarını önbelleğe alma, doğrudan ağa yönlendir.
  if (
    url.origin !== self.location.origin || 
    e.request.method !== 'GET' ||
    url.pathname.includes('/rest/v1/') || 
    url.hostname.includes('supabase') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Statik dosyalar için Cache-First (Önce Önbellek, yoksa Ağ) stratejisi
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Arka planda güncelliği korumak için ağdan da sorgulayalım
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => { /* Ağ hatası durumunda sessizce yoksay */ });

        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
