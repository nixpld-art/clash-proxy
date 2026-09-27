import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { readdirSync, readFileSync, createWriteStream, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const require_ = createRequire(import.meta.url);

const controllerMain = require_.resolve("@mercuryworkshop/scramjet-controller");
const controllerPath = join(dirname(controllerMain), "../dist");


const epoxyMain = require_.resolve("@mercuryworkshop/epoxy-transport");
const epoxyPath = join(dirname(epoxyMain), "../dist");

const libcurlMain = require_.resolve("@mercuryworkshop/libcurl-transport");
const libcurlPath = join(dirname(libcurlMain), "../dist");

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const gamesPath = fileURLToPath(new URL("../games/", import.meta.url));

import { formatGameTitle } from "./game-titles.js";

// Load actual game titles from games-data.js (re-run on every games
// reload so Jarvis-added games show their real titles immediately)
const gameTitleDataPath = fileURLToPath(new URL("../games-data.js", import.meta.url));
let gameTitleMap = new Map();
function loadGameTitles() {
	try {
		const raw = readFileSync(gameTitleDataPath, "utf8");
		const jsonStr = raw.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, "").replace(/;\s*$/, "");
		const arr = JSON.parse(jsonStr);
		const map = new Map();
		for (const g of arr) {
			if (g && g.title && g.url) {
				const filename = decodeURIComponent(g.url.replace(/^\/games\//, ""));
				const t = g.title.trim();
				if (t && !/[<>]/.test(t) && t.length < 150) {
					map.set(filename, t);
				}
			}
		}
		gameTitleMap = map;
		console.log(`Loaded ${gameTitleMap.size} actual game titles`);
	} catch (err) {
		console.error("Could not load games-data.js titles:", err.message);
	}
}
loadGameTitles();

// Pre-load games list
let cachedGames = null;
function getGamesList() {
	if (cachedGames) return cachedGames;
	try {
		const files = readdirSync(gamesPath);
		cachedGames = files
			.filter(f => {
				if (!f.endsWith(".html")) return false;
				try {
					const head = readFileSync(join(gamesPath, f), "utf8").slice(0, 300);
					if (head.includes("Error 404") || head.includes("That’s an error")) return false;
				} catch {}
				return true;
			})
			.map((filename, index) => ({
				id: `game-${index + 1}`,
				title: gameTitleMap.get(filename) || formatGameTitle(filename),
				filename: filename,
				url: `/games/${encodeURIComponent(filename)}`
			}))
			.sort((a, b) => a.title.localeCompare(b.title));
	} catch (err) {
		console.error("Error reading games directory:", err);
		cachedGames = [];
	}
	return cachedGames;
}

// ============================================================
// Wisp Configuration
// ============================================================
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import friendsRoutes from "./routes/friends.js";
import levelsRoutes from "./routes/levels.js";
import bookmarksRoutes from "./routes/bookmarks.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import loungeRoutes from "./routes/lounge.js";
import aiRoutes from "./routes/ai.js";
import db from "./db.js";
import { presenceWss, kickUser, notifyUser, broadcastSystemAnnouncement, getPresenceStats } from "./presence.js";
import { isPrivilegedUsername } from "./auth-utils.js";

// ============================================================
// Fastify Server
// ============================================================
const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/") || req.url.includes("/wisp")) {
					wisp.routeRequest(req, socket, head);
				} else if (req.url.startsWith("/ws/presence") || req.url.includes("/ws")) {
					presenceWss.handleUpgrade(req, socket, head, (ws) => {
						presenceWss.emit("connection", ws, req);
					});
				} else {
					socket.end();
				}
			});
	},
});

// Register API Routes
fastify.register(authRoutes);
fastify.register(profileRoutes);
fastify.register(friendsRoutes);
fastify.register(levelsRoutes);
fastify.register(bookmarksRoutes);
fastify.register(chatRoutes);
fastify.register(adminRoutes);
fastify.register(loungeRoutes);
fastify.register(aiRoutes);

