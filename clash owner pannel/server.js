import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { randomBytes, createCipheriv, createHash } from "node:crypto";
import Database from "better-sqlite3";

import db from "../src/db.js";
import { BADGES } from "../src/auth-utils.js";
import { askAIReply, validateOpenRouterKey } from "../src/routes/ai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

// Owner Panel server — bound to 127.0.0.1 ONLY (owner PC only).
const HOST = "127.0.0.1";
const PORT = 8081;
const MAIN = "http://127.0.0.1:8080";

const STORE_PATH = path.join(__dirname, "ranks-data.json");
const CONFIG_PATH = path.join(__dirname, "panel-config.json");
const PANEL_DB_PATH = path.join(__dirname, "panel.db");
const INDEX_PATH = path.join(__dirname, "index.html");
const BACKUP_DIR = path.join(__dirname, "backups");

// Every privilege below is a full OWNER-level privilege.
const PRIVILEGES = [
	{ id: "user-management", name: "User Management", desc: "Edit any player's stats, tag, name & profile" },
	{ id: "role-assignment", name: "Role Assignment", desc: "Promote or demote any player's system role" },
	{ id: "achievement-control", name: "Achievement Control", desc: "Grant or revoke any badge / achievement" },
	{ id: "server-broadcast", name: "Server Broadcast", desc: "Send server-wide live announcements" },
	{ id: "god-mode", name: "God Mode", desc: "Activate instant God Mode on your account" },
	{ id: "owner-mode", name: "Owner Mode", desc: "Toggle temporary global Owner Mode" },
	{ id: "account-takeover", name: "Account Takeover", desc: "Log into any account (password bypass)" },
	{ id: "password-reset", name: "Password Reset", desc: "Reset any player's password" },
	{ id: "economy-control", name: "Economy Control", desc: "Control coins, Bazaar prices & cosmetics" },
	{ id: "content-moderation", name: "Content Moderation", desc: "Moderate chat, lounge & messages" },
	{ id: "shield-control", name: "Clash Shield Control", desc: "Configure Clash Shield & whitelists" },
	{ id: "game-library", name: "Game Library", desc: "Manage the game library & titles" },
	{ id: "game-testing", name: "Game Testing", desc: "Approve, publish & reject staged games before they go live" },
	{ id: "script-control", name: "Script Control", desc: "Manage userscripts" },
	{ id: "save-access", name: "Save Data Access", desc: "Access game saves" },
	{ id: "server-control", name: "Server Control", desc: "Server configuration & restart" },
	{ id: "database-access", name: "Database Access", desc: "Full database access" },
	{ id: "social-moderation", name: "Social Moderation", desc: "Moderate friends, presence & profiles" },
	{ id: "panel-access", name: "Owner Panel Access", desc: "Access this Owner Panel" },
	{ id: "all-access", name: "⚡ ALL OWNER PRIVILEGES", desc: "Master key — every owner privilege at once" }
];
const PRIV_IDS = new Set(PRIVILEGES.map((p) => p.id));
const USER_COLS = "id, username, display_name, avatar_url, role, custom_tag, level, xp, coins, banned, banned_until, muted, muted_until, last_ip, streak_days, games_played_override, sites_visited_override";

// ============================================================
// Storage helpers
// ============================================================
function loadStore() {
	try {
		const s = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
		if (!s || !Array.isArray(s.presets) || typeof s.assignments !== "object" || !s.assignments) throw new Error("bad");
		return s;
	} catch {
		return { presets: [], assignments: {} };
	}
}
function saveStore(s) { fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, "\t") + "\n"); }

const DEFAULT_CONFIG = {
	economy: { rankPointsPerXp: 1, tokenCostBadge: 50, conversionRate: 10 },
	defaults: { theme: "dark", sound: 0.7, graphics: "auto" },
	siteTheme: "dark",
	motd: "Welcome to Clash Proxy!",
	modules: { lounge: true, chat: true, leaderboard: true, friends: true, bazaar: false, games: true },
	rateLimit: { pps: 500, chatFlood: 5 },
	alerts: { enabled: false, webhookUrl: "", events: ["crash", "ban", "maintenance"] },
	emoji: [{ code: ":clash:", value: "⚡" }, { code: ":crown:", value: "👑" }, { code: ":gg:", value: "🎮" }],
	mapRotation: { Platformer: ["Classic Run", "Sky Dash"], Arcade: ["Neon Grid", "Retro Arena"] },
	slotCaps: { "Lobby A": 16, "Lobby B": 8 },
	sim: { instances: [], matches: [] }
};
function loadConfig() {
	try {
		const c = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
		return { ...structuredClone(DEFAULT_CONFIG), ...c };
	} catch {
		return structuredClone(DEFAULT_CONFIG);
	}
}
function saveConfig(c) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, "\t") + "\n"); }

function writeDataFile(name, obj) {
	fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(obj, null, "\t") + "\n");
}
function readDataFile(name) {
	try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")); } catch { return {}; }
}
function mergeAccessControl(patch) {
	const cur = readDataFile("access-control.json");
	const next = { maintenance: false, maintenanceMessage: "", whitelistEnabled: false, whitelist: [], ...cur, ...patch };
	writeDataFile("access-control.json", next);
	return next;
}

// ============================================================
// Panel database (reports, punishments, audit, staff notes, keys)
// ============================================================
const panelDb = new Database(PANEL_DB_PATH);
panelDb.pragma("journal_mode = WAL");
panelDb.exec(`
CREATE TABLE IF NOT EXISTS reports (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	reporter_id INTEGER, reporter_username TEXT NOT NULL,
	reported_id INTEGER, reported_username TEXT NOT NULL,
	category TEXT NOT NULL, details TEXT,
	status TEXT NOT NULL DEFAULT 'open',
	staff_note TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	resolved_at DATETIME
);
CREATE TABLE IF NOT EXISTS punishments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL, username TEXT NOT NULL,
	type TEXT NOT NULL, reason TEXT, staff TEXT DEFAULT 'OWNER',
	active INTEGER DEFAULT 0, expires_at DATETIME,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL, body TEXT, author TEXT DEFAULT 'OWNER',
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	action TEXT NOT NULL, detail TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS api_keys (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL, key_hash TEXT NOT NULL, prefix TEXT NOT NULL,
	revoked INTEGER DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	last_used_at DATETIME
);
`);

function audit(action, detail) {
	try { panelDb.prepare("INSERT INTO audit_log (action, detail) VALUES (?, ?)").run(action, String(detail || "").slice(0, 500)); } catch {}
}

// Auto-lift expired timed bans / timeouts and close their punishment rows.
function sweepExpired() {
	let cleared = 0;
	try {
		const now = Date.now();
		cleared += db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE banned = 1 AND banned_until IS NOT NULL AND banned_until <= ?").run(now).changes;
		cleared += db.prepare("UPDATE users SET muted = 0, muted_until = NULL WHERE muted = 1 AND muted_until IS NOT NULL AND muted_until <= ?").run(now).changes;
		panelDb.prepare("UPDATE punishments SET active = 0 WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?").run(now);
	} catch {}
	return cleared;
}
setInterval(sweepExpired, 15000).unref?.();

// ============================================================
// Shared punishment core — used by /api/punish AND Jarvis AI.
// type: ban/unban/mute/unmute/kick/stop-ban/stop-timeout
// durMin: minutes (0 = permanent). Returns result object with
// optional .error instead of throwing.
// ============================================================
async function applyPunishment(user, type, reason, durMin) {
	if (type === "stop-ban") type = "unban";
	if (type === "stop-timeout") type = "unmute";
	reason = String(reason || "No reason given").slice(0, 300);
	durMin = Math.max(0, Number(durMin) || 0);
	const until = durMin > 0 ? Date.now() + Math.round(durMin * 60000) : null;
	const durLabel = until ? (durMin >= 1440 ? `${Math.round(durMin / 1440)}d` : durMin >= 60 ? `${Math.round(durMin / 60)}h` : durMin < 1 ? "<1m" : `${Math.round(durMin)}m`) : "permanent";
	let result = {};
	if (type === "ban") {
		db.prepare("UPDATE users SET banned = 1, banned_until = ? WHERE id = ?").run(until, user.id);
		result.kicked = (await bridge("/api/panel/kick", { userId: user.id, reason })).kicked;
		result.expiresAt = until;
		panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, active, expires_at) VALUES (?, ?, 'ban', ?, 1, ?)").run(user.id, user.username, reason, until);
	} else if (type === "unban") {
		db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?").run(user.id);
		panelDb.prepare("UPDATE punishments SET active = 0 WHERE user_id = ? AND type = 'ban' AND active = 1").run(user.id);
		panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, active) VALUES (?, ?, 'unban', ?, 0)").run(user.id, user.username, reason);
	} else if (type === "mute") {
		db.prepare("UPDATE users SET muted = 1, muted_until = ? WHERE id = ?").run(until, user.id);
		result.expiresAt = until;
		panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, active, expires_at) VALUES (?, ?, 'mute', ?, 1, ?)").run(user.id, user.username, reason, until);
	} else if (type === "unmute") {
		db.prepare("UPDATE users SET muted = 0, muted_until = NULL WHERE id = ?").run(user.id);
		panelDb.prepare("UPDATE punishments SET active = 0 WHERE user_id = ? AND type = 'mute' AND active = 1").run(user.id);
		panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, active) VALUES (?, ?, 'unmute', ?, 0)").run(user.id, user.username, reason);
	} else if (type === "kick") {
		result.kicked = (await bridge("/api/panel/kick", { userId: user.id, reason })).kicked;
		panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, active) VALUES (?, ?, 'kick', ?, 0)").run(user.id, user.username, reason);
	} else {
		return { error: "type must be ban/unban/mute/unmute/kick/stop-ban/stop-timeout" };
	}
	audit("mod.punish", `${type} @${user.username}${["ban", "mute"].includes(type) ? ` (${durLabel})` : ""}: ${reason}`);
	return { ok: true, duration: ["ban", "mute"].includes(type) ? durLabel : null, ...result };
}

// ============================================================
// Bridge to the main proxy (localhost:8080)
// ============================================================
async function bridge(pathname, body) {
	try {
		const res = await fetch(MAIN + pathname, {
			method: body ? "POST" : "GET",
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(4000)
		});
		return await res.json().catch(() => ({}));
	} catch (e) {
		return { _bridgeError: String(e?.message || e) };
	}
}

// ============================================================
// HTTP plumbing
// ============================================================
function json(res, code, obj) {
	const body = JSON.stringify(obj);
	res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
	res.end(body);
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", (c) => {
			data += c;
			if (data.length > 2_000_000) { reject(new Error("Body too large")); req.destroy(); }
		});
		req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("Invalid JSON")); } });
		req.on("error", reject);
	});
}
function sanitizePrivs(list) {
	return Array.isArray(list) ? [...new Set(list.filter((id) => PRIV_IDS.has(id)))] : [];
}
function findUser(q) {
	const n = parseInt(q, 10);
	if (Number.isInteger(n)) {
		const byId = db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(n);
		if (byId) return byId;
	}
	return db.prepare(`SELECT ${USER_COLS} FROM users WHERE LOWER(username) = LOWER(?)`).get(String(q || ""));
}

// ============================================================
// Health sampler (CPU / RAM / bandwidth / proxy ping)
// ============================================================
let bandwidth = { bps: null, at: 0 };
let lastIfTotal = null;
let lastIfAt = 0;
execFile("powershell", ["-NoProfile", "-Command",
	"(Get-NetAdapterStatistics -ErrorAction SilentlyContinue | Measure-Object -Property ReceivedBytes -Sum).Sum + (Get-NetAdapterStatistics -ErrorAction SilentlyContinue | Measure-Object -Property SentBytes -Sum).Sum"],
	(err, stdout) => { if (!err) { lastIfTotal = parseInt(stdout.trim(), 10) || null; lastIfAt = Date.now(); } });
setInterval(() => {
	execFile("powershell", ["-NoProfile", "-Command",
		"(Get-NetAdapterStatistics -ErrorAction SilentlyContinue | Measure-Object -Property ReceivedBytes -Sum).Sum + (Get-NetAdapterStatistics -ErrorAction SilentlyContinue | Measure-Object -Property SentBytes -Sum).Sum"],
		(err, stdout) => {
			if (err) return;
			const total = parseInt(stdout.trim(), 10);
			if (Number.isFinite(total) && lastIfTotal != null) {
				const dt = (Date.now() - lastIfAt) / 1000;
				if (dt >= 1) bandwidth = { bps: Math.max(0, Math.round((total - lastIfTotal) / dt)), at: Date.now() };
			}
			lastIfTotal = Number.isFinite(total) ? total : lastIfTotal;
			lastIfAt = Date.now();
		});
}, 5000).unref?.();

async function getHealth() {
	let proxy = { up: false, latencyMs: null };
	try {
		const t0 = Date.now();
		await fetch(MAIN + "/", { method: "HEAD", signal: AbortSignal.timeout(2500) });
		proxy = { up: true, latencyMs: Date.now() - t0 };
	} catch {}
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	return {
		proxy,
		bandwidth,
		system: {
			cpuLoad1: os.loadavg()[0],
			cores: os.cpus().length,
			cpuModel: os.cpus()[0]?.model || "",
			memUsed: totalMem - freeMem,
			memTotal: totalMem
		},
		proc: { ...process.cpuUsage(), memoryMB: Math.round(process.memoryUsage().rss / 1048576), uptimeSec: Math.round(process.uptime()) }
	};
}

