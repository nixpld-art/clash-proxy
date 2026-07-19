importScripts("/controller/controller.sw.js");

// Activate immediately — don't wait for old tabs to close
self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

// Allow the page to trigger skipWaiting or clients.claim programmatically when it
// detects the SW is waiting or active but not controlling (avoids the page-reload hack).
self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
	if (event.data?.type === "CLAIM") {
		self.clients.claim();
	}
});

self.addEventListener("fetch", (event) => {
	// Guard: if the controller hasn't initialized yet, let the request pass through
	if (typeof $scramjetController === "undefined" || !$scramjetController) return;

	try {
		if ($scramjetController.shouldRoute(event)) {
			event.respondWith(
				$scramjetController.route(event).catch((err) => {
					console.error("[Clash SW] Route error:", err);
					return new Response("Proxy Error: " + (err.message || "Unknown error"), {
						status: 500,
						headers: { "Content-Type": "text/plain" },
					});
				})
			);
		}
	} catch (err) {
		console.error("[Clash SW] Fetch handler error:", err);
	}
});