// API endpoint for games list
fastify.get("/api/games", async (request, reply) => {
	return getGamesList();
});

// Invalidate the cached games list (used by the Owner Panel / Jarvis
// after adding or removing game files).
fastify.post("/api/panel/games/reload", async (request, reply) => {
	if (!requireLocal(request, reply)) return;
	loadGameTitles();
	cachedGames = null;
	return { ok: true, count: getGamesList().length };
});

// ============================================================
// Owner Panel bridge — LOCALHOST ONLY. Used by "clash owner pannel" (127.0.0.1:8081).
// ============================================================
const PANEL_STARTED_AT = new Date().toISOString();
const isLocalRequest = (req) => {
	const a = req.socket.remoteAddress || "";
	return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
};
const requireLocal = (req, reply) => {
	if (!isLocalRequest(req)) {
		reply.code(403).send({ error: "Local access only" });
		return false;
	}
	return true;
};

fastify.get("/api/panel/stats", async (req, reply) => {
	if (!requireLocal(req, reply)) return;
	return {
		presence: getPresenceStats(),
		pid: process.pid,
		startedAt: PANEL_STARTED_AT,
		uptimeSeconds: Math.round(process.uptime())
	};
});

fastify.post("/api/panel/notify", async (req, reply) => {
	if (!requireLocal(req, reply)) return;
	const { username, userId, message } = req.body || {};
	let id = parseInt(userId, 10);
	if (!Number.isInteger(id) && username) {
		const row = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(String(username));
		id = row?.id;
	}
	if (!Number.isInteger(id)) return reply.code(400).send({ error: "User not found" });
	const text = String(message || "").slice(0, 300);
	if (!text) return reply.code(400).send({ error: "Message required" });
	const delivered = notifyUser(id, { type: "owner_notice", message: text, timestamp: Date.now() });
	return { ok: true, delivered: !!delivered };
});

fastify.post("/api/panel/kick", async (req, reply) => {
	if (!requireLocal(req, reply)) return;
	const { username, userId, reason } = req.body || {};
	let id = parseInt(userId, 10);
	if (!Number.isInteger(id) && username) {
		const row = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(String(username));
		id = row?.id;
	}
	if (!Number.isInteger(id)) return reply.code(400).send({ error: "User not found" });
	const ok = kickUser(id, String(reason || "Disconnected by an administrator").slice(0, 200));
	return { ok, kicked: ok };
});

fastify.post("/api/panel/kick-all", async (req, reply) => {
	if (!requireLocal(req, reply)) return;
	const stats = getPresenceStats();
	let kicked = 0;
	for (const u of stats.users) {
		const row = db.prepare("SELECT role FROM users WHERE id = ?").get(u.userId);
		const staff = row?.role === "admin" || isPrivilegedUsername(u.username);
		if (!staff) {
			if (kickUser(u.userId, "Service restarting — please reconnect shortly.")) kicked++;
		}
	}
	return { ok: true, kicked };
});

fastify.post("/api/panel/announce", async (req, reply) => {
	if (!requireLocal(req, reply)) return;
	const text = String(req.body?.message || "").slice(0, 300);
	if (!text) return reply.code(400).send({ error: "Message required" });
	broadcastSystemAnnouncement(text, "OWNER");
	return { ok: true };
});

// --- Anonymized access log for the Owner Panel log stream ---
const serverLogPath = fileURLToPath(new URL("../data/server.log", import.meta.url));
let logStream = createWriteStream(serverLogPath, { flags: "a" });
let logBytes = 0;
try { logBytes = statSync(serverLogPath).size; } catch {}
let logChecks = 0;

