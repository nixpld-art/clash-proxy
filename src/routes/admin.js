import db from "../db.js";
import { extractAuthUser, isAdminUser, isOwnerMode, setOwnerMode, isPrivilegedUsername, BADGES } from "../auth-utils.js";
import { broadcastSystemAnnouncement } from "../presence.js";

export default async function adminRoutes(fastify, options) {
	// Middleware hook to guard all /api/admin/* endpoints
	fastify.addHook("preHandler", async (req, reply) => {
		if (req.url.startsWith("/api/admin")) {
			const auth = extractAuthUser(req);
			if (!auth || !isAdminUser(auth)) {
				return reply.code(403).send({ error: "Access Denied. Administrator clearance required." });
			}
			req.adminUser = auth;
		}
	});

	// GET /api/owner-mode - Public status of the temporary owner switch
	fastify.get("/api/owner-mode", async () => {
		return { enabled: isOwnerMode() };
	});

	// POST /api/admin/owner-mode - Toggle the temporary owner switch
	// Guarded: only admins can turn it ON; once ON, any signed-in user can toggle it
	fastify.post("/api/admin/owner-mode", async (req, reply) => {
		const { enabled } = req.body || {};
		if (typeof enabled !== "boolean") {
			return reply.code(400).send({ error: "'enabled' must be a boolean." });
		}

		setOwnerMode(enabled);

		if (enabled) {
			broadcastSystemAnnouncement(
				"👑 OWNER MODE ENABLED — every signed-in player now holds owner rank in the Admin Center.",
				req.adminUser?.username || "SYSTEM"
			);
		}

		return { success: true, enabled: isOwnerMode() };
	});

	// GET /api/admin/users - List all users with aggregated stats
	fastify.get("/api/admin/users", async (req, reply) => {
		const users = db.prepare(`
			SELECT 
				u.id, 
				u.username, 
				u.display_name, 
				u.avatar_url, 
				u.role, 
				u.custom_tag, 
				u.xp, 
				u.level, 
				u.streak_days, 
				u.games_played_override,
				u.sites_visited_override,
				u.created_at,
				(SELECT COUNT(*) FROM achievements WHERE user_id = u.id) as badges_count,
				(SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND type = 'game_play') as raw_games,
				(SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND type = 'site_visit') as raw_sites
			FROM users u
			ORDER BY u.id ASC
		`).all();

		const formatted = users.map(u => ({
			id: u.id,
			username: u.username,
			displayName: u.display_name || u.username,
			avatarUrl: u.avatar_url || "avatar-1",
			role: u.role || (isPrivilegedUsername(u.username) ? "admin" : "user"),
			customTag: u.custom_tag || (isPrivilegedUsername(u.username) ? "FOUNDER & DEV" : ""),
			xp: u.xp,
			level: u.level,
			streakDays: u.streak_days,
			gamesPlayed: u.games_played_override !== null ? u.games_played_override : u.raw_games,
			sitesVisited: u.sites_visited_override !== null ? u.sites_visited_override : u.raw_sites,
			badgesCount: u.badges_count,
			createdAt: u.created_at
		}));

		return { success: true, users: formatted, totalBadgesCount: BADGES.length };
	});

	// GET /api/admin/user/:id - Single user details including achievements
	fastify.get("/api/admin/user/:id", async (req, reply) => {
		const targetId = parseInt(req.params.id, 10);
		const user = db.prepare(`
			SELECT 
				u.id, u.username, u.display_name, u.avatar_url, u.role, u.custom_tag, 
				u.xp, u.level, u.streak_days, u.games_played_override, u.sites_visited_override, u.created_at,
				(SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND type = 'game_play') as raw_games,
				(SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND type = 'site_visit') as raw_sites
			FROM users u WHERE u.id = ?
		`).get(targetId);

		if (!user) {
			return reply.code(404).send({ error: "User not found" });
		}

		const unlockedBadges = db.prepare("SELECT badge_id, unlocked_at FROM achievements WHERE user_id = ?").all(targetId);
		const unlockedMap = new Set(unlockedBadges.map(b => b.badge_id));

		const allBadgesWithStatus = BADGES.map(b => ({
			...b,
			unlocked: unlockedMap.has(b.id)
		}));

		return {
			success: true,
			user: {
				id: user.id,
				username: user.username,
				displayName: user.display_name || user.username,
				avatarUrl: user.avatar_url || "avatar-1",
				role: user.role || (isPrivilegedUsername(user.username) ? "admin" : "user"),
				customTag: user.custom_tag || (isPrivilegedUsername(user.username) ? "FOUNDER & DEV" : ""),
				xp: user.xp,
				level: user.level,
				streakDays: user.streak_days,
				gamesPlayed: user.games_played_override !== null ? user.games_played_override : user.raw_games,
				sitesVisited: user.sites_visited_override !== null ? user.sites_visited_override : user.raw_sites,
				createdAt: user.created_at
			},
			badges: allBadgesWithStatus
		};
	});

	// PATCH /api/admin/user/:id - Edit level, tag, xp, games, websites, streak, etc.
	fastify.patch("/api/admin/user/:id", async (req, reply) => {
		const targetId = parseInt(req.params.id, 10);
		const user = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
		if (!user) return reply.code(404).send({ error: "User not found" });

		const {
			level,
			xp,
			custom_tag,
			streak_days,
			games_played,
			sites_visited,
			display_name,
			role
		} = req.body || {};

		const updates = [];
		const params = [];

		if (level !== undefined && !isNaN(parseInt(level, 10))) {
			updates.push("level = ?");
			params.push(Math.max(1, parseInt(level, 10)));
		}
		if (xp !== undefined && !isNaN(parseInt(xp, 10))) {
			updates.push("xp = ?");
			params.push(Math.max(0, parseInt(xp, 10)));
		}
		if (custom_tag !== undefined) {
			updates.push("custom_tag = ?");
			params.push(custom_tag ? String(custom_tag).trim().slice(0, 40) : null);
		}
		if (streak_days !== undefined && !isNaN(parseInt(streak_days, 10))) {
			updates.push("streak_days = ?");
			params.push(Math.max(0, parseInt(streak_days, 10)));
		}
		if (games_played !== undefined && !isNaN(parseInt(games_played, 10))) {
			updates.push("games_played_override = ?");
			params.push(Math.max(0, parseInt(games_played, 10)));
		}
		if (sites_visited !== undefined && !isNaN(parseInt(sites_visited, 10))) {
			updates.push("sites_visited_override = ?");
			params.push(Math.max(0, parseInt(sites_visited, 10)));
		}
		if (display_name !== undefined) {
			updates.push("display_name = ?");
			params.push(String(display_name).trim().slice(0, 30));
		}
		if (role !== undefined) {
			updates.push("role = ?");
			params.push(role === "admin" ? "admin" : "user");
		}

		if (updates.length > 0) {
			params.push(targetId);
			db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);
		}

		const updatedUser = db.prepare("SELECT id, username, display_name, role, custom_tag, xp, level, streak_days, games_played_override, sites_visited_override FROM users WHERE id = ?").get(targetId);
		return { success: true, user: updatedUser };
	});

	// POST /api/admin/user/:id/achievement - Toggle/grant/revoke badge
	fastify.post("/api/admin/user/:id/achievement", async (req, reply) => {
		const targetId = parseInt(req.params.id, 10);
		const { badgeId, action } = req.body || {};

		const validBadge = BADGES.find(b => b.id === badgeId);
		if (!validBadge) {
			return reply.code(400).send({ error: "Invalid badge ID" });
		}

		if (action === "grant") {
			db.prepare("INSERT OR IGNORE INTO achievements (user_id, badge_id) VALUES (?, ?)").run(targetId, badgeId);
		} else if (action === "revoke") {
			db.prepare("DELETE FROM achievements WHERE user_id = ? AND badge_id = ?").run(targetId, badgeId);
		} else {
			return reply.code(400).send({ error: "Action must be 'grant' or 'revoke'" });
		}

		const count = db.prepare("SELECT COUNT(*) as count FROM achievements WHERE user_id = ?").get(targetId).count;
		return { success: true, badgeId, action, totalBadges: count };
	});

	// POST /api/admin/broadcast - Server-wide broadcast alert
	fastify.post("/api/admin/broadcast", async (req, reply) => {
		const { message } = req.body || {};
		if (!message || !message.trim()) {
			return reply.code(400).send({ error: "Broadcast message is required." });
		}

		const cleanMsg = String(message).trim().slice(0, 300);
		broadcastSystemAnnouncement(cleanMsg, req.adminUser.username || "TED");

		return { success: true, message: cleanMsg };
	});

	// POST /api/admin/god-mode - Instant boost for @TED
	fastify.post("/api/admin/god-mode", async (req, reply) => {
		const adminId = req.adminUser.id;

		// Set Level 99, 1,000,000 XP, 999 Streak, 5,000 games, 10,000 sites, custom tag
		db.prepare(`
			UPDATE users 
			SET level = 99, 
			    xp = 1000000, 
			    streak_days = 999, 
			    games_played_override = 5000, 
			    sites_visited_override = 10000, 
			    custom_tag = '👑 FOUNDER & ARCHITECT',
			    role = 'admin'
			WHERE id = ?
		`).run(adminId);

		// Unlock all achievements
		const insertAch = db.prepare("INSERT OR IGNORE INTO achievements (user_id, badge_id) VALUES (?, ?)");
		for (const b of BADGES) {
			insertAch.run(adminId, b.id);
		}

		const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(adminId);
		return { success: true, user: updated, message: "⚡ God Mode activated! Welcome to the Pantheon, TED." };
	});
}
