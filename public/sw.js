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

self.addEventListener("fetch", (event) => {
	if ($scramjetController.shouldRoute(event)) {
		event.respondWith($scramjetController.route(event));
	}
});
