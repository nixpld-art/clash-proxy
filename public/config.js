let _CONFIG = {
	searchEngine: "https://duckduckgo.com/?q=%s",

	wispUrl: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`,

	controllerConfig: {
		prefix: "/proxy/",
		scramjetPath: "/scramjet/scramjet.js",
		injectPath: "/controller/controller.inject.js",
		wasmPath: "/scramjet/scramjet.wasm",
		virtualWasmPath: "scramjet.wasm.js",
		codec: {
			encode: (str) => str ? encodeURIComponent(str) : str,
			decode: (str) => str ? decodeURIComponent(str) : str,
		},
	},

	transportUrl: "/transport/index.mjs",
};
