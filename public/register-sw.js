const stockSW = "/sw.js?v=3";

/**
 * Hostnames allowed to run service workers on http:// (non-HTTPS)
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Registers the Scramjet service worker and waits until it controls the page.
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

	const registration = await navigator.serviceWorker.register(stockSW, {
		scope: "/",
		updateViaCache: "none",
	});

	await navigator.serviceWorker.ready;

	if (!navigator.serviceWorker.controller) {
		await new Promise((resolve) => {
			navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
			setTimeout(resolve, 300);
		});
	}

	console.log("[Clash Proxy] Service Worker ready.", registration);
	return registration;
}