fastify.addHook("onResponse", async (req, reply) => {
	try {
		const u = req.url;
		if (u.startsWith("/scram") || u.startsWith("/baremux") || u.startsWith("/epoxy") ||
			u.startsWith("/libcurl") || u.startsWith("/games/") || u.startsWith("/controller/") ||
			u.startsWith("/wisp") || u.startsWith("/ws") || u.startsWith("/api/panel/")) return;
		if (/\.(js|css|png|jpe?g|svg|ico|wasm|woff2?|map|webp)(\?|$)/i.test(u)) return;
		const ip = "anon-" + createHash("sha256").update(String(req.ip || "-")).digest("hex").slice(0, 8);
		const line = `${new Date().toISOString()} ${req.method} ${u} ${reply.statusCode} ${Math.round(reply.elapsedTime || 0)}ms ${ip}\n`;
		logStream.write(line);
		logBytes += line.length;
		if (++logChecks >= 200) {
			logChecks = 0;
			if (logBytes > 1_500_000) {
				logStream.end();
				logStream = createWriteStream(serverLogPath, { flags: "w" });
				logBytes = 0;
			}
		}
	} catch {}
});

fastify.addHook("onError", async (req, reply, err) => {
	try {
		logStream.write(`${new Date().toISOString()} ERROR ${req.method} ${req.url} ${String(err?.message || err).slice(0, 300)}\n`);
	} catch {}
});

// --- Static file routes ---

// Public frontend files (must be first with decorateReply: true)
fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

// Patched Scramjet V2 bundle route for Service Worker compatibility
let patchedScramjetBundle = null;
fastify.get("/scram/scramjet_bundled.js", async (req, reply) => {
	if (!patchedScramjetBundle) {
		const filePath = join(scramjetPath, "scramjet_bundled.js");
		const content = readFileSync(filePath, "utf8");
		const targetStr = 'function P(A){if("function"==typeof A)return new Proxy(A,{});function I(A){let I={};for(let g of Object.getOwnPropertyNames(A))I[g]=Object.getOwnPropertyDescriptor(A,g);for(let g of Object.getOwnPropertySymbols(A))I[g]=Object.getOwnPropertyDescriptor(A,g);return I}return Object.create(function A(g){return null===g?null:Object.create(A(Object.getPrototypeOf(g)),I(g))}(Object.getPrototypeOf(A)),I(A))}';
		const safeP = 'function P(A){if(!A||(typeof A!=="function"&&typeof A!=="object"))return A;if("function"==typeof A)return new Proxy(A,{});function I(A){let I={};if(!A)return I;for(let g of Object.getOwnPropertyNames(A))try{I[g]=Object.getOwnPropertyDescriptor(A,g)}catch(e){}for(let g of Object.getOwnPropertySymbols(A))try{I[g]=Object.getOwnPropertyDescriptor(A,g)}catch(e){}return I}return Object.create(function A(g){if(!g||(typeof g!=="object"&&typeof g!=="function"))return null;let proto=null;try{proto=Object.getPrototypeOf(g)}catch(e){}return!proto?null:Object.create(A(proto),I(g))}(Object.getPrototypeOf(A)),I(A))}';
		patchedScramjetBundle = content.replace(targetStr, safeP);
	}
	return reply.type("application/javascript").send(patchedScramjetBundle);
});

// Scramjet proxy engine files
fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});

// Scramjet controller files
fastify.register(fastifyStatic, {
	root: controllerPath,
	prefix: "/controller/",
	decorateReply: false,
});

// BareMux transport worker
fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});

// Epoxy transport
fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});

// libcurl transport
fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});

// Games static files
fastify.register(fastifyStatic, {
	root: gamesPath,
	prefix: "/games/",
	decorateReply: false,
});