// ============================================================
// Backups (VACUUM INTO + AES-256-GCM encryption)
// ============================================================
function getBackupKey() {
	const cfg = loadConfig();
	if (!cfg.backupKey) {
		cfg.backupKey = randomBytes(32).toString("hex");
		saveConfig(cfg);
	}
	return Buffer.from(cfg.backupKey, "hex");
}
function encryptBuffer(buf, key) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
	return Buffer.concat([Buffer.from("CPBK1"), iv, cipher.getAuthTag(), enc]);
}
async function runBackup() {
	fs.mkdirSync(BACKUP_DIR, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const key = getBackupKey();
	const made = [];
	for (const [label, source] of [["clash", db], ["panel", panelDb]]) {
		const tmp = path.join(BACKUP_DIR, `.tmp-${label}-${ts}.db`);
		source.prepare("VACUUM INTO ?").run(tmp);
		const raw = fs.readFileSync(tmp);
		fs.unlinkSync(tmp);
		const out = path.join(BACKUP_DIR, `${label}-${ts}.cpbak`);
		fs.writeFileSync(out, encryptBuffer(raw, key));
		made.push({ file: path.basename(out), bytes: fs.statSync(out).size });
	}
	return made;
}

// ============================================================
// Restart the main proxy (kill PID on :8080, respawn)
// ============================================================
let rebootTimer = null;
function ps(cmd) {
	return new Promise((resolve) => execFile("powershell", ["-NoProfile", "-Command", cmd], (e, so) => resolve(e ? "" : so.trim())));
}
async function restartMain() {
	const pid = parseInt(await ps("(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"), 10);
	if (Number.isInteger(pid)) {
		await new Promise((r) => execFile("taskkill", ["/PID", String(pid), "/F"], () => r()));
	}
	await new Promise((r) => setTimeout(r, 900));
	const child = spawn("node", ["src/index.js"], { cwd: ROOT, detached: true, stdio: "ignore" });
	child.unref();
	audit("system.reboot", `main proxy restarted (old pid ${pid || "unknown"})`);
}

// ============================================================
// Router
// ============================================================
// ---------- rank privilege grants (never forces the admin role) ----------
function grantPrivilege(userId, privilege, on) {
	const store = loadStore();
	let a = store.assignments[String(userId)];
	if (!a) {
		const u = db.prepare("SELECT role, custom_tag, username FROM users WHERE id = ?").get(userId);
		if (!u) return null;
		a = { presetId: null, rankName: "Game Tester", privileges: [], username: u.username, prevTag: u.custom_tag || null, prevRole: u.role || "user" };
		store.assignments[String(userId)] = a;
	} else if (!a.username) {
		// Backfill the username tag so DB resets can't hand this rank to a different account.
		const u = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
		if (u) a.username = u.username;
	}
	const set = new Set(Array.isArray(a.privileges) ? a.privileges : []);
	if (on) set.add(privilege); else set.delete(privilege);
	a.privileges = [...set];
	saveStore(store);
	return a;
}

// ---------- staged game queue (Jarvis downloads await tester approval) ----------
const PENDING_DIR = path.join(DATA_DIR, "pending-games");
const QUEUE_PATH = path.join(PENDING_DIR, "queue.json");
function loadQueue() {
	try { return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8")); }
	catch { return { pending: [], rejected: [], published: [], liveReview: [] }; }
}
function saveQueue(q) {
	fs.mkdirSync(PENDING_DIR, { recursive: true });
	fs.writeFileSync(QUEUE_PATH, JSON.stringify(q, null, "\t"));
}
function stageDownloaded(filename, title, sourceUrl) {
	const id = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	const stem = filename.replace(/\.html$/i, "");
	fs.mkdirSync(PENDING_DIR, { recursive: true });
	try { fs.renameSync(path.join(GAMES_DIR, filename), path.join(PENDING_DIR, filename)); }
	catch { return null; }
	try {
		const srcDir = path.join(GAMES_DIR, stem);
		if (fs.existsSync(srcDir)) fs.renameSync(srcDir, path.join(PENDING_DIR, stem));
	} catch {}
	const q = loadQueue();
	q.pending.unshift({ id, title, filename, sourceUrl: sourceUrl || "", addedAt: Date.now() });
	saveQueue(q);
	return id;
}

const server = http.createServer(async (req, res) => {
	let pathname = "/";
	try { pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname; } catch {}
	const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);

	try {
		if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
			const html = fs.readFileSync(INDEX_PATH);
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length });
			res.end(html);
			return;
		}

		// ---------- TESTER PANEL ----------
		if (req.method === "GET" && (pathname === "/testing" || pathname === "/testing/")) {
			try {
				const html = fs.readFileSync(path.join(__dirname, "testing.html"));
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length });
				res.end(html);
			} catch {
				res.writeHead(500, { "Content-Type": "text/plain" });
				res.end("testing.html missing");
			}
			return;
		}
		if (req.method === "GET" && pathname === "/api/testing/queue") {
			const q = loadQueue();
			return json(res, 200, { pending: q.pending || [], liveReview: q.liveReview || [], rejectedCount: (q.rejected || []).length, publishedCount: (q.published || []).length });
		}
		if (req.method === "POST" && pathname === "/api/testing/pass") {
			const body = await readBody(req);
			const q = loadQueue();
			const e = (q.pending || []).find((x) => x.id === body.id);
			if (!e) return json(res, 404, { error: "Not in the queue." });
			const stem = e.filename.replace(/\.html$/i, "");
			const src = path.join(PENDING_DIR, e.filename);
			if (!fs.existsSync(src)) return json(res, 404, { error: "Staged file is missing." });
			try {
				fs.renameSync(src, path.join(GAMES_DIR, e.filename));
				const sa = path.join(PENDING_DIR, stem);
				if (fs.existsSync(sa)) {
					const da = path.join(GAMES_DIR, stem);
					if (fs.existsSync(da)) fs.rmSync(da, { recursive: true, force: true });
					fs.renameSync(sa, da);
				}
			} catch (err) {
				return json(res, 500, { error: "publish failed: " + err.message });
			}
			addGameTitleEntry(e.filename, e.title);
			await reloadGameCache();
			q.pending = q.pending.filter((x) => x.id !== body.id);
			(q.published = q.published || []).unshift({ ...e, publishedAt: Date.now(), reviewedBy: String(body.by || "tester") });
			saveQueue(q);
			audit("game.approve", `${e.title} → live`);
			return json(res, 200, { ok: true, title: e.title, filename: e.filename });
		}
		if (req.method === "POST" && pathname === "/api/testing/fail") {
			const body = await readBody(req);
			const q = loadQueue();
			const e = (q.pending || []).find((x) => x.id === body.id);
			if (!e) return json(res, 404, { error: "Not in the queue." });
			const reason = String(body.reason || "").slice(0, 300);
			const stem = e.filename.replace(/\.html$/i, "");
			try {
				const src = path.join(PENDING_DIR, e.filename);
				if (fs.existsSync(src)) fs.renameSync(src, path.join(PENDING_DIR, stem + ".rejected.html"));
			} catch {}
			q.pending = q.pending.filter((x) => x.id !== body.id);
			(q.rejected = q.rejected || []).unshift({ ...e, rejectedAt: Date.now(), reason });
			saveQueue(q);
			audit("game.reject", `${e.title}: ${reason || "no reason"}`);
			return json(res, 200, { ok: true });
		}

		// ---------- RANK PRIVILEGE GRANTS (does NOT force the admin role) ----------
		if (req.method === "POST" && pathname === "/api/grants") {
			const body = await readBody(req);
			let userId = parseInt(body.userId, 10);
			if (!Number.isInteger(userId) && body.username) {
				const u = findUser(String(body.username));
				if (u) userId = u.id;
			}
			const priv = String(body.privilege || "").trim();
			if (!Number.isInteger(userId)) return json(res, 400, { error: "userId or username required." });
			if (!PRIVILEGES.some((p) => p.id === priv)) return json(res, 400, { error: "Unknown privilege." });
			const a = grantPrivilege(userId, priv, body.on !== false);
			if (!a) return json(res, 404, { error: "User not found." });
			const u = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			audit("rank.grant", `@${u?.username || userId}: ${body.on !== false ? "+" : "-"}${priv}`);
			return json(res, 200, { ok: true, privileges: a.privileges });
		}
		if (req.method === "GET" && pathname === "/api/grants") {
			const username = String(q.username || "").trim();
			const u = username ? findUser(username) : null;
			if (!u) return json(res, 404, { error: "User not found." });
			const a = loadStore().assignments[String(u.id)];
			return json(res, 200, { userId: u.id, privileges: (a && a.privileges) || [], rankName: a?.rankName || null });
		}

		// ---------- STATE ----------
		if (req.method === "GET" && pathname === "/api/state") {
			sweepExpired();
			const store = loadStore();
			const counts = {
				reportsOpen: panelDb.prepare("SELECT COUNT(*) c FROM reports WHERE status = 'open'").get().c,
				punishments: panelDb.prepare("SELECT COUNT(*) c FROM punishments").get().c,
				audit: panelDb.prepare("SELECT COUNT(*) c FROM audit_log").get().c
			};
			return json(res, 200, {
				privileges: PRIVILEGES,
				users: db.prepare(`SELECT ${USER_COLS} FROM users ORDER BY LOWER(username)`).all(),
				presets: store.presets,
				assignments: store.assignments,
				config: loadConfig(),
				chatConfig: readDataFile("chat-config.json"),
				accessControl: readDataFile("access-control.json"),
				xpEvent: readDataFile("xp-event.json"),
				counts,
				dbOk: true
			});
		}

		// ---------- RANK PRESETS ----------
		if (req.method === "POST" && pathname === "/api/presets") {
			const body = await readBody(req);
			const name = String(body.name || "").trim().slice(0, 40);
			const privileges = sanitizePrivs(body.privileges);
			if (!name) return json(res, 400, { error: "Rank name is required." });
			const store = loadStore();
			let preset;
			if (body.id) {
				preset = store.presets.find((x) => x.id === body.id);
				if (!preset) return json(res, 404, { error: "Preset not found." });
				preset.name = name; preset.privileges = privileges;
			} else {
				preset = { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, privileges };
				store.presets.push(preset);
			}
			saveStore(store);
			audit("rank.preset.save", `${name} (${privileges.length} privileges)`);
			return json(res, 200, { ok: true, preset });
		}
		if (req.method === "POST" && pathname === "/api/presets/delete") {
			const body = await readBody(req);
			const store = loadStore();
			const before = store.presets.length;
			store.presets = store.presets.filter((x) => x.id !== body.id);
			if (store.presets.length === before) return json(res, 404, { error: "Preset not found." });
			saveStore(store);
			audit("rank.preset.delete", String(body.id));
			return json(res, 200, { ok: true });
		}
		if (req.method === "POST" && pathname === "/api/assign") {
			const body = await readBody(req);
			const userId = parseInt(body.userId, 10);
			const rankName = String(body.rankName || "").trim().slice(0, 40);
			const privileges = sanitizePrivs(body.privileges);
			const presetId = typeof body.presetId === "string" && body.presetId ? body.presetId : null;
			if (!Number.isInteger(userId)) return json(res, 400, { error: "userId required." });
			if (!rankName) return json(res, 400, { error: "Rank name is required." });
			if (privileges.length === 0) return json(res, 400, { error: "Pick at least one privilege." });
			const user = db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(userId);
			if (!user) return json(res, 404, { error: "User not found." });
			const store = loadStore();
			const prev = store.assignments[String(userId)];
			db.prepare("UPDATE users SET role = 'admin', custom_tag = ? WHERE id = ?").run(rankName, userId);
			store.assignments[String(userId)] = {
				presetId, rankName, privileges,
				username: user.username,
				prevTag: prev ? prev.prevTag : user.custom_tag || null,
				prevRole: prev ? prev.prevRole : user.role || "user"
			};
			saveStore(store);
			audit("rank.assign", `@${user.username} → ${rankName}`);
			return json(res, 200, { ok: true, user: db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(userId) });
		}
		if (req.method === "POST" && pathname === "/api/unassign") {
			const body = await readBody(req);
			const userId = parseInt(body.userId, 10);
			const store = loadStore();
			const prev = store.assignments[String(userId)];
			if (!prev) return json(res, 404, { error: "No rank assigned to this player." });
			const u = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			db.prepare("UPDATE users SET role = ?, custom_tag = ? WHERE id = ?").run(prev.prevRole || "user", prev.prevTag || null, userId);
			delete store.assignments[String(userId)];
			saveStore(store);
			audit("rank.unassign", `@${u?.username || userId}`);
			return json(res, 200, { ok: true });
		}

		// ---------- REPORT QUEUE ----------
		if (req.method === "GET" && pathname === "/api/reports") {
			const status = q.status && q.status !== "all" ? q.status : null;
			const rows = status
				? panelDb.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT 300").all(status)
				: panelDb.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 300").all();
			return json(res, 200, { reports: rows });
		}
		if (req.method === "POST" && pathname === "/api/reports") {
			const body = await readBody(req);
			const reporter = findUser(body.reporterUsername);
			const reported = findUser(body.reportedUsername);
			if (!reported) return json(res, 404, { error: "Reported player not found." });
			const category = String(body.category || "other").slice(0, 40);
			const details = String(body.details || "").slice(0, 1000);
			panelDb.prepare(`INSERT INTO reports (reporter_id, reporter_username, reported_id, reported_username, category, details) VALUES (?, ?, ?, ?, ?, ?)`)
				.run(reporter?.id ?? null, reporter?.username || String(body.reporterUsername || "unknown"), reported.id, reported.username, category, details);
			audit("mod.report.create", `${category} → @${reported.username}`);
			return json(res, 200, { ok: true });
		}
		if (req.method === "POST" && pathname === "/api/reports/update") {
			const body = await readBody(req);
			const status = ["open", "resolved", "dismissed"].includes(body.status) ? body.status : "resolved";
			const r = panelDb.prepare("SELECT * FROM reports WHERE id = ?").get(body.id);
			if (!r) return json(res, 404, { error: "Report not found." });
			panelDb.prepare("UPDATE reports SET status = ?, staff_note = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?")
				.run(status, String(body.note || "").slice(0, 500), body.id);
			audit("mod.report.update", `#${body.id} → ${status}`);
			return json(res, 200, { ok: true });
		}

		// ---------- PLAYER LOOKUP (UUID / username) ----------
		if (req.method === "GET" && pathname === "/api/player") {
			sweepExpired();
			const user = findUser(q.q);
			if (!user) return json(res, 404, { error: "Player not found." });
			const achievements = panelDb ? db.prepare("SELECT badge_id FROM achievements WHERE user_id = ?").all(user.id).map((a) => a.badge_id) : [];
			const cosmetics = db.prepare("SELECT * FROM user_cosmetics WHERE user_id = ?").all(user.id);
			const gameCount = db.prepare("SELECT COUNT(*) c FROM activity_log WHERE user_id = ? AND type = 'game_play'").get(user.id).c;
			const punishments = panelDb.prepare("SELECT * FROM punishments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(user.id);
			const reportsAgainst = panelDb.prepare("SELECT COUNT(*) c FROM reports WHERE reported_id = ? AND status = 'open'").get(user.id).c;
			const assignment = loadStore().assignments[String(user.id)] || null;
			return json(res, 200, {
				user,
				badges: BADGES.map((b) => ({ ...b, unlocked: achievements.includes(b.id) })),
				cosmetics,
				gameCount,
				punishments,
				reportsAgainst,
				assignment
			});
		}

		// ---------- LIVE PUNISHMENTS ----------
		if (req.method === "POST" && pathname === "/api/punish") {
			const body = await readBody(req);
			sweepExpired();
			const user = findUser(body.userId ?? body.username);
			if (!user) return json(res, 404, { error: "Player not found." });
			const result = await applyPunishment(user, String(body.type || ""), body.reason, Number(body.durationMin) || 0);
			if (result.error) return json(res, 400, result);
			return json(res, 200, result);
		}

		// ---------- LEVEL / STAT MODIFIER ----------
		if (req.method === "POST" && pathname === "/api/player/stats") {
			const body = await readBody(req);
			const user = findUser(body.userId ?? body.username);
			if (!user) return json(res, 404, { error: "Player not found." });
			const sets = []; const vals = [];
			const intFields = { xp: "xp", level: "level", streakDays: "streak_days", gamesPlayed: "games_played_override", sitesVisited: "sites_visited_override", coins: "coins" };
			for (const [key, col] of Object.entries(intFields)) {
				if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
					sets.push(`${col} = ?`); vals.push(Math.max(0, parseInt(body[key], 10) || 0));
				}
			}
			if (body.customTag !== undefined) { sets.push("custom_tag = ?"); vals.push(String(body.customTag).slice(0, 40) || null); }
			if (body.displayName !== undefined) { sets.push("display_name = ?"); vals.push(String(body.displayName).slice(0, 30)); }
			if (!sets.length) return json(res, 400, { error: "No fields to update." });
			vals.push(user.id);
			db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
			audit("mod.stats", `@${user.username} updated: ${sets.length} field(s)`);
			return json(res, 200, { ok: true, user: db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(user.id) });
		}

		// ---------- STATUS FORCE-TOGGLE ----------
		if (req.method === "POST" && pathname === "/api/player/force-offline") {
			const body = await readBody(req);
			const user = findUser(body.userId ?? body.username);
			if (!user) return json(res, 404, { error: "Player not found." });
			const kicked = (await bridge("/api/panel/kick", { userId: user.id, reason: "Disconnected by administrator" })).kicked;
			audit("mod.force-offline", `@${user.username} kicked=${!!kicked}`);
			return json(res, 200, { ok: true, kicked: !!kicked });
		}
		if (req.method === "POST" && pathname === "/api/player/visibility") {
			const body = await readBody(req);
			const user = findUser(body.userId ?? body.username);
			if (!user) return json(res, 404, { error: "Player not found." });
			let settings = {};
			try { settings = JSON.parse(db.prepare("SELECT settings_json FROM users WHERE id = ?").get(user.id)?.settings_json || "{}"); } catch {}
			settings.ghostMode = !!body.ghost;
			db.prepare("UPDATE users SET settings_json = ? WHERE id = ?").run(JSON.stringify(settings), user.id);
			audit("mod.visibility", `@${user.username} ghost=${!!body.ghost}`);
			return json(res, 200, { ok: true });
		}

		// ---------- GLOBAL ACCOUNT RESET ----------
		if (req.method === "POST" && pathname === "/api/player/reset") {
			const body = await readBody(req);
			const user = findUser(body.userId ?? body.username);
			if (!user) return json(res, 404, { error: "Player not found." });
			const scope = String(body.scope || "stats");
			db.prepare("UPDATE users SET xp = 0, level = 1, streak_days = 1 WHERE id = ?").run(user.id);
			if (scope === "progression" || scope === "all") {
				db.prepare("DELETE FROM achievements WHERE user_id = ?").run(user.id);
				db.prepare("DELETE FROM activity_log WHERE user_id = ?").run(user.id);
				db.prepare("UPDATE users SET games_played_override = 0, sites_visited_override = 0 WHERE id = ?").run(user.id);
			}
			if (scope === "all") {
				db.prepare("UPDATE users SET coins = 350, custom_tag = NULL, role = 'user', banned = 0, muted = 0 WHERE id = ?").run(user.id);
				const store = loadStore();
				if (store.assignments[String(user.id)]) {
					delete store.assignments[String(user.id)];
					saveStore(store);
				}
			}
			audit("mod.reset", `@${user.username} scope=${scope}`);
			return json(res, 200, { ok: true });
		}

		// ---------- IP AUDIT ----------
		if (req.method === "GET" && pathname === "/api/ip-audit") {
			const rows = db.prepare(`SELECT ${USER_COLS} FROM users WHERE last_ip IS NOT NULL AND last_ip != '' ORDER BY last_ip`).all();
			const byIp = {};
			for (const u of rows) (byIp[u.last_ip] ||= []).push({ id: u.id, username: u.username, banned: u.banned, role: u.role });
			const shared = Object.entries(byIp).filter(([, list]) => list.length > 1);
			return json(res, 200, { sharedIps: shared.map(([ip, list]) => ({ ip, users: list })), totalTracked: rows.length });
		}

		// ---------- SYSTEM: MAINTENANCE / WHITELIST ----------
		if (req.method === "POST" && pathname === "/api/system/maintenance") {
			const body = await readBody(req);
			const acl = mergeAccessControl({ maintenance: !!body.enabled, maintenanceMessage: String(body.message || "").slice(0, 200) });
			let kicked = 0;
			if (body.enabled) kicked = (await bridge("/api/panel/kick-all", {})).kicked || 0;
			audit("system.maintenance", `${body.enabled ? "ON" : "OFF"} (kicked ${kicked})`);
			return json(res, 200, { ok: true, accessControl: acl, kicked });
		}
		if (req.method === "POST" && pathname === "/api/system/whitelist") {
			const body = await readBody(req);
			const whitelist = Array.isArray(body.whitelist) ? body.whitelist.map((w) => String(w).trim()).filter(Boolean).slice(0, 500) : [];
			const acl = mergeAccessControl({ whitelistEnabled: !!body.enabled, whitelist });
			audit("system.whitelist", `${body.enabled ? "ON" : "OFF"} (${whitelist.length} entries)`);
			return json(res, 200, { ok: true, accessControl: acl });
		}

		// ---------- SYSTEM: REBOOT ----------
		if (req.method === "POST" && pathname === "/api/system/reboot") {
			const body = await readBody(req);
			const delay = Math.max(0, Math.min(3600, parseInt(body.delaySeconds, 10) || 0));
			if (rebootTimer) { clearTimeout(rebootTimer); rebootTimer = null; }
			if (body.cancel) {
				audit("system.reboot.cancel", "scheduled restart cancelled");
				return json(res, 200, { ok: true, cancelled: true });
			}
			rebootTimer = setTimeout(() => { rebootTimer = null; restartMain().catch((e) => audit("system.reboot.error", e.message)); }, delay * 1000);
			audit("system.reboot.schedule", `in ${delay}s`);
			return json(res, 200, { ok: true, delaySeconds: delay });
		}

		// ---------- SYSTEM: HEALTH / LOGS / DB ----------
		if (req.method === "GET" && pathname === "/api/system/health") {
			return json(res, 200, await getHealth());
		}
		if (req.method === "GET" && pathname === "/api/system/logs") {
			const limit = Math.max(10, Math.min(500, parseInt(q.limit, 10) || 120));
			const filter = String(q.filter || "").toLowerCase();
			let lines = [];
			try {
				lines = fs.readFileSync(path.join(DATA_DIR, "server.log"), "utf8").split("\n").filter(Boolean);
			} catch {}
			if (filter) lines = lines.filter((l) => l.toLowerCase().includes(filter));
			const recentAudit = panelDb.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50").all();
			return json(res, 200, { lines: lines.slice(-limit), audit: recentAudit });
		}
		if (req.method === "GET" && pathname === "/api/system/db") {
			let clashPing = null, mainApi = { up: false, latencyMs: null };
			try {
				const t0 = process.hrtime.bigint();
				db.prepare("SELECT 1").get();
				clashPing = Number(process.hrtime.bigint() - t0) / 1e6;
			} catch {}
			try {
				const t0 = Date.now();
				await fetch(MAIN + "/api/games", { signal: AbortSignal.timeout(2500) });
				mainApi = { up: true, latencyMs: Date.now() - t0 };
			} catch {}
			const size = (p) => { try { return fs.statSync(p).size; } catch { return null; } };
			return json(res, 200, {
				clash: { pingMs: clashPing != null ? +clashPing.toFixed(2) : null, fileBytes: size(path.join(DATA_DIR, "clash.db")) },
				panel: { pingMs: null, fileBytes: size(PANEL_DB_PATH) },
				mainApi
			});
		}
		if (req.method === "POST" && pathname === "/api/system/backup") {
			const files = await runBackup();
			audit("system.backup", files.map((f) => f.file).join(", "));
			return json(res, 200, { ok: true, files });
		}
		if (req.method === "GET" && pathname === "/api/system/backups") {
			let files = [];
			try {
				files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".cpbak"))
					.map((f) => ({ file: f, bytes: fs.statSync(path.join(BACKUP_DIR, f)).size }))
					.sort((a, b) => b.file.localeCompare(a.file));
			} catch {}
			return json(res, 200, { files });
		}

		// ---------- SYSTEM: MODULES / RATE LIMITS / XP EVENT ----------
		if (req.method === "POST" && pathname === "/api/system/modules") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.modules = { ...cfg.modules, ...(body.modules || {}) };
			saveConfig(cfg);
			audit("system.modules", JSON.stringify(cfg.modules));
			return json(res, 200, { ok: true, modules: cfg.modules });
		}
		if (req.method === "POST" && pathname === "/api/system/rate-limit") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.rateLimit = {
				pps: Math.max(1, parseInt(body.pps, 10) || cfg.rateLimit.pps),
				chatFlood: Math.max(1, parseInt(body.chatFlood, 10) || cfg.rateLimit.chatFlood)
			};
			saveConfig(cfg);
			audit("system.rate-limit", JSON.stringify(cfg.rateLimit));
			return json(res, 200, { ok: true, rateLimit: cfg.rateLimit });
		}
		if (req.method === "POST" && pathname === "/api/system/xp-event") {
			const body = await readBody(req);
			const active = !!body.active;
			const mult = Math.max(1, Math.min(10, Number(body.mult) || 2));
			const minutes = Math.max(1, Math.min(1440, parseInt(body.minutes, 10) || 60));
			const evt = active
				? { active: true, mult, endsAt: Date.now() + minutes * 60_000, startedAt: Date.now() }
				: { active: false };
			writeDataFile("xp-event.json", evt);
			audit("system.xp-event", active ? `ON x${mult} for ${minutes}m` : "OFF");
			return json(res, 200, { ok: true, xpEvent: evt });
		}

		// ---------- API KEYS ----------
		if (req.method === "GET" && pathname === "/api/keys") {
			return json(res, 200, { keys: panelDb.prepare("SELECT id, name, prefix, revoked, created_at, last_used_at FROM api_keys ORDER BY id DESC").all() });
		}
		if (req.method === "POST" && pathname === "/api/keys") {
			const body = await readBody(req);
			const name = String(body.name || "").trim().slice(0, 60);
			if (!name) return json(res, 400, { error: "Key name required." });
			const raw = "cpo_" + randomBytes(24).toString("hex");
			const hash = createHash("sha256").update(raw).digest("hex");
			panelDb.prepare("INSERT INTO api_keys (name, key_hash, prefix) VALUES (?, ?, ?)").run(name, hash, raw.slice(0, 12) + "…");
			audit("api.key.create", name);
			return json(res, 200, { ok: true, key: raw });
		}
		if (req.method === "POST" && pathname === "/api/keys/revoke") {
			const body = await readBody(req);
			panelDb.prepare("UPDATE api_keys SET revoked = 1 WHERE id = ?").run(body.id);
			audit("api.key.revoke", `#${body.id}`);
			return json(res, 200, { ok: true });
		}
		if (req.method === "GET" && pathname === "/api/keys/validate") {
			const hash = createHash("sha256").update(String(q.key || "")).digest("hex");
			const row = panelDb.prepare("SELECT id, name FROM api_keys WHERE key_hash = ? AND revoked = 0").get(hash);
			if (row) panelDb.prepare("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
			return json(res, 200, { valid: !!row, name: row?.name || null });
		}

		// ---------- COMMS: BROADCAST / NOTIFY / CHAT CONTROLS ----------
		if (req.method === "POST" && pathname === "/api/comms/broadcast") {
			const body = await readBody(req);
			const message = String(body.message || "").slice(0, 300);
			if (!message) return json(res, 400, { error: "Message required." });
			await bridge("/api/panel/announce", { message });
			audit("comms.broadcast", message);
			return json(res, 200, { ok: true });
		}
		if (req.method === "POST" && pathname === "/api/comms/notify") {
			const body = await readBody(req);
			const out = await bridge("/api/panel/notify", { username: body.username, message: body.message });
			audit("comms.notify", `@${body.username}: ${String(body.message || "").slice(0, 80)}`);
			if (out.error) return json(res, 400, out);
			return json(res, 200, { ok: true, delivered: !!out.delivered });
		}
		if (req.method === "GET" && pathname === "/api/comms/chat") {
			return json(res, 200, { chat: readDataFile("chat-config.json") });
		}
		if (req.method === "POST" && pathname === "/api/comms/chat") {
			const body = await readBody(req);
			const chat = {
				freeze: !!body.freeze,
				slowmodeSeconds: Math.max(0, Math.min(300, parseInt(body.slowmodeSeconds, 10) || 0)),
				filterEnabled: !!body.filterEnabled,
				filterWords: Array.isArray(body.filterWords) ? body.filterWords.map((w) => String(w).trim()).filter(Boolean).slice(0, 500) : []
			};
			writeDataFile("chat-config.json", chat);
			audit("comms.chat-config", `freeze=${chat.freeze} slow=${chat.slowmodeSeconds}s filter=${chat.filterEnabled ? chat.filterWords.length + " words" : "off"}`);
			return json(res, 200, { ok: true, chat });
		}
		if (req.method === "POST" && pathname === "/api/comms/alerts") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.alerts = {
				enabled: !!body.enabled,
				webhookUrl: String(body.webhookUrl || "").slice(0, 500),
				events: Array.isArray(body.events) ? body.events.map(String).slice(0, 20) : cfg.alerts.events
			};
			saveConfig(cfg);
			audit("comms.alerts", `${cfg.alerts.enabled ? "ON" : "OFF"} ${cfg.alerts.webhookUrl ? "webhook set" : "no webhook"}`);
			return json(res, 200, { ok: true, alerts: cfg.alerts });
		}
		if (req.method === "POST" && pathname === "/api/comms/alerts/test") {
			const cfg = loadConfig();
			if (!cfg.alerts.webhookUrl) return json(res, 400, { error: "No webhook URL configured." });
			try {
				await fetch(cfg.alerts.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "🧪 Clash Proxy test alert" }), signal: AbortSignal.timeout(4000) });
				return json(res, 200, { ok: true });
			} catch (e) {
				return json(res, 502, { error: "Webhook failed: " + e.message });
			}
		}
		if (req.method === "GET" && pathname === "/api/comms/parties") {
			const stats = await bridge("/api/panel/stats", null);
			return json(res, 200, { online: stats.presence?.online ?? 0, rooms: stats.presence?.rooms ?? [], users: stats.presence?.users ?? [] });
		}

		// ---------- COMMS: EMOJI / MOTD / STAFF NOTES ----------
		if (req.method === "GET" && pathname === "/api/comms/emoji") {
			return json(res, 200, { emoji: loadConfig().emoji });
		}
		if (req.method === "POST" && pathname === "/api/comms/emoji") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.emoji = Array.isArray(body.emoji) ? body.emoji.slice(0, 200).map((e) => ({ code: String(e.code || "").slice(0, 32), value: String(e.value || "").slice(0, 16) })) : cfg.emoji;
			saveConfig(cfg);
			audit("comms.emoji", `${cfg.emoji.length} emoji`);
			return json(res, 200, { ok: true, emoji: cfg.emoji });
		}
		if (req.method === "GET" && pathname === "/api/comms/motd") {
			return json(res, 200, { motd: loadConfig().motd });
		}
		if (req.method === "POST" && pathname === "/api/comms/motd") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.motd = String(body.motd || "").slice(0, 300);
			saveConfig(cfg);
			audit("comms.motd", cfg.motd);
			return json(res, 200, { ok: true, motd: cfg.motd });
		}
		if (req.method === "GET" && pathname === "/api/staff-notes") {
			return json(res, 200, { notes: panelDb.prepare("SELECT * FROM staff_notes ORDER BY id DESC LIMIT 100").all() });
		}
		if (req.method === "POST" && pathname === "/api/staff-notes") {
			const body = await readBody(req);
			const title = String(body.title || "").trim().slice(0, 80);
			if (!title) return json(res, 400, { error: "Title required." });
			panelDb.prepare("INSERT INTO staff_notes (title, body) VALUES (?, ?)").run(title, String(body.body || "").slice(0, 2000));
			audit("comms.staff-note", title);
			return json(res, 200, { ok: true });
		}
		if (req.method === "POST" && pathname === "/api/staff-notes/delete") {
			const body = await readBody(req);
			panelDb.prepare("DELETE FROM staff_notes WHERE id = ?").run(body.id);
			audit("comms.staff-note.delete", `#${body.id}`);
			return json(res, 200, { ok: true });
		}

		// ---------- GAMES: LIVE ACTIVITY + OPS CONFIG + SIM ----------
		if (req.method === "GET" && pathname === "/api/games/activity") {
			const rows = db.prepare(`
				SELECT json_extract(data_json, '$.gameTitle') AS title, user_id, created_at
				FROM activity_log
				WHERE type = 'game_play' AND created_at >= datetime('now', '-60 minutes')
				ORDER BY created_at DESC LIMIT 200
			`).all();
			const byGame = {};
			for (const r of rows) {
				const g = byGame[r.title] ||= { title: r.title, players: [] };
				g.players.push({ userId: r.user_id, at: r.created_at });
			}
			return json(res, 200, { sessions: Object.values(byGame).sort((a, b) => b.players.length - a.players.length) });
		}
		if (req.method === "GET" && pathname === "/api/games/ops") {
			const cfg = loadConfig();
			return json(res, 200, { mapRotation: cfg.mapRotation, slotCaps: cfg.slotCaps, sim: cfg.sim });
		}
		if (req.method === "POST" && pathname === "/api/games/ops") {
			const body = await readBody(req);
			const cfg = loadConfig();
			if (body.mapRotation && typeof body.mapRotation === "object") cfg.mapRotation = body.mapRotation;
			if (body.slotCaps && typeof body.slotCaps === "object") {
				cfg.slotCaps = {};
				for (const [k, v] of Object.entries(body.slotCaps)) cfg.slotCaps[String(k).slice(0, 40)] = Math.max(1, Math.min(64, parseInt(v, 10) || 8));
			}
			saveConfig(cfg);
			audit("games.ops", "map rotation / slot caps updated");
			return json(res, 200, { ok: true, mapRotation: cfg.mapRotation, slotCaps: cfg.slotCaps });
		}
		if (req.method === "POST" && pathname === "/api/games/sim") {
			const body = await readBody(req);
			const cfg = loadConfig();
			const sim = cfg.sim || { instances: [], matches: [] };
			const action = String(body.action || "");
			if (action === "spawn") {
				const id = "srv-" + randomBytes(3).toString("hex");
				sim.instances.push({ id, game: String(body.game || "Arcade").slice(0, 40), region: String(body.region || "auto").slice(0, 20), players: 0, status: "running", createdAt: Date.now() });
				if (body.match) {
					sim.matches.push({ id: "m-" + randomBytes(3).toString("hex"), instanceId: id, game: String(body.game || "Arcade").slice(0, 40), state: "queued", tick: 60, ping: 12 + Math.round(Math.random() * 30), loss: +(Math.random() * 2).toFixed(1), players: [] });
				}
			} else if (action === "kill") {
				sim.instances = sim.instances.filter((i) => i.id !== body.id);
				sim.matches = sim.matches.filter((m) => m.instanceId !== body.id);
			} else if (action === "queue-start") {
				const m = sim.matches.find((x) => x.id === body.matchId);
				if (m) { m.state = "live"; m.startedAt = Date.now(); }
			} else if (action === "force-end") {
				const m = sim.matches.find((x) => x.id === body.matchId);
				if (m) { m.state = body.result === "reset" ? "reset" : "draw"; m.endedAt = Date.now(); }
				sim.matches = sim.matches.filter((x) => x.state === "live" || x.state === "queued" || Date.now() - (x.endedAt || 0) < 60_000);
			} else if (action === "tick") {
				// telemetry refresh — jitter numbers for live matches
				for (const m of sim.matches) {
					if (m.state === "live") {
						m.tick = 58 + Math.round(Math.random() * 4);
						m.ping = Math.max(4, (m.ping || 20) + Math.round((Math.random() - 0.5) * 8));
						m.loss = Math.max(0, +((m.loss || 0) + (Math.random() - 0.5) * 0.6).toFixed(1));
					}
				}
			}
			cfg.sim = sim;
			saveConfig(cfg);
			if (action !== "tick") audit("games.sim", `${action} ${body.id || body.matchId || body.game || ""}`.trim());
			return json(res, 200, { ok: true, sim: cfg.sim });
		}

		// ---------- ANALYTICS ----------
		if (req.method === "GET" && pathname === "/api/analytics/overview") {
			const stats = await bridge("/api/panel/stats", null);
			const registrations = {
				today: db.prepare("SELECT COUNT(*) c FROM users WHERE DATE(created_at) = DATE('now')").get().c,
				week: db.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now', '-7 days')").get().c,
				total: db.prepare("SELECT COUNT(*) c FROM users").get().c
			};
			const games = db.prepare(`
				SELECT json_extract(data_json, '$.gameTitle') AS title, COUNT(*) AS plays, COUNT(DISTINCT user_id) AS players
				FROM activity_log WHERE type = 'game_play' AND created_at >= datetime('now', '-30 days')
				GROUP BY title ORDER BY plays DESC LIMIT 20
			`).all();
			const activity = {
				eventsToday: db.prepare("SELECT COUNT(*) c FROM activity_log WHERE DATE(created_at) = DATE('now')").get().c,
				activeUsers7d: db.prepare("SELECT COUNT(DISTINCT user_id) c FROM activity_log WHERE created_at >= datetime('now', '-7 days')").get().c
			};
			let errorCount = 0;
			try {
				const lines = fs.readFileSync(path.join(DATA_DIR, "server.log"), "utf8").split("\n");
				errorCount = lines.filter((l) => l.includes(" ERROR ")).length;
			} catch {}
			return json(res, 200, {
				online: stats.presence?.online ?? 0,
				history: stats.presence?.history ?? [],
				registrations,
				games,
				activity,
				errorCount,
				reportsOpen: panelDb.prepare("SELECT COUNT(*) c FROM reports WHERE status = 'open'").get().c,
				punishments30d: panelDb.prepare("SELECT COUNT(*) c FROM punishments WHERE created_at >= datetime('now', '-30 days')").get().c
			});
		}
		if (req.method === "GET" && pathname === "/api/analytics/audit") {
			return json(res, 200, { entries: panelDb.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200").all() });
		}
		if (req.method === "POST" && pathname === "/api/analytics/economy") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.economy = {
				rankPointsPerXp: Math.max(0, Number(body.rankPointsPerXp) || cfg.economy.rankPointsPerXp),
				tokenCostBadge: Math.max(0, Number(body.tokenCostBadge) || cfg.economy.tokenCostBadge),
				conversionRate: Math.max(0, Number(body.conversionRate) || cfg.economy.conversionRate)
			};
			saveConfig(cfg);
			audit("analytics.economy", JSON.stringify(cfg.economy));
			return json(res, 200, { ok: true, economy: cfg.economy });
		}
		if (req.method === "POST" && pathname === "/api/analytics/defaults") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.defaults = {
				theme: ["dark", "light", "terminal"].includes(body.theme) ? body.theme : cfg.defaults.theme,
				sound: Math.max(0, Math.min(1, Number(body.sound))),
				graphics: ["low", "medium", "high", "auto"].includes(body.graphics) ? body.graphics : cfg.defaults.graphics
			};
			saveConfig(cfg);
			audit("analytics.defaults", JSON.stringify(cfg.defaults));
			return json(res, 200, { ok: true, defaults: cfg.defaults });
		}
		if (req.method === "POST" && pathname === "/api/analytics/theme") {
			const body = await readBody(req);
			const cfg = loadConfig();
			cfg.siteTheme = ["dark", "light", "terminal"].includes(body.theme) ? body.theme : "dark";
			saveConfig(cfg);
			audit("analytics.theme", cfg.siteTheme);
			return json(res, 200, { ok: true, siteTheme: cfg.siteTheme });
		}

		// ---------- JARVIS AI ----------
		if (req.method === "GET" && pathname === "/api/jarvis/info") {
			const key = loadJarvisKey();
			let keyValid = null;
			if (key) keyValid = (await validateOpenRouterKey(key)).valid;
			return json(res, 200, {
				ok: true,
				keySet: !!key,
				keyValid,
				keyPreview: key ? key.slice(0, 6) + "\u2026" + key.slice(-4) : null,
				backends: "OpenRouter free models (cost: $0) \u2192 Pollinations (keyless) \u2192 Gemini \u2192 HuggingFace \u2192 Kobold",
				knownGames: KNOWN_GAMES.length,
				testerAccounts: testerUsernames().size,
				testerReports: gameTesterReports().length,
				openReports: openReports().length
			});
		}
		if (req.method === "POST" && pathname === "/api/jarvis/key") {
			const body = await readBody(req);
			const key = String(body.key || "").trim();
			if (!key) return json(res, 400, { error: "key required" });
			if (key.length < 10 || key.length > 300) return json(res, 400, { error: "key looks invalid" });
			saveJarvisKey(key);
			audit("jarvis.key", "OpenRouter key updated (" + key.slice(0, 4) + "\u2026)");
			// Live probe so the owner knows immediately if the key works.
			const probe = await validateOpenRouterKey(key);
			return json(res, 200, {
				ok: true,
				keyPreview: key.slice(0, 6) + "\u2026" + key.slice(-4),
				probeValid: !!probe.valid,
				probeDetail: probe.detail
			});
		}
		if (req.method === "POST" && pathname === "/api/jarvis/chat") {
			const body = await readBody(req);
			const history = (Array.isArray(body.messages) ? body.messages : [])
				.map((m) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: String(m?.content || "").slice(0, 4000).trim() }))
				.filter((m) => m.content)
				.slice(-12);
			const last = history.filter((m) => m.role === "user").pop()?.content;
			if (!last) return json(res, 400, { error: "message required" });
			sweepExpired();

			// 1) Deterministic command engine (real actions, works keyless)
			const cmd = await jarvisCommand(last);
			if (cmd) return json(res, 200, { reply: cmd.reply, source: "command" });

			// 2) Free-model LLM chat with live context
			await cachedMainGames(); // warm context so answers reflect the real library
			const llm = await askAIReply([{ role: "system", content: jarvisSystemPrompt() }, ...history.slice(-8)],
				{ openrouterKey: loadJarvisKey() });
			if (llm) return json(res, 200, { reply: llm, source: "llm" });

			// 3) Local conversational fallback
			return json(res, 200, { reply: jarvisLocalFallback(last), source: "local" });
		}

		json(res, 404, { error: "Not found" });
	} catch (e) {
		json(res, 500, { error: e.message || "Server error" });
	}
});

