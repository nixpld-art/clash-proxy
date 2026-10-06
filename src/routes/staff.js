import db from "../db.js";
import { extractAuthUser, isPrivilegedUsername, isAdminUser, freshDbUser } from "../auth-utils.js";
import { userRank, hasPrivilege, PRIVILEGES } from "../ranks.js";
import { kickUser, notifyUser } from "../presence.js";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PANEL_DB_PATH = path.join(__dirname, "../../clash owner pannel/panel.db");
const CONFIG_PATH = path.join(__dirname, "../../clash owner pannel/panel-config.json");

let panelDb = null;
try {
	panelDb = new Database(PANEL_DB_PATH);
	panelDb.pragma("journal_mode = WAL");
} catch (e) {
	console.warn("[STAFF] Could not open panel.db:", e.message);
}

function audit(action, detail, staffName = "STAFF") {
	if (!panelDb) return;
	try {
		panelDb.prepare("INSERT INTO audit_log (action, detail) VALUES (?, ?)").run(
			`staff.${action}`,
			`@${staffName}: ${String(detail || "").slice(0, 450)}`
		);
	} catch {}
}

export default async function staffRoutes(fastify, options) {
	// Middleware: require valid logged-in user
	fastify.addHook("preHandler", async (req, reply) => {
		if (req.url.startsWith("/api/staff")) {
			const auth = extractAuthUser(req);
			if (!auth) {
				return reply.code(401).send({ error: "Please sign in to access the Staff Member Panel." });
			}
			const dbUser = freshDbUser(auth.id);
			if (!dbUser) {
				return reply.code(401).send({ error: "User not found." });
			}
			if (dbUser.banned && (!dbUser.banned_until || Date.now() < dbUser.banned_until)) {
				return reply.code(403).send({ error: "Your account is currently suspended.", banned: true });
			}
			req.authUser = { ...auth, role: dbUser.role, username: dbUser.username, custom_tag: dbUser.custom_tag };
		}
	});

	// GET /api/staff/me - Get staff status, active privileges, and permissions
	fastify.get("/api/staff/me", async (req, reply) => {
		const user = req.authUser;
		const r = userRank(user);
		const isOwner = isPrivilegedUsername(user.username);
		const hasStaffRole = user.role === "staff" || user.role === "admin";

		// If user has no rank and is not owner and not staff role, deny
		if (!isOwner && !hasStaffRole && (!r || (!r.rankName && (!r.privileges || r.privileges.length === 0)))) {
			return reply.code(403).send({
				error: "Access Denied: You do not have an active Staff rank assigned.",
				hasAccess: false
			});
		}

		const fullUser = db.prepare("SELECT id, username, display_name, role, custom_tag, settings_json FROM users WHERE id = ?").get(user.id);
		let settings = {};
		try { settings = JSON.parse(fullUser?.settings_json || "{}"); } catch {}

		return {
			success: true,
			hasAccess: true,
			isOwner,
			rankName: r.rankName || (isOwner ? "Owner" : "Staff Member"),
			privileges: r.privileges,
			allPrivileges: PRIVILEGES,
			user: {
				id: fullUser.id,
				username: fullUser.username,
				displayName: fullUser.display_name,
				customTag: fullUser.custom_tag,
				nameGlow: !!settings.staffNameGlow
			}
		};
	});

	// POST /api/staff/kick - Disconnect disruptive user (Requires: mod-kick)
	fastify.post("/api/staff/kick", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-kick")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-kick' privilege." });
		}
		const { targetUsername, reason = "Kicked by staff member" } = req.body || {};
		if (!targetUsername) return reply.code(400).send({ error: "Target username is required." });

		const target = db.prepare("SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?)").get(String(targetUsername).trim());
		if (!target) return reply.code(404).send({ error: "Player not found." });
		if (isPrivilegedUsername(target.username)) {
			return reply.code(403).send({ error: "Cannot kick an Owner account." });
		}

		audit("kick", `Kicked @${target.username}: ${reason}`, user.username);
		kickUser(target.id, reason);
		return { success: true, message: `Disconnected player @${target.username}.` };
	});

	// POST /api/staff/mute - Timeout user (Requires: mod-mute)
	fastify.post("/api/staff/mute", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-mute")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-mute' privilege." });
		}
		const { targetUsername, durationMinutes = 15, reason = "Muted by staff" } = req.body || {};
		if (!targetUsername) return reply.code(400).send({ error: "Target username is required." });

		const target = db.prepare("SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)").get(String(targetUsername).trim());
		if (!target) return reply.code(404).send({ error: "Player not found." });
		if (isPrivilegedUsername(target.username)) {
			return reply.code(403).send({ error: "Cannot mute an Owner account." });
		}

		const dur = Math.max(1, Number(durationMinutes) || 15);
		const until = Date.now() + Math.round(dur * 60000);

		db.prepare("UPDATE users SET muted = 1, muted_until = ? WHERE id = ?").run(until, target.id);
		if (panelDb) {
			try {
				panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, staff, active, expires_at) VALUES (?, ?, 'mute', ?, ?, 1, ?)").run(
					target.id, target.username, reason, user.username, until
				);
			} catch {}
		}
		notifyUser(target.id, {
			type: "muted_notice",
			duration: dur,
			until,
			reason
		});
		audit("mute", `Muted @${target.username} for ${dur}m: ${reason}`, user.username);
		return { success: true, message: `Muted @${target.username} for ${dur} minutes.` };
	});

	// POST /api/staff/warn - Issue official warning (Requires: mod-warn)
	fastify.post("/api/staff/warn", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-warn")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-warn' privilege." });
		}
		const { targetUsername, reason = "Official staff warning" } = req.body || {};
		if (!targetUsername) return reply.code(400).send({ error: "Target username is required." });

		const target = db.prepare("SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)").get(String(targetUsername).trim());
		if (!target) return reply.code(404).send({ error: "Player not found." });

		if (panelDb) {
			try {
				panelDb.prepare("INSERT INTO punishments (user_id, username, type, reason, staff, active) VALUES (?, ?, 'warn', ?, ?, 0)").run(
					target.id, target.username, reason, user.username
				);
			} catch {}
		}
		audit("warn", `Issued warning to @${target.username}: ${reason}`, user.username);
		return { success: true, message: `Warning issued to @${target.username}.` };
	});

	// POST /api/staff/clear-chat - Purge recent messages (Requires: mod-chat-clear)
	fastify.post("/api/staff/clear-chat", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-chat-clear")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-chat-clear' privilege." });
		}
		try {
			db.prepare("DELETE FROM messages WHERE receiver_id = 0 OR type = 'public'").run();
		} catch {}
		audit("clear-chat", "Purged public chat messages", user.username);
		return { success: true, message: "Global chat history cleared successfully." };
	});

	// POST /api/staff/broadcast - Server announcement (Requires: chat-broadcast)
	fastify.post("/api/staff/broadcast", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "chat-broadcast")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'chat-broadcast' privilege." });
		}
		const { message } = req.body || {};
		if (!message || !message.trim()) return reply.code(400).send({ error: "Broadcast message cannot be empty." });

		audit("broadcast", `Announcement: "${message.trim()}"`, user.username);
		return { success: true, message: "Announcement broadcasted successfully." };
	});

	// POST /api/staff/motd - Update site-wide MOTD (Requires: server-motd-edit)
	fastify.post("/api/staff/motd", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "server-motd-edit")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'server-motd-edit' privilege." });
		}
		const { motd } = req.body || {};
		if (!motd || !motd.trim()) return reply.code(400).send({ error: "MOTD cannot be empty." });

		try {
			let conf = {};
			if (fs.existsSync(CONFIG_PATH)) conf = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
			conf.motd = motd.trim();
			fs.writeFileSync(CONFIG_PATH, JSON.stringify(conf, null, "\t") + "\n");
			audit("motd", `Updated MOTD to: "${conf.motd}"`, user.username);
			return { success: true, message: "Message of the Day updated.", motd: conf.motd };
		} catch (err) {
			return reply.code(500).send({ error: "Failed to save MOTD." });
		}
	});

	// GET /api/staff/reports - View community reports (Requires: mod-reports)
	fastify.get("/api/staff/reports", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-reports")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-reports' privilege." });
		}
		if (!panelDb) return { reports: [] };
		const rows = panelDb.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 100").all();
		return { success: true, reports: rows };
	});

	// POST /api/staff/reports/resolve - Resolve report (Requires: mod-reports)
	fastify.post("/api/staff/reports/resolve", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-reports")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-reports' privilege." });
		}
		const { reportId, staffNote = "Resolved by staff" } = req.body || {};
		if (!reportId || !panelDb) return reply.code(400).send({ error: "Report ID required." });

		panelDb.prepare("UPDATE reports SET status = 'resolved', staff_note = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(
			String(staffNote).slice(0, 300), reportId
		);
		audit("report.resolve", `Resolved report #${reportId}`, user.username);
		return { success: true, message: `Report #${reportId} resolved.` };
	});

	// GET /api/staff/audit - View audit logs (Requires: mod-audit-view)
	fastify.get("/api/staff/audit", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "mod-audit-view")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'mod-audit-view' privilege." });
		}
		if (!panelDb) return { logs: [] };
		const rows = panelDb.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100").all();
		return { success: true, logs: rows };
	});

	// POST /api/staff/custom-tag - Edit personal staff tag (Requires: cosmetic-custom-tag)
	fastify.post("/api/staff/custom-tag", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "cosmetic-custom-tag")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'cosmetic-custom-tag' privilege." });
		}
		const { customTag } = req.body || {};
		const cleanTag = String(customTag || "").trim().slice(0, 30);
		db.prepare("UPDATE users SET custom_tag = ? WHERE id = ?").run(cleanTag || null, user.id);
		audit("tag.update", `Updated own tag to "${cleanTag}"`, user.username);
		return { success: true, message: "Custom tag updated.", customTag: cleanTag };
	});

	// POST /api/staff/name-glow - Toggle staff name glow (Requires: cosmetic-name-glow)
	fastify.post("/api/staff/name-glow", async (req, reply) => {
		const user = req.authUser;
		if (!hasPrivilege(user, "cosmetic-name-glow")) {
			return reply.code(403).send({ error: "Permission Denied: Requires 'cosmetic-name-glow' privilege." });
		}
		const u = db.prepare("SELECT settings_json FROM users WHERE id = ?").get(user.id);
		let settings = {};
		try { settings = JSON.parse(u?.settings_json || "{}"); } catch {}
		settings.staffNameGlow = !settings.staffNameGlow;
		db.prepare("UPDATE users SET settings_json = ? WHERE id = ?").run(JSON.stringify(settings), user.id);
		return { success: true, staffNameGlow: settings.staffNameGlow };
	});
}
