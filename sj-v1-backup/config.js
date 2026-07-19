/**
 * Global configuration for Clash Proxy.
 * Extend this object to add future settings.
 */
let _CONFIG = {
	// Default search engine template (%s = search query)
	searchEngine: "https://duckduckgo.com/?q=%s",

	// Wisp server URL (auto-detected from current host)
	wispUrl: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`,

	// Transport path (libcurl v1.x)
	transportPath: "/libcurl/index.mjs",

	// BareMux worker path
	baremuxWorkerPath: "/baremux/worker.js",
};
