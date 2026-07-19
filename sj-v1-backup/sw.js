importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(clients.claim());
});

async function handleRequest(event) {
	try {
		await scramjet.loadConfig();
		if (scramjet.route(event)) {
			return scramjet.fetch(event);
		}
	} catch (err) {
		console.error("[Clash Proxy SW] Error handling request:", err);
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
