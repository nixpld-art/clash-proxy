"use strict";

const stockSW = "/sw.js";

/**
 * Hostnames allowed to run service workers on http:// (non-HTTPS)
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Registers the Scramjet service worker.
 * Called from index.html on page load.
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		) {
			throw new Error(
				"Service Workers require HTTPS or localhost. Please use https:// or access via localhost."
			);
		}
		throw new Error(
			"Your browser does not support Service Workers. Please use a modern browser."
		);
	}

	await navigator.serviceWorker.register(stockSW, {
		scope: "/",
		updateViaCache: "none",
	});

	const reg = await navigator.serviceWorker.ready;
	console.log("[Clash Proxy] Service Worker registered successfully.", reg);
}
