// Polyfill URL APIs missing in Service Worker Global Scope
if (typeof self.URL !== "undefined") {
	if (!self.URL.createObjectURL) self.URL.createObjectURL = function() { return ""; };
	if (!self.URL.revokeObjectURL) self.URL.revokeObjectURL = function() {};
}

importScripts("/controller/controller.sw.js");

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

function extractTargetUrl(urlStr) {
	try {
		const u = new URL(urlStr);
		const prefix = "/scram/service/";
		const idx = u.pathname.indexOf(prefix);
		if (idx !== -1) {
			const raw = u.pathname.slice(idx + prefix.length) + u.search + u.hash;
			try {
				const decoded = decodeURIComponent(raw);
				if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
					return decoded;
				}
			} catch (e) {}
			if (raw.startsWith("http://") || raw.startsWith("https://")) {
				return raw;
			}
		}
	} catch (e) {}
	return null;
}

self.addEventListener("fetch", (event) => {
	if (typeof $scramjetController !== "undefined" && $scramjetController && $scramjetController.shouldRoute(event)) {
		event.respondWith(
			$scramjetController.route(event).then(async (resp) => {
				// If Scramjet controller returns an internal error (status 500), recover via Classic engine
				if (resp && resp.status >= 500) {
					try {
						const clone = resp.clone();
						const txt = await clone.text();
						if (txt && (txt.includes("Internal Service Worker Error") || txt.includes("not iterable"))) {
							const target = extractTargetUrl(event.request.url);
							if (target) {
								console.warn("[Aura SW] Auto-recovering Scramjet error to Classic proxy:", target);
								return fetch("/classic/" + target);
							}
						}
					} catch (e) {}
				}
				return resp;
			}).catch((err) => {
				console.warn("[Aura SW] Scramjet route threw error, recovering via Classic proxy:", err);
				const target = extractTargetUrl(event.request.url);
				if (target) {
					return fetch("/classic/" + target);
				}
				return new Response("Service Worker Recovery Error", { status: 500 });
			})
		);
	}
});
