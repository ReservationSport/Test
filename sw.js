self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
    if (!event.data) return;

    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'Neue Nachricht', body: event.data.text() };
    }

    if (data.badge !== undefined && 'setAppBadge' in navigator) {
        try {
            navigator.setAppBadge(data.badge);
        } catch (e) {}
    }

    const roomId = data.room_id || data.roomId || (data.record ? data.record.room_id : null);
    const notificationTitle = data.title || data.titel || '💬 Neue Nachricht';
    const notificationBody = data.body || data.inhalt || data.message || 'Du hast eine neue Nachricht erhalten.';
    
    const targetUrl = '/';

    const options = {
        body: notificationBody,
        icon: data.icon || '/icon-192.png',
        badge: data.badgeIcon || '/favicon.png',
        vibrate: [100, 50, 100],
        tag: roomId ? `chat-msg-${roomId}` : 'chat-msg-general',
        renotify: true,
        data: {
            url: targetUrl,
            room_id: roomId 
        }
    };

    event.waitUntil(
        self.registration.showNotification(notificationTitle, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    const absoluteUrl = new URL('/', self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // 1. Suche den besten aktiven Client (bevorzuge fokussierte oder den ersten)
            let targetClient = null;
            
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.startsWith(self.location.origin)) {
                    if (client.focused) {
                        targetClient = client;
                        break; // Perfekt, direkt den fokussierten nehmen
                    } else if (!targetClient) {
                        targetClient = client; // Fallback auf den ersten offenen Tab
                    }
                }
            }

            // Wenn ein offener Tab gefunden wurde: NUR DIESEN EINEN ansprechen!
            if (targetClient && 'focus' in targetClient) {
                return targetClient.focus().then(() => {
                    if ('postMessage' in targetClient) {
                        targetClient.postMessage({ type: 'OPEN_MAIN_CHAT' });
                    }
                });
            }

            // 2. Kaltstart (Kein Tab offen): App öffnen
            if (clients.openWindow) {
                return clients.openWindow(absoluteUrl).then(windowClient => {
                    if (windowClient) {
                        let attempts = 0;
                        const interval = setInterval(() => {
                            attempts++;
                            // Einmaliges Senden reicht meist, aber wir prüfen kurz ob Client noch da ist
                            if (windowClient) {
                                windowClient.postMessage({ type: 'OPEN_MAIN_CHAT' });
                            }
                            // Nach 3 Versuchen oder 3 Sekunden komplett stoppen, kein Dauers feuern!
                            if (attempts >= 3) {
                                clearInterval(interval);
                            }
                        }, 1000);
                    }
                });
            }
        }).catch(err => {
            console.error("❌ Fehler im notificationclick:", err);
            if (clients.openWindow) {
                return clients.openWindow(absoluteUrl);
            }
        })
    );
});
