import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
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
import { WarpTCPSocket } from "./warp-tcp-socket.js";

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
import { isPrivilegedUsername, extractAuthUser, isAdminUser, isOwnerMode, freshDbUser, verifyToken } from "./auth-utils.js";
import { hasPrivilege, userRank } from "./ranks.js";

// ============================================================
// Fastify Server
// ============================================================
const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				// Old Render deployment → bounce everyone to the real home.
				// (Render's disk is ephemeral: accounts "saved" there vanished on
				// every deploy. One home = clash-proxy-9045.bot.nu, which persists.)
				const hostHdr = String(req.headers.host || "").toLowerCase();
				if (hostHdr.endsWith(".onrender.com")) {
					const url = req.url || "/";
					if (url === "/" || url === "/index.html" || url === "/favicon.ico") {
						// Render health-checks "/" — must stay 200.
						res.statusCode = 200;
						res.setHeader("Content-Type", "text/html; charset=utf-8");
						res.end(
							"<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
							"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
							"<title>Clash Proxy has moved</title></head>" +
							"<body style=\"margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#fff;font-family:system-ui,sans-serif;text-align:center\">" +
							"<div><h1 style=\"color:#00ff88\">Clash Proxy has moved</h1>" +
							"<p style=\"opacity:.75\">Accounts and games only save on the new home.</p>" +
							"<p><a style=\"color:#a29bfe;font-size:20px\" href=\"https://clash-proxy-9045.bot.nu\">clash-proxy-9045.bot.nu</a></p>" +
							"<script>location.replace(\"https://clash-proxy-9045.bot.nu\");</script></div></body></html>"
						);
					} else {
						res.statusCode = 302;
						res.setHeader("Location", "https://clash-proxy-9045.bot.nu" + url);
						res.end();
					}
					return;
				}
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/") || req.url.includes("/wisp")) {
					wisp.routeRequest(req, socket, head, { TCPSocket: WarpTCPSocket });
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
		const staff = row?.role === "admin";
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

