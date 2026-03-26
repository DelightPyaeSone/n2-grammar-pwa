const CACHE_NAME = 'n2-grammar-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './n2_shinkanzen_grammar_mm.json',
    './manifest.json'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// ===== Background Notification Timer (for mobile) =====
let _notiTimer = null;
let _notiIntervalMs = 60 * 60 * 1000;

async function _sendGrammarNoti() {
    const response = await caches.match('./n2_shinkanzen_grammar_mm.json');
    if (!response) return;
    const data = await response.json();
    const grammarPoints = data.grammar_points;
    if (!grammarPoints || grammarPoints.length === 0) return;
    const randomG = grammarPoints[Math.floor(Math.random() * grammarPoints.length)];
    return self.registration.showNotification(`📖 ${randomG.grammar}`, {
        body: `${randomG.meaning_myanmar}\n${randomG.english}`,
        icon: 'icons/icon-192.svg',
        badge: 'icons/icon-192.svg',
        tag: 'n2-grammar-noti',
        renotify: true,
        vibrate: [100, 50, 100],
        data: { grammarId: randomG.id }
    });
}

function _scheduleNoti() {
    if (_notiTimer) clearTimeout(_notiTimer);
    _notiTimer = setTimeout(async () => {
        await _sendGrammarNoti();
        _scheduleNoti();
    }, _notiIntervalMs);
}

self.addEventListener('message', (event) => {
    const { type, interval } = event.data || {};
    if (type === 'START_NOTI') {
        _notiIntervalMs = (interval || 60) * 60 * 1000;
        _scheduleNoti();
    } else if (type === 'STOP_NOTI') {
        if (_notiTimer) {
            clearTimeout(_notiTimer);
            _notiTimer = null;
        }
    }
});

// Background Notification (for when the app is in background)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            if (windowClients.length > 0) {
                windowClients[0].focus();
                return;
            }
            return clients.openWindow('/');
        })
    );
});
