import db from "../db.js";
import { extractAuthUser, addXp, awardAchievement, BADGES } from "../auth-utils.js";

// Rate limiting cache for XP requests to prevent spam
const xpRateLimits = new Map();

export default async function levelsRoutes(fastify) {
	// Award XP
	fastify.post("/api/levels/xp", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const { type, details } = req.body || {};
		const now = Date.now();
		const userKey = `${auth.id}_${type}`;
		const lastAwardTime = xpRateLimits.get(userKey) || 0;

		let amount = 0;
		let reason = "Activity";

		if (type === "browse") {
			// Rate limit: max 1 browse XP per 10 seconds
			if (now - lastAwardTime < 10000) {
				return { success: false, rateLimited: true };
			}
			amount = 5;
			reason = `Visited ${details?.domain || "website"}`;
			awardAchievement(auth.id, "first_voyage");

			// Log site visit
			db.prepare("INSERT INTO activity_log (user_id, type, data_json) VALUES (?, ?, ?)").run(
				auth.id,
				"site_visit",
				JSON.stringify({ domain: details?.domain || "unknown", timestamp: now })
			);
		} else if (type === "game_play") {
			// Rate limit: max 1 gameplay award per 2 minutes
			if (now - lastAwardTime < 120000) {
				return { success: false, rateLimited: true };
			}
			amount = 15;
			reason = `Played ${details?.gameTitle || "Arcade Game"}`;
			awardAchievement(auth.id, "arcade_rookie");

			// Log game play
			db.prepare("INSERT INTO activity_log (user_id, type, data_json) VALUES (?, ?, ?)").run(
				auth.id,
				"game_play",
				JSON.stringify({ gameTitle: details?.gameTitle || "Arcade Game", timestamp: now })
			);

			// Count unique games played
			const uniqueGames = db.prepare(`
				SELECT COUNT(DISTINCT json_extract(data_json, '$.gameTitle')) as count
				FROM activity_log
				WHERE user_id = ? AND type = 'game_play'
			`).get(auth.id)?.count || 0;

			if (uniqueGames >= 5) {
				awardAchievement(auth.id, "arcade_master");
			}
		} else {
			return reply.code(400).send({ error: "Invalid activity type." });
		}

		xpRateLimits.set(userKey, now);

		const result = addXp(auth.id, amount, reason);

		return {
			success: true,
			...result
		};
	});

	// Global Leaderboard
	fastify.get("/api/levels/leaderboard", async (req, reply) => {
		const topUsers = db.prepare(`
			SELECT id, username, display_name, avatar_url, level, xp, role, custom_tag
			FROM users
			ORDER BY xp DESC, level DESC
			LIMIT 50
		`).all();

		const leaderboard = topUsers.map((u, index) => ({
			rank: index + 1,
			...u
		}));

		return {
			success: true,
			leaderboard
		};
	});

	// All Badges list
	fastify.get("/api/levels/badges", async (req, reply) => {
		const auth = extractAuthUser(req);
		let unlockedBadges = new Set();

		if (auth) {
			const rows = db.prepare("SELECT badge_id FROM achievements WHERE user_id = ?").all(auth.id);
			unlockedBadges = new Set(rows.map(r => r.badge_id));
		}

		const badges = BADGES.map(b => ({
			...b,
			unlocked: unlockedBadges.has(b.id)
		}));

		return {
			success: true,
			badges
		};
	});
}
