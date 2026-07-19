import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// ============================================================
// Wisp Configuration
// Docs: https://www.npmjs.com/package/@mercuryworkshop/wisp-js
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
				// Required headers for SharedArrayBuffer (Scramjet WASM)
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				// Route WebSocket upgrades to the Wisp server
				if (req.url.endsWith("/wisp/")) {
					wisp.routeRequest(req, socket, head);
				} else {
					socket.end();
				}
			});
	},
});

// --- Static file routes ---

// Public frontend files (must be first with decorateReply: true)
fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

// Scramjet proxy engine files
fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});

// libcurl transport (for BareMux)
fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});

// BareMux transport worker
fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
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

fastify.listen({ port: PORT, host: "0.0.0.0" });

fastify.server.on("listening", () => {
	const address = fastify.server.address();
	console.log("");
	console.log("  ╔═══════════════════════════════════════╗");
	console.log("  ║         ⚡ CLASH PROXY ⚡              ║");
	console.log("  ╠═══════════════════════════════════════╣");
	console.log(`  ║  Local:   http://localhost:${address.port}`.padEnd(43) + "║");
	console.log(`  ║  Network: http://${hostname()}:${address.port}`.padEnd(43) + "║");
	console.log("  ╚═══════════════════════════════════════╝");
	console.log("");
});

// Graceful shutdown
process.on("SIGINT", () => { fastify.close(); process.exit(0); });
process.on("SIGTERM", () => { fastify.close(); process.exit(0); });
