import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import compress from "@fastify/compress";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const scramjetDist = fileURLToPath(new URL("../node_modules/@mercuryworkshop/scramjet/dist/", import.meta.url));
const controllerDist = fileURLToPath(new URL("../node_modules/@mercuryworkshop/scramjet-controller/dist/", import.meta.url));
const transportDist = fileURLToPath(new URL("../node_modules/@mercuryworkshop/epoxy-transport/dist/", import.meta.url));
// Use GAMES_DIR env var when deployed (e.g. Render), or fall back to the local dev path
const gamesLoaderDir = process.env.GAMES_DIR || resolve(publicPath, "../../../../Games loader/games");

// ============================================================
// Wisp Configuration
// ============================================================
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

// ============================================================
// Fastify Server
// ============================================================
const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");

				// Proper MIME type for .wasm files
				if (req.url && req.url.endsWith(".wasm")) {
					res.setHeader("Content-Type", "application/wasm");
				}

				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				// Match /wisp/ with or without trailing slash and ignore any query string.
				// Render's reverse proxy can strip trailing slashes, which breaks the
				// strict endsWith("/wisp/") check and silently kills the WebSocket.
				if (req.url && /^\/wisp(\/?)(\?.*)?$/.test(req.url)) {
					wisp.routeRequest(req, socket, head);
				} else {
					socket.end();
				}
			});
	},
});

// Response compression (gzip/brotli) for faster page loads
fastify.register(compress, { global: true, threshold: 256 });

// --- Static file routes ---

// Scramjet v2 engine (IIFE + WASM)
fastify.register(fastifyStatic, {
	root: scramjetDist,
	prefix: "/scramjet/",
	decorateReply: false,
});

// Scramjet Controller (API + SW)
fastify.register(fastifyStatic, {
	root: controllerDist,
	prefix: "/controller/",
	decorateReply: false,
});

// Epoxy Transport (browser ESM bundle)
fastify.register(fastifyStatic, {
	root: transportDist,
	prefix: "/transport/",
	decorateReply: false,
});

// Game files (served from Games Loader directory — only if the directory exists)
if (existsSync(gamesLoaderDir)) {
	fastify.register(fastifyStatic, {
		root: gamesLoaderDir,
		prefix: "/games/",
		decorateReply: false,
	});
	console.log("  [Games] Serving game files from:", gamesLoaderDir);
} else {
	console.warn("  [Games] Games directory not found:", gamesLoaderDir);
	console.warn("  [Games] Game files will not be served. Games may not load.");
}

// Public frontend files (root fallback — must be registered last to avoid hijacking prefixes)
fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

// 404 handler
fastify.setNotFoundHandler((req, reply) => {
	return reply.code(404).type("text/html").send(`
		<!DOCTYPE html>
		<html><head><title>404 — Clash Proxy</title>
		<style>body{background:#0a0a0f;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
		.c{text-align:center}h1{font-size:4rem;font-weight:900;margin:0}p{opacity:.5}a{color:#a29bfe}</style></head>
		<body><div class="c"><h1>404</h1><p>Page not found.</p><a href="/">← Back to Clash Proxy</a></div></body></html>
	`);
});

// ============================================================
// Start Server
// ============================================================
const PORT = parseInt(process.env.PORT || "") || 8080;

fastify
	.listen({ port: PORT, host: "0.0.0.0" })
	.catch((err) => {
		console.error("[Clash Proxy] Failed to start server:", err);
		process.exit(1);
	});

fastify.server.on("listening", () => {
	const address = fastify.server.address();
	// Render sets RENDER_EXTERNAL_URL automatically
	const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${address.port}`;
	console.log("");
	console.log("  ╔═══════════════════════════════════════╗");
	console.log("  ║         ⚡ CLASH PROXY ⚡              ║");
	console.log("  ╠═══════════════════════════════════════╣");
	console.log(`  ║  Local:   http://localhost:${address.port}`.padEnd(43) + "║");
	console.log(`  ║  Public:  ${publicUrl}`.padEnd(43) + "║");
	console.log("  ╚═══════════════════════════════════════╝");
	console.log("");
});

// Global error handlers
process.on("uncaughtException", (err) => {
	console.error("[Clash Proxy] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
	console.error("[Clash Proxy] Unhandled Rejection:", reason);
});

// Graceful shutdown
async function shutdown() {
	try { await fastify.close(); } catch (e) { /* ignore */ }
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
