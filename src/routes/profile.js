import db from "../db.js";
import { extractAuthUser, getXpRequiredForLevel, getXpForNextLevel, BADGES, awardAchievement, generateToken, isPrivilegedUsername } from "../auth-utils.js";

export default async function profileRoutes(fastify) {
	// Public profile view
	fastify.get("/api/profile/:username", async (req, reply) => {
		const { username } = req.params;
		if (!username) return reply.code(400).send({ error: "Username required" });

		const user = db.prepare(`
			SELECT id, username, display_name, avatar_url, bio, xp, level, streak_days, created_at
			FROM users WHERE username = ?
		`).get(username.trim());

		if (!user) {
			return reply.code(404).send({ error: "User profile not found." });
		}

		const achievements = db.prepare("SELECT badge_id, unlocked_at FROM achievements WHERE user_id = ?").all(user.id);
		const userBadges = BADGES.map(b => {
			const unlocked = achievements.find(a => a.badge_id === b.id);
			return {
				...b,
				unlocked: !!unlocked,
				unlocked_at: unlocked ? unlocked.unlocked_at : null
			};
		});

		// Count friends
		const friendCount = db.prepare(`
			SELECT COUNT(*) as count FROM friendships
			WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
		`).get(user.id, user.id)?.count || 0;

		return {
			success: true,
			profile: {
				...user,
				friendCount,
				currentLevelXp: getXpRequiredForLevel(user.level),
				nextLevelXp: getXpForNextLevel(user.level),
				badges: userBadges
			}
		};
	});

	// Update own profile (display name, avatar, bio, settings, and username)
	fastify.patch("/api/profile", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const { username, display_name, avatar_url, bio, settings } = req.body || {};

		const user = db.prepare("SELECT * FROM users WHERE id = ?").get(auth.id);
		if (!user) return reply.code(404).send({ error: "User not found" });

		let newUsername = user.username;
		let tokenChanged = false;
		if (username !== undefined && typeof username === "string") {
			const cleanUsername = username.trim().toLowerCase();
			if (cleanUsername !== user.username.toLowerCase()) {
				if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
					return reply.code(400).send({ error: "Username must be 3-20 letters, numbers, or underscores." });
				}
				const reserved = ["admin", "owner", "guest", "anonymous", "system", "moderator", "mod", "clash"];
				if (reserved.includes(cleanUsername) && !isPrivilegedUsername(user.username)) {
					return reply.code(400).send({ error: "This username is reserved." });
				}
				const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?").get(cleanUsername, user.id);
				if (existing) {
					return reply.code(409).send({ error: "Username is already taken by another user." });
				}
				newUsername = cleanUsername;
				tokenChanged = true;
			}
		}

		const newDisplayName = (display_name !== undefined && typeof display_name === "string") ? display_name.trim().slice(0, 30) : user.display_name;
		const newAvatar = (avatar_url !== undefined && typeof avatar_url === "string") ? avatar_url : user.avatar_url;
		const newBio = (bio !== undefined && typeof bio === "string") ? bio.trim().slice(0, 250) : user.bio;
		
		let newSettings = user.settings_json || "{}";
		if (settings && typeof settings === "object") {
			const parsed = JSON.parse(user.settings_json || "{}");
			const merged = { ...parsed, ...settings };
			newSettings = JSON.stringify(merged);

			if (merged.ghostMode) {
				awardAchievement(user.id, "ghost_walker");
			}
		}

		db.prepare(`
			UPDATE users
			SET username = ?, display_name = ?, avatar_url = ?, bio = ?, settings_json = ?
			WHERE id = ?
		`).run(newUsername, newDisplayName, newAvatar, newBio, newSettings, user.id);

		const updated = db.prepare("SELECT id, username, display_name, avatar_url, bio, xp, level, streak_days, settings_json, role, custom_tag FROM users WHERE id = ?").get(user.id);

		let newToken = null;
		if (tokenChanged) {
			newToken = generateToken(updated);
		}

		return {
			success: true,
			user: {
				...updated,
				settings: JSON.parse(updated.settings_json || "{}"),
				currentLevelXp: getXpRequiredForLevel(updated.level),
				nextLevelXp: getXpForNextLevel(updated.level)
			},
			token: newToken
		};
	});

	// Aggregated user activity statistics
	fastify.get("/api/profile/stats", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const userRow = db.prepare("SELECT xp, games_played_override, sites_visited_override FROM users WHERE id = ?").get(auth.id);

		const gamesPlayedCount = userRow?.games_played_override !== null && userRow?.games_played_override !== undefined
			? userRow.games_played_override
			: (db.prepare(`
				SELECT COUNT(*) as count FROM activity_log
				WHERE user_id = ? AND type = 'game_play'
			`).get(auth.id)?.count || 0);

		const sitesVisitedCount = userRow?.sites_visited_override !== null && userRow?.sites_visited_override !== undefined
			? userRow.sites_visited_override
			: (db.prepare(`
				SELECT COUNT(*) as count FROM activity_log
				WHERE user_id = ? AND type = 'site_visit'
			`).get(auth.id)?.count || 0);

		const totalXpEarned = userRow?.xp || 0;

		const achievementsCount = db.prepare("SELECT COUNT(*) as count FROM achievements WHERE user_id = ?").get(auth.id)?.count || 0;

		return {
			success: true,
			stats: {
				gamesPlayed: gamesPlayedCount,
				sitesVisited: sitesVisitedCount,
				totalXp: totalXpEarned,
				achievementsCount,
				totalBadgesAvailable: BADGES.length
			}
		};
	});
}
