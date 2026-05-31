// 旅のしおり Service Worker
// キャッシュ戦略: アプリシェルをキャッシュし、オフラインでも基本機能が使えるようにする

const CACHE_NAME = 'tabi-shiori-v1';
const OFFLINE_URL = '/offline.html';

// キャッシュするリソース（アプリシェル）
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

// インストール時にアプリシェルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed for some resources:', err);
      });
    })
  );
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// フェッチ戦略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // APIリクエストはネットワーク優先（オフライン時はエラー）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'オフラインのため、この機能は利用できません' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // SSEエンドポイントはスキップ
  if (url.pathname.startsWith('/api/sse')) {
    return;
  }

  // 外部リソース（フォント・Leaflet等）はキャッシュ優先
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // ナビゲーションリクエスト（ページ遷移）はキャッシュ優先、なければネットワーク
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/').then((cached) => {
          return cached || new Response(
            `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>旅のしおり - オフライン</title>
  <style>
    body { font-family: 'Noto Sans JP', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .container { text-align: center; padding: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { color: #1e293b; font-size: 1.5rem; }
    p { color: #64748b; }
    button { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✈️🌸</div>
    <h1>オフラインです</h1>
    <p>インターネット接続がありません。<br>接続を確認してから再度お試しください。</p>
    <button onclick="location.reload()">再読み込み</button>
  </div>
</body>
</html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
    );
    return;
  }

  // その他のリクエストはキャッシュ優先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// バックグラウンド同期（将来の拡張用）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trip-data') {
    console.log('[SW] Background sync: sync-trip-data');
  }
});