// Force HTTPS — service workers (the proxy) require a secure context.
// Skipped when nginx already terminated TLS (x-forwarded-proto: https),
// for localhost, and for bare IPs (no cert exists for those).
fastify.addHook("onRequest", async (req, reply) => {
	try {
		const host = String(req.headers.host || "");
		const hostName = host.replace(/:\d+$/, "");
		if (!hostName) return;
		const isLocal = hostName === "localhost" || hostName === "127.0.0.1" || hostName === "::1" || hostName === "[::1]";
		const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostName);
		if (isLocal || isIP) return;
		if (req.headers["x-forwarded-proto"] === "https") return;
		if (req.headers.upgrade) return;
		return reply.redirect("https://" + host + req.url);
	} catch {}
});

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
			<style>body{background:#0a0a0f;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
			#msg{text-align:center;max-width:520px;padding:0 24px;line-height:1.7}a{color:#a29bfe}</style>
			<script>
				(function () {
					var msg = document.getElementById("msg");
					function show(html) { msg.innerHTML = html; }
					if (!("serviceWorker" in navigator)) {
						show("This browser can't run the proxy.<br><br><a href='/'>Back to Clash Proxy</a>");
						return;
					}
					if (location.protocol !== "https:" &&
					    location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
						if (!/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(location.hostname)) {
							location.replace("https://" + location.host + location.pathname + location.search);
							return;
						}
						show("The proxy needs a secure (https) connection.<br><br><a href='https://clash-proxy-9045.bot.nu/'>Open Clash Proxy via https</a>");
						return;
					}
					var tries = 0;
					var timer = setInterval(function () {
						tries++;
						navigator.serviceWorker.ready.then(function () {
							clearInterval(timer);
							setTimeout(function () { location.reload(); }, 250);
						}).catch(function () {});
						if (tries > 30) {
							clearInterval(timer);
							show("Still connecting to the proxy...<br><br><a href='javascript:location.reload()'>Retry</a> &nbsp;&nbsp; <a href='/'>Back to home</a>");
						}
					}, 300);
				})();
			</script>
		</head>
		<body>
			<div id="msg">
				<h2 style="font-weight:600;margin-bottom:8px">Connecting to Proxy...</h2>
				<p style="opacity:0.5;font-size:0.9rem">Please wait while the Service Worker initializes.</p>
			</div>
		</body>
		</html>
	`);
});

// Remote logging endpoint
fastify.post("/api/log", async (req, reply) => {
	console.log("[CLIENT LOG]", JSON.stringify(req.body));
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
// Owner Panel — in-site reverse proxy (/panel → 127.0.0.1:8081)
// Owner gate is server-side: ?token on first click (pins HttpOnly
// cookie), then cookie/Bearer checked on EVERY /panel/* request.
// ============================================================
const PANEL_COOKIE = "cp_panel";
function panel403(reasonHtml) {
	return `<!doctype html><html><head><title>403 — Owner only</title>
<style>body{background:#0a0a0f;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.c{text-align:center;max-width:520px;padding:0 24px}h1{font-size:3rem;font-weight:900}p{opacity:.7;line-height:1.6}a{display:inline-block;margin-top:14px;color:#a29bfe}</style></head>
<body><div class="c"><h1>403</h1><p>${reasonHtml}</p><a href="/">← Back to Clash Proxy</a></div></body></html>`;
}
const PANEL_403 = panel403("This area is Owner-only.");

function panelTokenFrom(req) {
	try {
		for (const part of String(req.headers.cookie || "").split(";")) {
			const s = part.trim();
			if (s.startsWith(PANEL_COOKIE + "=")) {
				const v = decodeURIComponent(s.slice(PANEL_COOKIE.length + 1));
				if (v) return v;
			}
		}
	} catch {}
	const auth = req.headers.authorization;
	if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
	if (req.query && req.query.token) return String(req.query.token);
	return null;
}

function panelDeny(reply, reasonHtml, clearCookie) {
	if (clearCookie) reply.header("Set-Cookie", `${PANEL_COOKIE}=; HttpOnly; Path=/panel; Max-Age=0`);
	reply.code(403).type("text/html; charset=utf-8").send(panel403(reasonHtml));
}

function panelProxy(req, reply) {
	const pathOnly = req.url.split("?")[0];
	const isTestingPath = pathOnly.startsWith("/panel/testing") || pathOnly.startsWith("/panel/api/testing");
	const token = panelTokenFrom(req);

	if (!token) {
		panelDeny(reply, "You're not signed in. Sign in as the Owner account, then open the panel from the sidebar.");
		return;
	}
	const decoded = verifyToken(token);
	if (!decoded) {
		panelDeny(reply, "Your session expired or the server was updated. Sign in again, then reopen the panel.", true);
		return;
	}
	// Role comes from the DATABASE, not the token — survives stale logins
	// and refreshes instantly after role changes.
	let dbRow = null;
	try { dbRow = db.prepare("SELECT username, role FROM users WHERE id = ?").get(decoded.id); } catch {}
	if (!dbRow) {
		panelDeny(reply, "Your account could not be found on the server (it may have been reset). Sign in again — if you own this site, register with the Owner Key to reclaim it.", true);
		return;
	}
	const user = { ...decoded, role: dbRow.role, username: dbRow.username };
	// Panel entry = DATABASE role (testing panel = explicit privilege grant).
	// Never the JWT claim, never Owner Mode.
	const allowed = user && (isTestingPath ? hasPrivilege(user, "game-testing") : dbRow.role === "admin");
	if (!allowed) {
		panelDeny(reply, `You're signed in as <b>${String(dbRow.username).replace(/[<>&"]/g, "")}</b>, but this area is Owner-only.`, true);
		return;
	}
	// First arrival via the app link: pin token into HttpOnly cookie, strip it from the URL
	if (req.query && req.query.token) {
		reply.header("Set-Cookie", `${PANEL_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/panel; Max-Age=2592000; SameSite=Lax`);
		reply.redirect(pathOnly.endsWith("/") ? pathOnly : pathOnly + "/", 302);
		return;
	}
	// Keep the trailing slash so relative API paths resolve correctly
	if (pathOnly === "/panel" || pathOnly === "/panel/testing") {
		reply.redirect(pathOnly + "/", 302);
		return;
	}
	const basePath = pathOnly.endsWith("/") ? pathOnly : pathOnly + "/";
	let target = req.url.slice("/panel".length);
	if (!target.startsWith("/")) target = "/" + target;
	reply.hijack();
	// Fastify pre-parses JSON request bodies before the handler runs, so the
	// raw stream is already consumed — re-serialize the parsed body instead of
	// piping an empty stream (which made every panel POST hang forever).
	const fwdHeaders = { ...req.headers, host: "127.0.0.1:8081" };
	let payload;
	if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
		payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
		fwdHeaders["content-length"] = String(Buffer.byteLength(payload));
	}
	const preq = httpRequest(
		{ host: "127.0.0.1", port: 8081, path: target, method: req.method, headers: fwdHeaders },
		(pres) => {
			const ct = String(pres.headers["content-type"] || "");
			const outHeaders = { ...pres.headers };
			delete outHeaders["content-length"];
			delete outHeaders["transfer-encoding"];
			if (ct.includes("text/html")) {
				const chunks = [];
				pres.on("data", (c) => chunks.push(c));
				pres.on("end", () => {
					let html = Buffer.concat(chunks).toString("utf8");
					if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, (m, a) => `<head${a}><base href="${basePath}">`);
					else html = `<base href="${basePath}">` + html;
					html = html.replace(/href="http:\/\/localhost:8080\/?"/g, 'href="/"');
					outHeaders["content-length"] = Buffer.byteLength(html);
					try {
						reply.raw.writeHead(pres.statusCode || 200, outHeaders);
						reply.raw.end(html);
					} catch {}
				});
				pres.on("error", () => {});
				return;
			}
			try {
				reply.raw.writeHead(pres.statusCode || 200, outHeaders);
			} catch {
				return;
			}
			pres.pipe(reply.raw);
		}
	);
	preq.on("error", (e) => {
		console.log("PANELPROXY_ERROR:", e && (e.stack || e.message || String(e)));
		try {
			if (!reply.raw.headersSent) reply.raw.writeHead(502, { "content-type": "text/plain" });
			reply.raw.end("Owner Panel backend unreachable");
		} catch {}
	});
	if (payload !== undefined) preq.end(payload);
	else if (req.method === "GET" || req.method === "HEAD") preq.end();
	else req.pipe(preq);
}

