/**
 * Global configuration for Clash Proxy.
 */
let _CONFIG = {
	// Default search engine template (%s = search query)
	searchEngine: "https://duckduckgo.com/?q=%s",

	// Scramjet prefix
	prefix: "/scram/service/",

	// Scramjet files
	wasmPath: "/scram/scramjet.wasm",
	workerPath: "/scram/scramjet.worker.js",
	clientPath: "/scram/scramjet.client.js",

	// Wisp server URL (auto-detected from current host)
	wispUrl: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`,

	// Transport path (libcurl)
	transportPath: "/libcurl/index.mjs",

	// BareMux worker path
	baremuxWorkerPath: "/baremux/worker.js",
};