// ============================================================
// JARVIS AI — owner-panel assistant with FULL control over Clash
// Proxy (panel + website). Chat-only Clash AI lives on the main
// site and has no powers; this is the one that acts.
//
// Flow: deterministic command engine first (works with no key)
// → free-model LLM (OpenRouter free models / Gemini / HF / Kobold)
// → local conversational fallback.
// ============================================================
const JARVIS_KEY_PATH = path.join(__dirname, "jarvis-key.txt");
const GAMES_DIR = path.join(ROOT, "games");
const GAME_BACKUP_DIR = path.join(BACKUP_DIR, "game-backups");

// Seed the OpenRouter key from the existing Games loader install.
// Only free models are ever used — zero cost.
try {
	if (!fs.existsSync(JARVIS_KEY_PATH)) {
		const seed = path.join("C:", "MainFiles", "Coding", "Games loader", "api-key.txt");
		if (fs.existsSync(seed)) {
			const raw = fs.readFileSync(seed, "utf8").trim();
			if (raw) fs.writeFileSync(JARVIS_KEY_PATH, raw.startsWith("[ENC]") ? raw : "[ENC]" + Buffer.from(raw, "utf8").toString("base64"));
		}
	}
} catch {}

function loadJarvisKey() {
	try {
		const raw = fs.readFileSync(JARVIS_KEY_PATH, "utf8").trim();
		if (raw.startsWith("[ENC]")) return Buffer.from(raw.slice(5), "base64").toString("utf8");
		return raw;
	} catch { return ""; }
}
function saveJarvisKey(key) {
	fs.writeFileSync(JARVIS_KEY_PATH, "[ENC]" + Buffer.from(String(key).trim(), "utf8").toString("base64"));
}