fastify.get("/api/me/ranks", async (req, reply) => {
	const tokenUser = extractAuthUser(req);
	if (!tokenUser) return reply.code(401).send({ error: "unauthorized" });
	// Role from the DATABASE so the rank chip always matches the panel.
	const dbUser = freshDbUser(tokenUser.id);
	if (!dbUser) return reply.code(401).send({ error: "Account no longer exists on this server." });
	const user = { ...tokenUser, role: dbUser.role, username: dbUser.username };
	const r = userRank(user);
	const isAdmin = isAdminUser(user);
	// Owner Mode is cosmetic-only: it makes everyone's chip say "Owner"
	// and never grants panel/API access (those check DB role directly).
	const showOwner = isAdmin || isOwnerMode();
	return { rankName: r.rankName || (showOwner ? "Owner" : null), privileges: r.privileges, admin: showOwner };
});

fastify.all("/panel", panelProxy);
fastify.all("/panel/*", panelProxy);

// ============================================================
// Owner Panel backend — auto-start the panel process
// (127.0.0.1:8081) when nothing is listening yet, so /panel
// works everywhere the site runs (local + Render).
// If the panel ever crashes it is respawned automatically —
// otherwise /panel stayed dead ("Owner Panel backend
// unreachable") until a full site restart.
// ============================================================
let panelChild = null;
let panelRespawnTimer = null;
function spawnPanelBackend() {
	try {
		const child = spawn(process.execPath, [fileURLToPath(new URL("../clash owner pannel/server.js", import.meta.url))], {
			cwd: fileURLToPath(new URL("../", import.meta.url)),
			stdio: "ignore",
			detached: false,
		});
		panelChild = child;
		child.on("error", () => { panelChild = null; });
		child.on("exit", () => {
			panelChild = null;
			if (!panelRespawnTimer) {
				panelRespawnTimer = setTimeout(() => { panelRespawnTimer = null; ensurePanelBackend(); }, 3000);
			}
		});
	} catch {}
}
async function ensurePanelBackend() {
	if (panelChild) return;
	try {
		await fetch("http://127.0.0.1:8081/api/system/health", { signal: AbortSignal.timeout(900) });
		return; // a panel is already listening (e.g. started manually)
	} catch {}
	spawnPanelBackend();
}
process.on("exit", () => { try { if (panelChild) panelChild.kill(); } catch {} });
ensurePanelBackend();

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
