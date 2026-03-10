const CACHE_NAME = 'diary-pwa-cache-v1.1.4';
const urlsToCache = [
    './',
    './index.html',
    './script.js',
    './manifest.json',
    './dailyIcon.webp'
    // 外部資源如字體和 Tailwind CDN 由於跨域策略和更新頻率，通常依賴瀏覽器自身快取即可
];

// 安裝 Service Worker 並快取核心資源
self.addEventListener('install', event => {
    // 強制讓新版 Service Worker 進入啟動階段，不需等待舊版網頁關閉
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// 攔截請求並提供快取或發起網路請求
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 如果在快取中找到匹配檔案就回傳快取
                if (response) {
                    return response;
                }
                // 否則透過網路抓取
                return fetch(event.request);
            })
    );
});

// 啟動新的 Service Worker 時清除舊的快取
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    // 強制讓新版 Service Worker 立即接管頁面控制權
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});