const KNOWN_GAMES = [
	{ title: "Slope", url: "https://slope-game.com" }, { title: "Run 3", url: "https://run-3.io" },
	{ title: "1v1.LOL", url: "https://1v1.lol" }, { title: "Shell Shockers", url: "https://shellshock.io" },
	{ title: "Among Us Online", url: "https://among.us" }, { title: "Papa's Pizzeria", url: "https://papaspizzeria.com" },
	{ title: "Temple Run", url: "https://templerun.com" }, { title: "Subway Surfers", url: "https://subwaysurfers.com" },
	{ title: "Retro Bowl", url: "https://retrobowl.me" }, { title: "Moto X3M", url: "https://motox3m.com" },
	{ title: "Fireboy and Watergirl", url: "https://fireboywatergirl.com" }, { title: "Geometry Dash", url: "https://geometry-dash.io" },
	{ title: "Drift Boss", url: "https://driftboss.io" }, { title: "Crossy Road", url: "https://crossyroad.com" },
	{ title: "Happy Wheels", url: "https://happywheels.com" }, { title: "Basketball Stars", url: "https://basketballstars.io" },
	{ title: "Bottle Flip", url: "https://bottleflip.com" }, { title: "Doodle Jump", url: "https://doodlejump.io" },
	{ title: "Cookie Clicker", url: "https://cookieclicker.com" }, { title: "Cut the Rope", url: "https://cuttherope.net" },
	{ title: "World's Hardest Game", url: "https://worldshardestgame.com" }, { title: "Snake", url: "https://snake.io" },
	{ title: "Agar.io", url: "https://agar.io" }, { title: "Slither.io", url: "https://slither.io" },
	{ title: "Diep.io", url: "https://diep.io" }, { title: "2048", url: "https://2048game.com" },
	{ title: "Flappy Bird", url: "https://flappybird.io" }, { title: "Color Switch", url: "https://colorswitch.com" },
	{ title: "Stack", url: "https://stackgame.io" }, { title: "Helix Jump", url: "https://helixjump.io" }
];

