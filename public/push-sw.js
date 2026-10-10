// Push notifications from the game server (server/src/push.ts), shown when
// the app isn't in front. The service worker loads this file; the page
// shows its own toast while it is visible, so nothing is shown twice.
self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {};
    }
    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            if (windows.some((w) => w.visibilityState === "visible")) return;
            await self.registration.showNotification(
                data.title || "Hide and Seek",
                {
                    body: data.body || undefined,
                    tag: data.tag || "jetlag",
                    renotify: true,
                    data: { url: data.url || "./" },
                },
            );
        })(),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url =
        (event.notification.data && event.notification.data.url) || "./";
    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            const existing = windows.find((w) => "focus" in w);
            if (existing) {
                await existing.focus();
                if ("navigate" in existing && !existing.url.includes("game=")) {
                    await existing.navigate(url);
                }
                return;
            }
            await self.clients.openWindow(url);
        })(),
    );
});