// Chromebook Optimizer — inject the Frame Boost bootstrap into game pages
// before any game script runs (forces high-performance WebGL + clamps DPR).
const PERF_BOOTSTRAP = `<script data-clash-perf>
(function(){try{
var p=JSON.parse(localStorage.getItem("clash_perf")||"{}");
var fb=!!p.frameBoost;
var res=parseFloat(p.resolution);if(!(res>0)||res>1)res=1;
if(!fb&&res>=1)return;
if(fb){var origGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,opts){
	if(type==="webgl"||type==="webgl2"||type==="experimental-webgl"){
		if(opts===undefined||opts===null)opts={};
		if(typeof opts==="object"){try{if(!opts.powerPreference)opts.powerPreference="high-performance";}catch(e){}}
	}
	return origGetContext.call(this,type,opts);
};}
var nativeDpr=window.devicePixelRatio||1;
var selfFs=false;
try{Object.defineProperty(window,"devicePixelRatio",{configurable:true,get:function(){
	var d=fb?1:nativeDpr;
	if(res<1&&(selfFs||window.__clashPerfFs))d*=res;
	return d;
}});}catch(e){}
if(res<1){document.addEventListener("fullscreenchange",function(){selfFs=document.fullscreenElement!=null;});}
}catch(e){}})();
</script>`;

const perfHtmlCache = new Map();

fastify.addHook("onSend", async (req, reply, payload) => {
	try {
		if (!req.url.startsWith("/games/") || !req.url.endsWith(".html")) return payload;
		const ct = reply.getHeader("content-type");
		if (!ct || !String(ct).includes("text/html")) return payload;

		let html = null;
		let fromStream = false;

		if (typeof payload === "string") {
			html = payload;
		} else if (Buffer.isBuffer(payload)) {
			html = payload.toString("utf8");
		} else if (payload && typeof payload.pipe === "function") {
			if (perfHtmlCache.has(req.url)) return perfHtmlCache.get(req.url);
			html = await new Promise((resolve, reject) => {
				const chunks = [];
				payload.on("data", (c) => chunks.push(c));
				payload.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
				payload.on("error", reject);
			});
			fromStream = true;
		} else {
			return payload;
		}

		if (html.includes("data-clash-perf")) return payload;
		if (/<head[^>]*>/i.test(html)) {
			html = html.replace(/<head[^>]*>/i, (m) => m + PERF_BOOTSTRAP);
		} else {
			html = PERF_BOOTSTRAP + html;
		}

		const out = typeof payload === "string" ? html : Buffer.from(html, "utf8");
		reply.header("content-length", Buffer.byteLength(html));
		if (fromStream) perfHtmlCache.set(req.url, out);
		return out;
	} catch (e) {
		return payload;
	}
});

// Scramjet service worker fallback handler (for when SW is not yet active)
fastify.get("/scram/service/*", (req, reply) => {
	return reply.type("text/html").send(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>Connecting — Clash Proxy</title>
			<style>body{background:#0a0a0f;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
			<script>
				if ('serviceWorker' in navigator) {
					navigator.serviceWorker.ready.then(() => setTimeout(() => location.reload(), 300));
				}
				setTimeout(() => location.reload(), 1200);
			</script>
		</head>
		<body>
			<div style="text-align:center">
				<h2 style="font-weight:600;margin-bottom:8px">Connecting to Proxy...</h2>
				<p style="opacity:0.5;font-size:0.9rem">Please wait while the Service Worker initializes.</p>
			</div>
		</body>
		</html>
	`);
});

// Remote logging endpoint
fastify.post("/api/log", async (req, reply) => {
	console.log("[CLIENT LOG]", req.body);
	return { success: true };
});

// 404 handler
fastify.setNotFoundHandler((req, reply) => {
	return reply.code(404).type("text/html").send(`
		<!DOCTYPE html>
		<html><head><title>404 — Clash Proxy</title>
		<style>body{background:#0a0a0f;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
		.c{text-align:center}h1{font-size:4rem;font-weight:900;margin:0}p{opacity:.5}a{color:#a29bfe}</style></head>
		<body><div class="c"><h1>404</h1><p>Page not found.</p><a href="/" target="_top">← Back to Clash Proxy</a></div></body></html>
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