function gameSlug(title) {
	return "cl" + String(title).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 44);
}
function safeTitle(t) {
	return String(t || "Game").replace(/[<>&"']/g, "").slice(0, 80);
}
// Wrapper that plays the game through the site's own scramjet proxy,
// so framing-blocked sources still work (same pattern app.js uses).
function gameWrapperHtml(title, targetUrl) {
	const proxied = "/scram/service/" + encodeURIComponent(targetUrl);
	return "<!DOCTYPE html>\n" +
		'<html lang="en"><head><meta charset="utf-8" />\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
		"<title>" + safeTitle(title) + " — Clash Proxy</title>\n" +
		"<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block;background:#000}</style>\n" +
		"</head><body>" +
		'<iframe src="' + proxied + '" allow="autoplay; fullscreen; gamepad; clipboard-write" allowfullscreen referrerpolicy="no-referrer"></iframe>' +
		"\n</body></html>\n";
}
function gamePlaceholderHtml(title) {
	return "<!DOCTYPE html>\n" +
		'<html lang="en"><head><meta charset="utf-8" /><title>' + safeTitle(title) + " — Clash Proxy</title>\n" +
		"<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#fff;font-family:Inter,Arial,sans-serif;text-align:center}a{color:#a29bfe}</style>\n" +
		"</head><body><div><h1 style=\"font-size:28px;margin-bottom:8px\">" + safeTitle(title) + '</h1>' +
		"<p style=\"opacity:.65\">This game is being rebuilt by Jarvis. Check back soon.</p></div></body></html>\n";
}

async function listMainGames() {
	const g = await bridge("/api/games");
	return Array.isArray(g) ? g : [];
}
let _gamesCache = { at: 0, list: [] };
async function cachedMainGames() {
	if (Date.now() - _gamesCache.at < 60000 && _gamesCache.list.length) return _gamesCache.list;
	_gamesCache = { at: Date.now(), list: await listMainGames() };
	return _gamesCache.list;
}
async function reloadGameCache() {
	const r = await bridge("/api/panel/games/reload", {});
	_gamesCache = { at: 0, list: [] };
	return r;
}

async function findGameFile(query) {
	let q = String(query || "").trim().toLowerCase().replace(/^(the\s+)?game\s+/, "").replace(/^["']|["']$/g, "");
	if (!q || q.length > 80) return null;
	const games = await cachedMainGames();
	let hit = games.find((g) => g.filename.toLowerCase() === q || g.filename.toLowerCase() === gameSlug(q) + ".html");
	if (!hit) hit = games.find((g) => g.title.toLowerCase() === q);
	if (!hit && q.length >= 3) hit = games.find((g) => g.title.toLowerCase().includes(q));
	if (hit) return { filename: hit.filename, title: hit.title };
	const fq = q.replace(/[^\w.-]/g, "");
	if (fq) {
		try {
			const files = fs.readdirSync(GAMES_DIR).filter((f) => f.endsWith(".html"));
			const f = files.find((x) => x.toLowerCase().includes(fq)) ||
				files.find((x) => gameSlug(x).includes(fq.replace(/[^\w]/g, "")));
			if (f) return { filename: f, title: f.replace(/^cl/, "").replace(/\.html$/, "") };
		} catch {}
	}
	return null;
}
function assertSafeGameFile(filename) {
	return typeof filename === "string" && filename.endsWith(".html") &&
		!filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}
function backupGameFile(filename) {
	try {
		fs.mkdirSync(GAME_BACKUP_DIR, { recursive: true });
		const dst = path.join(GAME_BACKUP_DIR, `${filename}.${Date.now()}.bak`);
		fs.copyFileSync(path.join(GAMES_DIR, filename), dst);
		return dst;
	} catch { return null; }
}
function diagnoseGameFile(filename) {
	try {
		const full = path.join(GAMES_DIR, filename);
		const size = fs.statSync(full).size;
		const head = fs.readFileSync(full, "utf8").slice(0, 500);
		if (head.includes("Error 404") || head.includes("That\u2019s an error") || head.includes("That's an error"))
			return { broken: true, reason: "dead source (Google 404 stub — the original host is gone)" };
		if (size < 300) return { broken: true, reason: "file is nearly empty (" + size + " bytes)" };
		if (!/<html|<!doctype/i.test(head)) return { broken: true, reason: "missing HTML document structure" };
		return { broken: false, reason: "no obvious issues (" + size + " bytes)" };
	} catch (e) { return { broken: true, reason: "cannot read file: " + e.message }; }
}
function knownGameFor(filename) {
	const slug = filename.replace(/^cl/, "").replace(/\.html$/, "").toLowerCase();
	return KNOWN_GAMES.find((k) => gameSlug(k.title) + ".html" === filename) ||
		KNOWN_GAMES.find((k) => slug.includes(gameSlug(k.title).slice(2)));
}

async function jarvisAddGames(count) {
	count = Math.max(1, Math.min(25, parseInt(count, 10) || 1));
	const games = await cachedMainGames();
	const have = new Set(games.map((g) => g.filename.toLowerCase()));
	const used = new Set(games.map((g) => g.title.toLowerCase()));
	let candidates = KNOWN_GAMES.filter((k) => !have.has(gameSlug(k.title) + ".html") && !used.has(k.title.toLowerCase()));
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}
	const picked = candidates.slice(0, count);
	const added = [];
	for (const g of picked) {
		fs.writeFileSync(path.join(GAMES_DIR, gameSlug(g.title) + ".html"), gameWrapperHtml(g.title, g.url));
		added.push(g.title);
	}
	if (added.length) await reloadGameCache();
	return added;
}
async function jarvisAddCustomGame(title, url) {
	title = safeTitle(title).trim();
	url = String(url || "").trim();
	if (!title || !/^https?:\/\//i.test(url)) return null;
	const file = gameSlug(title) + ".html";
	if (fs.existsSync(path.join(GAMES_DIR, file))) return { title, url, existed: true };
	fs.writeFileSync(path.join(GAMES_DIR, file), gameWrapperHtml(title, url));
	await reloadGameCache();
	return { title, url, existed: false };
}

/* ================= internet game downloader =================
   Pulls the actual game CODE (HTML + JS/CSS/assets) off the internet
   and stores it locally so the game plays from our own server.
   Given no URL, it web-searches DuckDuckGo first. */
const NET_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
};
const GAME_META_PATH = path.join(ROOT, "games-data.js");
const DL = { page: 4 * 1024 * 1024, perAsset: 6 * 1024 * 1024, total: 25 * 1024 * 1024, assets: 60, budget: 45000 };
const RANDOM_GAME_QUERIES = [
	"free html5 game single file direct link",
	"best html5 arcade game play online direct link",
	"fun html5 browser game no download play",
	"html5 platformer game direct link play online",
	"html5 puzzle game play online free",
];
let randomQueryCursor = Math.floor(Date.now() / 60000);
const TRACKER_HOSTS = /(doubleclick|googletagmanager|google-analytics|facebook\.net|hotjar|adservice|adnxs|criteo|scorecardresearch)/i;

async function fetchRes(url, timeoutMs = 15000, maxBytes = DL.page) {
	try {
		const res = await fetch(url, { headers: NET_HEADERS, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
		if (!res.ok) return null;
		const cl = Number(res.headers.get("content-length") || 0);
		if (cl && cl > maxBytes) return null;
		const buf = Buffer.from(await res.arrayBuffer());
		if (!buf.length || buf.length > maxBytes) return null;
		return { buf, contentType: res.headers.get("content-type") || "", finalUrl: res.url || url };
	} catch { return null; }
}

async function jarvisWebSearch(query, limit = 6) {
	try {
		const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
			{ headers: NET_HEADERS, signal: AbortSignal.timeout(15000) });
		if (!res.ok) return [];
		const html = await res.text();
		const out = [];
		for (const mm of html.matchAll(/uddg=([^"&]+)/g)) {
			let u;
			try { u = decodeURIComponent(mm[1]); } catch { continue; }
			if (/^https?:\/\//i.test(u) && !/duckduckgo\.com/i.test(u) && !out.includes(u)) out.push(u);
			if (out.length >= limit) break;
		}
		return out;
	} catch { return []; }
}

function resolveRef(raw, base) {
	const s = String(raw || "").trim();
	if (!s || /^(data|blob|javascript|mailto|tel|about):/i.test(s) || s.startsWith("#")) return null;
	try {
		const u = new URL(s, base);
		if (u.protocol !== "http:" && u.protocol !== "https:") return null;
		u.hash = "";
		return u.href;
	} catch { return null; }
}
function assetFileName(url, contentType, used) {
	let base = "";
	try { base = decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch {}
	base = base.replace(/[^\w.\-]/g, "").slice(0, 60);
	if (!/\.[a-z0-9]{1,6}$/i.test(base)) {
		const extMap = {
			"text/css": ".css", "application/javascript": ".js", "text/javascript": ".js",
			"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
			"image/svg+xml": ".svg", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico",
			"font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf",
			"audio/mpeg": ".mp3", "audio/ogg": ".ogg", "video/mp4": ".mp4", "application/json": ".json",
		};
		const ct = String(contentType || "").split(";")[0].trim();
		base = (base || "asset") + (extMap[ct] || ".bin");
	}
	let name = base, i = 2;
	while (used.has(name.toLowerCase())) {
		name = base.replace(/(\.[a-z0-9]+)$/i, "-" + i + "$1");
		i++;
	}
	used.add(name.toLowerCase());
	return name;
}
function gamesDataRead() {
	const raw = fs.readFileSync(GAME_META_PATH, "utf8");
	const pre = raw.match(/^\s*var\s+CLASH_GAMES\s*=\s*/);
	const arr = JSON.parse(raw.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, "").replace(/;\s*$/, ""));
	return { arr, prefix: pre ? pre[0] : "var CLASH_GAMES = " };
}
function addGameTitleEntry(filename, title) {
	try {
		const { arr, prefix } = gamesDataRead();
		const url = "/games/" + filename;
		if (!arr.some((g) => g && g.url === url)) {
			let maxId = 0;
			for (const g of arr) {
				const mm2 = /^local_(\d+)$/.exec(String(g && g.id || ""));
				if (mm2 && parseInt(mm2[1], 10) > maxId) maxId = parseInt(mm2[1], 10);
			}
			arr.push({ title, url, cat: "Other", id: "local_" + (maxId + 1) });
		}
		fs.writeFileSync(GAME_META_PATH, prefix + JSON.stringify(arr) + ";");
	} catch (e) { console.error("addGameTitleEntry:", e.message); }
}
function removeGameTitleEntry(filename) {
	try {
		const { arr, prefix } = gamesDataRead();
		const url = "/games/" + filename;
		const next = arr.filter((g) => !(g && g.url === url));
		if (next.length !== arr.length) fs.writeFileSync(GAME_META_PATH, prefix + JSON.stringify(next) + ";");
	} catch (e) { console.error("removeGameTitleEntry:", e.message); }
}
function guessTitleFromUrl(url) {
	try {
		const u = new URL(url);
		const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || u.hostname)
			.replace(/\.(html?|php|aspx?)$/i, "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
		return safeTitle(last || u.hostname);
	} catch { return "Downloaded Game"; }
}

async function jarvisDownloadGame(sourceUrl, titleHint, depth = 0) {
	if (!/^https?:\/\//i.test(String(sourceUrl || ""))) return { ok: false, reason: "not an http(s) URL" };
	const page = await fetchRes(sourceUrl, 15000, DL.page);
	if (!page) return { ok: false, reason: "the source page would not download" };
	let html = page.buf.toString("utf8");
	if (!/<html|<!doctype/i.test(html)) return { ok: false, reason: "that URL is not an HTML page" };
	// title: user hint → <title> tag → hostname
	let title = safeTitle(titleHint || "").trim();
	if (!title) {
		const tm = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(html);
		title = safeTitle(tm ? tm[1].replace(/\s+/g, " ").trim() : "");
	}
	if (!title) { try { title = safeTitle(new URL(page.finalUrl).hostname.replace(/^www\./, "")); } catch { title = "Downloaded Game"; } }
	title = title.replace(/\s*[-|–]\s*(itch\.io|newgrounds|kongregate|gamejolt).*$/i, "").trim() || title;
	const filename = gameSlug(title) + ".html";
	const mainPath = path.join(GAMES_DIR, filename);
	if (fs.existsSync(mainPath)) return { ok: false, reason: "exists", title };

	// wrapper pages: < 300KB and a game-ish iframe → follow one level deeper
	if (depth === 0 && html.length < 300000) {
		let base0 = page.finalUrl;
		try {
			const bm = /<base[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html);
			if (bm) base0 = new URL(bm[1], page.finalUrl).href;
		} catch {}
		const ifr = [...html.matchAll(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)]
			.map((x) => resolveRef(x[1], base0))
			.find((u) => u && /game|play|embed|itch|html5|\.html/i.test(u) && !TRACKER_HOSTS.test(u));
		if (ifr) {
			const inner = await jarvisDownloadGame(ifr, title, depth + 1);
			if (inner.ok) return inner;
			if (inner.reason === "exists") return inner;
		}
	}

	// resolve base, capture <base>, strip it (we absolutize everything below)
	let baseHref = page.finalUrl;
	try {
		const bm = /<base[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html);
		if (bm) baseHref = new URL(bm[1], page.finalUrl).href;
	} catch {}
	html = html.replace(/<base\b[^>]*>/gi, "");

	// collect subresource references
	const wanted = new Set();
	let mm2;
	const attrRe = /\b(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']/gi;
	while ((mm2 = attrRe.exec(html))) { const u = resolveRef(mm2[1], baseHref); if (u) wanted.add(u); }
	const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
	while ((mm2 = srcsetRe.exec(html))) {
		for (const part of mm2[1].split(",")) {
			const u = resolveRef(part.trim().split(/\s+/)[0], baseHref);
			if (u) wanted.add(u);
		}
	}
	for (const sm of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
		const u = resolveRef(sm[1], baseHref);
		if (u) wanted.add(u);
	}

	// download assets in small parallel batches
	const started = Date.now();
	const assetsDirName = filename.replace(/\.html$/i, "");
	const assetsDir = path.join(GAMES_DIR, assetsDirName);
	const used = new Set();
	const map = new Map(); // absolute url → relative path from /games/
	let totalBytes = 0, count = 0;
	const queue = [...wanted]
		.filter((u) => u !== page.finalUrl && !TRACKER_HOSTS.test(u))
		.slice(0, DL.assets);
	for (let i = 0; i < queue.length; i += 8) {
		if (Date.now() - started > DL.budget || count >= DL.assets || totalBytes >= DL.total) break;
		await Promise.all(queue.slice(i, i + 8).map(async (u) => {
			if (count >= DL.assets || totalBytes >= DL.total) return;
			const got = await fetchRes(u, 12000, DL.perAsset);
			if (!got) return;
			const ct = got.contentType.toLowerCase();
			if (ct.includes("text/html") || ct.includes("application/xhtml")) return;
			try {
				let buf = got.buf;
				// rewrite url()/@import inside CSS so nested refs load remotely (absolute)
				if (ct.includes("text/css") || /\.css(\?|$)/i.test(u)) {
					let css = buf.toString("utf8");
					css = css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (full, raw) => {
						const abs = resolveRef(raw, u);
						return abs ? `url("${abs}")` : full;
					});
					css = css.replace(/(@import\s+['"])([^'"]+)(['"])/gi, (full, a, raw, c) => {
						const abs = resolveRef(raw, u);
						return abs ? a + abs + c : full;
					});
					buf = Buffer.from(css, "utf8");
				}
				fs.mkdirSync(assetsDir, { recursive: true });
				const name = assetFileName(u, got.contentType, used);
				fs.writeFileSync(path.join(assetsDir, name), buf);
				map.set(u, assetsDirName + "/" + name);
				totalBytes += buf.length;
				count++;
			} catch {}
		}));
	}

	// rewrite references: downloaded → local path, everything else → absolute
	html = html.replace(attrRe, (full, raw) => {
		const abs = resolveRef(raw, baseHref);
		if (!abs) return full;
		const local = map.get(abs);
		return full.replace(raw, local || abs);
	});
	html = html.replace(srcsetRe, (full, val) => {
		if (/data:/i.test(val)) return full;
		const parts = val.split(",").map((p) => {
			const s = p.trim();
			const sp = s.split(/\s+/);
			const abs = resolveRef(sp[0], baseHref);
			if (!abs) return s;
			return (map.get(abs) || abs) + (sp.slice(1).length ? " " + sp.slice(1).join(" ") : "");
		});
		return full.replace(val, parts.join(", "));
	});
	html = html.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (full, raw) => {
		const abs = resolveRef(raw, baseHref);
		if (!abs) return full;
		return `url("${map.get(abs) || abs}")`;
	});
	// strip CSP (would block our local assets) and SRI (fails on rewritten refs)
	html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi, "");
	html = html.replace(/\s+integrity\s*=\s*["'][^"']*["']/gi, "");

	try {
		fs.writeFileSync(mainPath, html);
	} catch (e) {
		return { ok: false, reason: "could not save file: " + e.message };
	}
	return { ok: true, title, filename, assets: count, bytes: Buffer.byteLength(html) + totalBytes, finalUrl: page.finalUrl };
}

async function jarvisAddGameSmart(title, url) {
	const dl = await jarvisDownloadGame(url, title || "");
	if (dl && dl.ok) {
		const id = stageDownloaded(dl.filename, dl.title, url);
		if (id) {
			await reloadGameCache();
			return { mode: "staged", title: dl.title, id, filename: dl.filename, assets: dl.assets, bytes: dl.bytes, host: (() => { try { return new URL(dl.finalUrl || url).hostname; } catch { return url; } })() };
		}
		return { mode: "failed", reason: "could not stage the download for tester approval" };
	}
	if (dl && dl.reason === "exists") return { mode: "existed", title: dl.title };
	const t2 = safeTitle(title || guessTitleFromUrl(url)).trim();
	if (!t2) return { mode: "failed", reason: (dl && dl.reason) || "invalid title/url" };
	const c = await jarvisAddCustomGame(t2, url);
	if (!c) return { mode: "failed", reason: (dl && dl.reason) || "invalid title/url" };
	if (c.existed) return { mode: "existed", title: c.title };
	const id = stageDownloaded(gameSlug(c.title) + ".html", c.title, url);
	if (id) {
		await reloadGameCache();
		return { mode: "staged-embed", title: c.title, id, url, reason: (dl && dl.reason) || "" };
	}
	return { mode: "embed", title: c.title, url, reason: (dl && dl.reason) || "" };
}

async function jarvisAddFromInternet(name) {
	name = String(name || "").trim().replace(/["']/g, "").slice(0, 60);
	const queries = name
		? [`${name} html5 game play online`, `${name} game direct link html5`]
		: [RANDOM_GAME_QUERIES[randomQueryCursor++ % RANDOM_GAME_QUERIES.length]];
	let candidates = [];
	for (const q of queries) {
		candidates = await jarvisWebSearch(q, 6);
		if (candidates.length) break;
	}
	if (!candidates.length) return { mode: "failed", reason: "web search returned nothing — give me a direct URL" };
	const reasons = [];
	for (const url of candidates.slice(0, 4)) {
		const r = await jarvisAddGameSmart(name, url);
		if (["staged", "staged-embed", "downloaded", "existed"].includes(r.mode)) return r;
		if (r.reason) reasons.push(r.reason);
	}
	// nothing downloadable → live embed of the best search hit
	const c = await jarvisAddCustomGame(name || guessTitleFromUrl(candidates[0]), candidates[0]);
	if (c && !c.existed) {
		const id = stageDownloaded(gameSlug(c.title) + ".html", c.title, candidates[0]);
		if (id) {
			await reloadGameCache();
			return { mode: "staged-embed", title: c.title, id, url: candidates[0], reason: reasons[0] || "" };
		}
	}
	if (c && c.existed) return { mode: "existed", title: c.title };
	return { mode: "failed", reason: reasons[0] || "all candidate sources failed" };
}

function jarvisAddReply(r) {
	if (r.mode === "staged") return `Pulled the code for "${r.title}"${r.host ? ` from ${r.host}` : ""}` +
		(r.assets ? ` — ${r.assets} asset file${r.assets > 1 ? "s" : ""}, ${Math.max(1, Math.round(r.bytes / 1024))} KB` : "") +
		`. Staged in the tester queue — it goes live when a Game Tester approves it.`;
	if (r.mode === "staged-embed") return `"${r.title}" — couldn't pull that code${r.reason ? ` (${r.reason})` : ""}, so I staged a live proxied embed of ${r.url} in the tester queue for approval.`;
	if (r.mode === "downloaded") return `Pulled the code for "${r.title}" from ${r.host} and saved it locally` +
		(r.assets ? ` — ${r.assets} asset file${r.assets > 1 ? "s" : ""}, ${Math.max(1, Math.round(r.bytes / 1024))} KB (${r.filename})` : ` (${r.filename})`) +
		". It now plays straight from our own server.";
	if (r.mode === "embed") return `"${r.title}" — couldn't pull that code${r.reason ? ` (${r.reason})` : ""}, so I added it as a live proxied embed of ${r.url} instead.`;
	if (r.mode === "existed") return `"${r.title}" is already in the library.`;
	return `Couldn't add that game: ${r.reason || "unknown error"}. Give me a URL, e.g. \`add game "Cool Game" https://example.com/play\`.`;
}

async function jarvisRemoveGame(query) {
	const hit = await findGameFile(query);
	if (!hit || !assertSafeGameFile(hit.filename)) return null;
	backupGameFile(hit.filename);
	fs.unlinkSync(path.join(GAMES_DIR, hit.filename));
	// downloaded games keep their assets in games/<slug>/ — clean those too
	try {
		const dir = path.join(GAMES_DIR, hit.filename.replace(/\.html$/i, ""));
		if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) fs.rmSync(dir, { recursive: true, force: true });
	} catch {}
	removeGameTitleEntry(hit.filename);
	await reloadGameCache();
	return hit;
}
async function jarvisReplaceGame(query, url) {
	const hit = await findGameFile(query);
	if (!hit || !assertSafeGameFile(hit.filename)) return null;
	backupGameFile(hit.filename);
	if (url && !/^https?:\/\//i.test(url)) return null;
	fs.writeFileSync(path.join(GAMES_DIR, hit.filename),
		url ? gameWrapperHtml(hit.title, url) : gamePlaceholderHtml(hit.title));
	await reloadGameCache();
	return hit;
}
async function jarvisFixGame(query, reportText) {
	const hit = await findGameFile(query);
	if (!hit || !assertSafeGameFile(hit.filename)) return { hit: null };
	const diag = diagnoseGameFile(hit.filename);
	if (!diag.broken) return { hit, status: "ok", diag };
	// Known source still live → swap the dead file for a proxied embed of it.
	const known = knownGameFor(hit.filename);
	if (known) {
		backupGameFile(hit.filename);
		fs.writeFileSync(path.join(GAMES_DIR, hit.filename), gameWrapperHtml(known.title, known.url));
		await reloadGameCache();
		return { hit, status: "replaced", diag, source: known.url };
	}
	// Otherwise try the LLM to repair a real (non-404) file.
	let content = null;
	try { content = fs.readFileSync(path.join(GAMES_DIR, hit.filename), "utf8"); } catch {}
	const isStub = diag.reason.includes("404");
	if (!isStub && content && content.length <= 60000) {
		const patched = await askAIReply([
			{ role: "system", content: "You are a game file repair engine. Return ONLY the complete, fixed HTML file content. No explanations, no markdown fences, no comments about what you changed." },
			{ role: "user", content: `Fix this broken game file.\nFilename: ${hit.filename}\nTitle: ${hit.title}\nProblem: ${diag.reason}\nReported issue: ${reportText || "none"}\n--- FILE ---\n${content.slice(0, 30000)}` }
		], { openrouterKey: loadJarvisKey() });
		if (patched) {
			const clean = String(patched).replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
			if (clean.length > 80 && /<html|<!doctype/i.test(clean)) {
				backupGameFile(hit.filename);
				fs.writeFileSync(path.join(GAMES_DIR, hit.filename), clean);
				await reloadGameCache();
				return { hit, status: "fixed", diag };
			}
		}
	}
	return { hit, status: "unfixable", diag };
}

/* ---------- game tester reports ---------- */
function testerUsernames() {
	const names = new Set();
	try {
		const store = loadStore();
		const testerPresetIds = new Set(
			(store.presets || []).filter((p) => /tester/i.test(String(p.name || ""))).map((p) => String(p.id))
		);
		for (const [uid, a] of Object.entries(store.assignments || {})) {
			const viaName = /tester/i.test(String(a?.rankName || a?.rank || ""));
			const viaPreset = a?.presetId != null && a?.presetId !== "" && testerPresetIds.has(String(a.presetId));
			if (viaName || viaPreset) {
				const u = db.prepare("SELECT username FROM users WHERE id = ?").get(Number(uid));
				if (u) names.add(String(u.username).toLowerCase());
			}
		}
	} catch {}
	return names;
}
function openReports() {
	try { return panelDb.prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC").all(); }
	catch { return []; }
}
function gameTesterReports() {
	const testers = testerUsernames();
	return openReports().filter((r) =>
		testers.has(String(r.reporter_username || "").toLowerCase()) ||
		/\bgame\b/i.test(String(r.details || "")) ||
		/\bgame\b/i.test(String(r.category || ""))
	);
}
function relatedReport(hit) {
	if (!hit || !hit.filename) return null;
	const testers = testerUsernames();
	const nameBits = [
		hit.filename.replace(/^cl/, "").replace(/\.html$/, "").toLowerCase(),
		String(hit.title || "").toLowerCase()
	].filter((b) => b.length >= 4);
	return openReports().find((r) =>
		testers.has(String(r.reporter_username || "").toLowerCase()) &&
		nameBits.some((b) => String(r.details || "").toLowerCase().includes(b))
	) || null;
}

/* ---------- misc live context ---------- */
function jarvisLiveContext() {
	try {
		const users = db.prepare("SELECT COUNT(*) c FROM users").get().c;
		const banned = db.prepare("SELECT COUNT(*) c FROM users WHERE banned = 1").get().c;
		const acl = readDataFile("access-control.json");
		return [
			"- players: " + users + " total, " + banned + " banned",
			"- open reports: " + openReports().length + " (game-tester reports: " + gameTesterReports().length + ")",
			"- maintenance: " + (acl.maintenance ? "ON" : "OFF") + ", whitelist: " + (acl.whitelistEnabled ? "ON" : "OFF"),
			"- game library: " + (_gamesCache.list.length || "unknown until first scan") + " games in last scan",
			"- now: " + new Date().toISOString()
		].join("\n");
	} catch { return "- context unavailable"; }
}

const JARVIS_HELP =
	"JARVIS — owner-panel AI with FULL control of Clash Proxy.\n\n" +
	"Moderation:\n" +
	"  ban @user [10m|1h|1d|permanent] [reason]   ·  unban @user\n" +
	"  timeout @user [duration]   ·  stop timeout @user   ·  kick @user\n\n" +
	"Games:\n" +
	"  add a new game | add game <name> — search the internet & pull the game CODE\n" +
	'  add game "My Title" <url>      — downloads that URL’s code & assets to our server\n' +
	'  embed game "My Title" <url>    — quick proxied embed, no download\n' +
	"  add 5 games                    — add games from the built-in catalog\n" +
	"  scan games                     — refresh the library list\n" +
	"  give @user game testing        — grant Game Tester access (rank chip → testing panel)\n" +
	"  revoke @user game testing      — take it away\n" +
	"  game reports                   — open reports filed by Game Tester-rank staff\n" +
	"  give @user the crown           — make them an OWNER (gold crown + full owner access)\n" +
	"  remove crown @user             — take the crown away again\n" +
	"  fix <game>                     — diagnose & repair (backs up first)\n" +
	"  replace <game> [url]           — swap the file (backup kept)\n" +
	"  remove <game>\n\n" +
	"Site:\n" +
	"  status  ·  online  ·  player <name>\n" +
	"  broadcast <message>  ·  maintenance on|off\n\n" +
	"Anything else = free AI chat. Clash AI on the main site has no powers — you do.";

function parseDuration(text) {
	const t = String(text || "").toLowerCase();
	let m = t.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/); if (m) return parseFloat(m[1]);
	m = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/); if (m) return parseFloat(m[1]) * 60;
	m = t.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)\b/); if (m) return parseFloat(m[1]) * 1440;
	m = t.match(/(\d+(?:\.\d+)?)\s*(?:w|week|weeks)\b/); if (m) return parseFloat(m[1]) * 10080;
	if (/\b(permanent|perma|forever)\b/.test(t)) return 0;
	return null;
}
function cleanReason(rest) {
	return String(rest || "")
		.replace(/\b(for|and|because|due to|a|an)\s+\d+(?:\.\d+)?\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\b/ig, "")
		.replace(/\b(permanent|perma|forever)\b/ig, "")
		.replace(/^\s*(for|because|due to)\s+/i, "")
		.replace(/\s{2,}/g, " ")
		.trim() || "No reason given";
}
const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, some: 3, couple: 2 };

// Deterministic command engine. Returns { reply } when the message
// was a supported command (already executed), else null → LLM path.
async function jarvisCommand(text) {
	const t = String(text || "").trim();
	if (!t) return null;
	const low = t.toLowerCase();

	if (/^(?:jarvis[,\s]+)?help\b/.test(low) || low === "?" || /^what can you do/.test(low)) return { reply: JARVIS_HELP };

	/* ----- moderation ----- */
	let m = t.match(/^\s*(?:jarvis[,\s]+)?unban\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*(.*)$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		const r = await applyPunishment(user, "unban", cleanReason(m[2]), 0);
		return { reply: `Lifted the ban on @${user.username}.` + (r.kicked ? " (session already gone)" : "") };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+)?(?:stop\s+timeout|stop\s+timeout|unmute|untimeout|end\s+timeout)\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*(.*)$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		await applyPunishment(user, "unmute", cleanReason(m[2]), 0);
		return { reply: `Timeout lifted for @${user.username}.` };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+)?ban\s+["']?@?([a-z0-9_.-]{2,32})["']?(.*)$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		const rest = m[2] || "";
		const dur = parseDuration(rest);
		const r = await applyPunishment(user, "ban", cleanReason(rest), dur === null ? 0 : dur);
		const when = r.duration && r.duration !== "permanent" ? ` for ${r.duration}` : " permanently";
		return { reply: `Banned @${user.username}${when}.` + (r.kicked ? " Session kicked." : "") };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+)?(?:timeout|mute)\s+["']?@?([a-z0-9_.-]{2,32})["']?(.*)$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		const rest = m[2] || "";
		const dur = parseDuration(rest);
		const r = await applyPunishment(user, "mute", cleanReason(rest), dur === null ? 60 : dur);
		return { reply: `Timed out @${user.username} for ${r.duration || "1h"}.` };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+)?kick\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*(.*)$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		const r = await applyPunishment(user, "kick", cleanReason(m[2]), 0);
		return { reply: r.kicked ? `Kicked @${user.username}.` : `@${user.username} is not connected right now (kick recorded anyway).` };
	}

	/* ----- rank privileges ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+)?(?:give|grant|allow)\s+["']?@?([a-z0-9_.-]{2,32})["']?\s+(?:the\s+)?game[\s-]*testing\s*$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		const a = grantPrivilege(user.id, "game-testing", true);
		if (!a) return { reply: "Could not update that player's rank." };
		return { reply: `@${user.username} now has the Game Tester privilege — their rank chip opens the testing panel.` };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+)?(?:revoke|remove|take\s+away|take)\s+["']?@?([a-z0-9_.-]{2,32})["']?\s+(?:the\s+)?game[\s-]*testing\s*$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		const a = grantPrivilege(user.id, "game-testing", false);
		if (!a) return { reply: "Could not update that player's rank." };
		return { reply: `Removed the Game Tester privilege from @${user.username}.` };
	}

	/* ----- ranks: the crown (owner role) ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:give|grant)\s+(?:the\s+)?(?:gold\s+)?(?:crown|owner|founder)(?:\s+(?:status|role|rank))?\s+(?:to\s+)?["']?@?([a-z0-9_.-]{2,32})["']?\s*$/i);
	if (!m) m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:give|grant|make)\s+["']?@?([a-z0-9_.-]{2,32})["']?\s+(?:the\s+|an?\s+)?(?:gold\s+)?(?:crown|owner|founder)\b.*$/i);
	if (!m) m = t.match(/^\s*(?:jarvis[,\s]+)?crown\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*$/i);
	if (m) {
		const name = m.length > 2 && m[2] ? m[1] : m[m.length - 1];
		const user = findUser(name);
		if (!user) return { reply: `No player named "${name}" exists.` };
		try {
			db.prepare("UPDATE users SET role = 'admin', custom_tag = COALESCE(NULLIF(TRIM(COALESCE(custom_tag, '')), ''), 'Owner') WHERE id = ?").run(user.id);
		} catch (e) { return { reply: "Database error while granting the crown: " + e.message }; }
		audit("jarvis.crown", `Crown granted to @${user.username}`);
		return { reply: `Crown granted to @${user.username} — they're an owner now: gold crown on their avatar everywhere (like you and ted), full owner access, and the "Owner" tag.` };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:remove|take(?:\s+away)?|revoke|strip)\s+(?:the\s+)?(?:gold\s+)?crown(?:\s+from)?\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*$/i);
	if (!m) m = t.match(/^\s*(?:jarvis[,\s]+)?(?:uncrown|demote)\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return { reply: `No player named "${m[1]}" exists.` };
		try {
			db.prepare("UPDATE users SET role = 'user', custom_tag = NULL WHERE id = ?").run(user.id);
		} catch (e) { return { reply: "Database error while removing the crown: " + e.message }; }
		audit("jarvis.crown", `Crown removed from @${user.username}`);
		return { reply: `Removed the crown from @${user.username} — back to a regular account (no owner access, tag cleared).` };
	}

	/* ----- games: add with explicit URL (pulls the code) ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?add\s+(?:the\s+)?game\s+(?:["'](.+?)["']|(.+?))\s+(https?:\/\/\S+)\s*$/i);
	if (m) {
		const title = (m[1] || m[2] || "").trim();
		return { reply: jarvisAddReply(await jarvisAddGameSmart(title, m[3])) };
	}
	/* ----- games: embed without downloading ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?embed\s+(?:the\s+)?game\s+(?:["'](.+?)["']|(.+?))\s+(https?:\/\/\S+)\s*$/i);
	if (m) {
		const r = await jarvisAddCustomGame((m[1] || m[2] || "").trim(), m[3]);
		if (!r) return { reply: "I need a title and an http(s) URL, e.g. `embed game \"Cool Game\" https://example.com/play`." };
		return { reply: r.existed ? `"${r.title}" already exists in the library.` : `Added "${r.title}" as a live proxied embed of ${m[3]} (no download).` };
	}
	/* ----- games: pull from the internet by name (or pick a random one) ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:please\s+|can\s+you\s+|could\s+you\s+|go\s+ahead\s+and\s+)?(?:add|download|get|fetch|import|grab)(?:\s+(?:me|us))?\s+(?:(?:a|an|the|another|new|random|cool|fun|free|online|browser|html5|some|extra|more|brand|fresh)\s+)*game(?![a-z])([\s\S]*)$/i);
	if (m && !/\b(report|tester|library|catalog|list)\b/i.test(m[1] || "")) {
		let tail = (m[1] || "").trim();
		tail = tail.replace(/^\s*(?:called|named|titled|about|for)\s+/i, "")
			.replace(/^["'](.+)["']$/, "$1")
			.replace(/^[:,\-\s]+/, "")
			.replace(/[.:,]+$/, "")
			.replace(/\?+$/, "")
			.trim();
		const urlM = /\bhttps?:\/\/\S+/.exec(tail);
		if (urlM) {
			const justTitle = tail.replace(urlM[0], "").trim()
				.replace(/^\s*(?:called|named|titled)\s+/i, "").replace(/[.:,\-]+$/, "").trim();
			return { reply: jarvisAddReply(await jarvisAddGameSmart(justTitle, urlM[0])) };
		}
		const name = tail.replace(/^(?:a|an|the)\s+game\s*$/i, "").trim();
		return { reply: jarvisAddReply(await jarvisAddFromInternet(name)) };
	}
	/* ----- games: bulk add ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?add\s+(\d+|[a-z]+)?\s*(?:new\s+)?games?\b/i);
	if (m) {
		const rawN = (m[1] || "3").toLowerCase();
		const n = /^\d+$/.test(rawN) ? parseInt(rawN, 10) : (NUM_WORDS[rawN] || 3);
		const added = await jarvisAddGames(n);
		if (!added.length) return { reply: "The catalog is fully covered — every known game is already in the library." };
		return { reply: `Added ${added.length} game${added.length > 1 ? "s" : ""} to the library:\n• ${added.join("\n• ")}` };
	}
	/* ----- games: scan / refresh list ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:scan|refresh|reload|rescan)\s+(?:the\s+)?games?\s*$/i);
	if (m) {
		await reloadGameCache();
		const list = await cachedMainGames();
		return { reply: `Scanned — the library currently has ${list.length} games.` };
	}
	/* ----- games: remove / replace / fix ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:remove|delete)(?:\s+the)?\s+(?:game\s+)?(.+)$/i);
	if (m && !/remove (me|this|it) from/i.test(m[1])) {
		const hit = await jarvisRemoveGame(m[1]);
		if (!hit) return null;
		return { reply: `Removed "${hit.title}" (${hit.filename}). Backup kept in backups/game-backups/.` };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?replace(?:\s+the)?\s+(?:game\s+)?(.+?)(?:\s+with\s+(https?:\/\/\S+))?\s*$/i);
	if (m) {
		const hit = await jarvisReplaceGame(m[1], m[2]);
		if (!hit) return null;
		return { reply: m[2]
			? `Replaced "${hit.title}" with a proxied embed of ${m[2]} (original backed up).`
			: `Replaced "${hit.title}" with a rebuild placeholder (original backed up).` };
	}
	m = t.match(/^\s*(?:jarvis[,\s]+)?fix(?:\s+the)?\s+(?:game\s+)?(.+)$/i);
	if (m) {
		const target = await findGameFile(m[1]);
		const report = target ? relatedReport(target) : null;
		const r = await jarvisFixGame(m[1], report ? `Filed by ${report.reporter_username}: ${report.details}` : "");
		if (!r.hit) return null;
		if (r.status === "ok") return { reply: `Checked "${r.hit.title}" — ${r.diag.reason}. Nothing to fix.` };
		if (r.status === "replaced") return { reply: `Fixed "${r.hit.title}" — ${r.diag.reason}, so I re-linked it to the live source (${r.source}). Original backed up.` };
		if (r.status === "fixed") return { reply: `Repaired "${r.hit.title}" with AI (${r.diag.reason}). Original backed up — report the result to your Game Tester.` };
		return { reply: `"${r.hit.title}" is broken (${r.diag.reason}) and I have no known source to restore. Use \`replace ${r.hit.filename} <url>\` with a working URL, or \`remove ${r.hit.filename}\`.` };
	}

	/* ----- reports ----- */
	if (/^\s*(?:game\s+)?(?:tester\s+)?reports?\s*$/i.test(t) || /^\s*game\s+tester\s+reports?$/i.test(t)) {
		const testers = testerUsernames();
		const isGameScoped = /game|tester/i.test(t);
		const list = isGameScoped ? gameTesterReports() : openReports();
		if (!list.length) return { reply: isGameScoped
			? "No open game/tester reports right now. " + (testers.size ? `Watching ${testers.size} tester account(s).` : "Tip: assign someone the \"Game Tester\" rank to route their reports here.")
			: "No open reports right now." };
		const lines = list.slice(0, 8).map((r) =>
			`#${r.id} [${r.category}] ${r.reporter_username} → ${r.reported_username}: ${String(r.details || "").slice(0, 120)}`);
		return { reply: `${list.length} open report${list.length > 1 ? "s" : ""}${isGameScoped ? " from game tester staff" : ""}:\n` + lines.join("\n") +
			(list.length > 8 ? `\n…and ${list.length - 8} more.` : "") };
	}

	/* ----- site ops ----- */
	m = t.match(/^\s*(?:jarvis[,\s]+)?(?:broadcast|announce|say)\s+(.+)$/i);
	if (m) {
		const msg = m[1].replace(/^["'](.+)["']$/, "$1").slice(0, 300);
		const r = await bridge("/api/panel/announce", { message: msg });
		if (r._bridgeError || r.error) return { reply: "Broadcast failed: " + (r.error || r._bridgeError) };
		audit("jarvis.broadcast", msg);
		return { reply: "Broadcast sent to everyone online." };
	}
	m = t.match(/^\s*maintenance\s+(on|off|enable|disable)\s*$/i);
	if (m) {
		const on = /^(on|enable)$/i.test(m[1]);
		const acl = mergeAccessControl({ maintenance: on, maintenanceMessage: on ? "Scheduled maintenance — back soon." : "" });
		let kicked = 0;
		if (on) kicked = (await bridge("/api/panel/kick-all", {})).kicked || 0;
		audit("jarvis.maintenance", on ? `ON (kicked ${kicked})` : "OFF");
		return { reply: on
			? `Maintenance ON — non-staff kicked (${kicked}) and visitors see the maintenance page.`
			: "Maintenance OFF — the site is open again." };
	}
	if (/^\s*(?:status|stats|server status|system status)\b/i.test(t)) {
		const stats = await bridge("/api/panel/stats");
		const users = db.prepare("SELECT COUNT(*) c FROM users").get().c;
		const banned = db.prepare("SELECT COUNT(*) c FROM users WHERE banned = 1").get().c;
		const games = await cachedMainGames();
		const acl = readDataFile("access-control.json");
		const online = stats?.presence?.users?.length ?? "?";
		return { reply:
			`Clash Proxy status:\n• online: ${online}\n• players: ${users} total, ${banned} banned\n• games: ${games.length}` +
			`\n• open reports: ${openReports().length} (${gameTesterReports().length} from testers)` +
			`\n• maintenance: ${acl.maintenance ? "ON" : "OFF"} · whitelist: ${acl.whitelistEnabled ? "ON" : "OFF"}` +
			`\n• main server: up ${Math.round(stats?.uptimeSeconds ?? 0)}s (pid ${stats?.pid ?? "?"})` };
	}
	if (/^\s*(?:online|who'?s online|list online)\b/i.test(t)) {
		const stats = await bridge("/api/panel/stats");
		const list = stats?.presence?.users || [];
		if (!list.length) return { reply: "Nobody is connected right now." };
		return { reply: `${list.length} online: ` + list.slice(0, 20).map((u) => "@" + u.username).join(", ") + (list.length > 20 ? "…" : "") };
	}
	m = t.match(/^\s*(?:who\s+is|player|lookup|info(?:\s+on)?|check)\s+["']?@?([a-z0-9_.-]{2,32})["']?\s*$/i);
	if (m) {
		const user = findUser(m[1]);
		if (!user) return null;
		const puns = panelDb.prepare("SELECT type, reason, active, expires_at FROM punishments WHERE user_id = ? ORDER BY id DESC LIMIT 5").all(user.id);
		const reports = panelDb.prepare("SELECT COUNT(*) c FROM reports WHERE reported_id = ? AND status='open'").get(user.id).c;
		const active = [];
		if (user.banned) active.push("BANNED" + (user.banned_until ? " until " + new Date(user.banned_until).toISOString().slice(0, 16).replace("T", " ") : ""));
		if (user.muted) active.push("TIMED OUT" + (user.muted_until ? " until " + new Date(user.muted_until).toISOString().slice(0, 16).replace("T", " ") : ""));
		return { reply:
			`@${user.username} — level ${user.level}, ${user.xp} XP, ${user.coins} coins, role ${user.role}` +
			`\nStatus: ${active.length ? active.join(" · ") : "active"}` +
			`\nOpen reports against them: ${reports}` +
			(puns.length ? `\nRecent punishments:\n` + puns.map((p) => `• ${p.type}${p.active ? " (active)" : ""}: ${p.reason}`).join("\n") : "") };
	}

	return null;
}

function jarvisLocalFallback(text) {
	const t = String(text || "").toLowerCase().trim();
	if (/^(hi|hello|hey|yo|sup|greetings|howdy)\b/.test(t))
		return "Hey — I'm Jarvis, your panel assistant with full control of Clash Proxy. Type `help` for everything I can do (ban, add/fix games, broadcast…), or just ask me anything.";
	if (/how are you|how's it going|how do you feel/.test(t))
		return "Running at full power — the panel is quiet, the site is up, and I'm ready to act. How can I help?";
	if (/thank/.test(t)) return "Anytime, boss.";
	if (/who are you|what are you|your name/.test(t))
		return "I'm Jarvis AI — the owner-panel assistant. I moderate players, manage the game library, broadcast announcements and chat about anything. (Clash AI on the main site is the powerless one.)";
	if (/what can you do|your (job|purpose)|what do you do/.test(t)) return JARVIS_HELP;
	if (/joke/.test(t)) {
		const jokes = [
			"Why did the proxy cross the firewall? To get to the other side of the block list.",
			"I'd tell you a UDP joke, but you might not get it.",
			"Why do programmers prefer dark mode? Because light attracts bugs.",
			"My favorite game? Whack-a-mole — especially the ban button variety."
		];
		return jokes[Math.floor(Math.random() * jokes.length)];
	}
	if (/^(bye|goodbye|see ya|later|cya)\b/.test(t)) return "Later — I'll be right here in the panel if you need me.";
	if (/i love you|you'?re (great|awesome|amazing)/.test(t)) return "Careful, owner — flattery gets you priority in the ban queue. Kidding. Mostly.";
	if (/help/.test(t)) return JARVIS_HELP;
	return "The AI chat backends are unreachable right now, so I can only give canned replies — but my command engine still works: type `help` for ban, games, reports, broadcast, status and more. Try again in a minute for full chat.";
}

function jarvisSystemPrompt() {
	return [
		"You are Jarvis AI, the OWNER-ONLY assistant built into the Clash Proxy Owner Panel. You have FULL control over the Clash Proxy website and panel — this is intentional and owner-sanctioned.",
		"You can moderate players (ban, unban, timeout, kick), manage ranks (grant or remove the owner crown with `give @user the crown` / `remove crown @user` — grants full owner access and the gold crown everywhere), manage the game library (pull new games from the internet with `add game <name>` or `add game \"Title\" <url>` — Jarvis downloads the actual code and assets onto the server — plus remove, fix, replace; `embed game …` skips the download), broadcast announcements, toggle maintenance, and read live stats. When a message matches a supported command, the panel executes it before you see it.",
		"For everything else, answer naturally, concisely and helpfully; you may mention command syntax when useful. Never claim an action was performed unless it actually was. Tone: direct, slightly witty, professional.",
		"The public site assistant 'Clash AI' has NO powers — you are the one with control.\n\nLIVE CONTEXT:\n" + jarvisLiveContext()
	].join("\n\n");
}

server.listen(PORT, HOST, () => {
	console.log("====================================================");
	console.log("  CLASH OWNER PANEL");
	console.log(`  http://localhost:${PORT}/   (owner PC only: ${HOST})`);
	console.log("  Linked main site: http://localhost:8080/");
	console.log("====================================================");
});
