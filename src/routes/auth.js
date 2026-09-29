import db from "../db.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
	hashPassword,
	comparePassword,
	generateToken,
	extractAuthUser,
	getLevelFromXp,
	getXpRequiredForLevel,
	getXpForNextLevel,
	addXp,
	awardAchievement,
	isPrivilegedUsername
} from "../auth-utils.js";

// Owner key — ONLY way to become owner. Never baked into the source
// (the repo is public). Resolution:
//   1. OWNER_KEY env var (optional override)
//   2. data/.owner-key file (gitignored, persists per install)
//   3. otherwise a random key is generated, saved to data/.owner-key,
//      and printed to the server console/logs on first boot.
// If no key can be stored at all, owner registration stays disabled
// (nobody can become owner) — never a silent fallback.
const OWNER_KEY = (() => {
	const envKey = typeof process.env.OWNER_KEY === "string" ? process.env.OWNER_KEY.trim() : "";
	if (envKey) return envKey;
	try {
		const file = new URL("../../data/.owner-key", import.meta.url);
		if (existsSync(file)) {
			const saved = readFileSync(file, "utf8").trim();
			if (saved) return saved;
		}
		const generated = randomBytes(24).toString("hex");
		writeFileSync(file, generated, { mode: 0o600 });
		console.warn("");
		console.warn("[AUTH] ============================================================");
		console.warn("[AUTH]  NEW OWNER KEY GENERATED (saved to data/.owner-key):");
		console.warn("[AUTH]    " + generated);
		console.warn("[AUTH]  Register the owner account with this key to claim it.");
		console.warn("[AUTH] ============================================================");
		console.warn("");
		return generated;
	} catch {
		console.warn("[AUTH] OWNER KEY UNAVAILABLE (no env, no data/.owner-key) — owner registration is disabled.");
		return "";
	}
})();

export default async function authRoutes(fastify) {
	// Register
	fastify.post("/api/auth/register", async (req, reply) => {
		const { username, password, displayName } = req.body || {};

		if (!username || typeof username !== "string" || username.trim().length < 3) {
			return reply.code(400).send({ error: "Username must be at least 3 characters long." });
		}
		if (!password || typeof password !== "string" || password.length < 6) {
			return reply.code(400).send({ error: "Password must be at least 6 characters long." });
		}

		const cleanUsername = username.trim();
		if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
			return reply.code(400).send({ error: "Username can only contain letters, numbers, underscores, dashes and dots." });
		}

		// Founder names are reserved — only the Owner Key holder may register them
		if (isPrivilegedUsername(cleanUsername)) {
			const k = typeof req.body?.ownerKey === "string" ? req.body.ownerKey.trim() : "";
			if (!OWNER_KEY || k !== OWNER_KEY) {
				return reply.code(403).send({ error: "That username is reserved." });
			}
		}

		try {
			const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(cleanUsername);
			if (existing) {
				// No account can ever be taken over by re-registering its name
				return reply.code(409).send({ error: "Username is already taken." });
			}

			const passwordHash = hashPassword(password);
			const dispName = (displayName && typeof displayName === "string" && displayName.trim()) || cleanUsername;
			// Ownership is key-based ONLY — never name-based, never first-user.
			const providedKey = typeof req.body?.ownerKey === "string" ? req.body.ownerKey.trim() : "";
			const isOwner = !!OWNER_KEY && providedKey === OWNER_KEY;
			const role = isOwner ? "admin" : "user";
			const customTag = isOwner ? "FOUNDER & DEV" : null;
			const initialCoins = isOwner ? 999999 : 350;
			const initialFrame = isOwner ? "frame-sovereign-gold" : "none";

			const result = db.prepare(`
				INSERT INTO users (username, password_hash, display_name, avatar_url, xp, level, streak_days, last_login_date, role, custom_tag, coins, equipped_frame)
				VALUES (?, ?, ?, 'avatar-1', 0, 1, 1, DATE('now'), ?, ?, ?, ?)
			`).run(cleanUsername, passwordHash, dispName, role, customTag, initialCoins, initialFrame);

			const newUser = db.prepare("SELECT id, username, display_name, avatar_url, bio, xp, level, streak_days, role, custom_tag, coins, equipped_frame, equipped_name_theme, equipped_chat_theme, settings_json FROM users WHERE id = ?").get(result.lastInsertRowid);
			
			// Award initial welcome XP
			addXp(newUser.id, 25, "Welcome to Clash Proxy!");

			const token = generateToken(newUser);

			return {
				success: true,
				token,
				user: {
					...newUser,
					displayName: newUser.display_name,
					avatarUrl: newUser.avatar_url,
					streakDays: newUser.streak_days,
					coins: newUser.coins || 0,
					equippedFrame: newUser.equipped_frame || "none",
					equippedNameTheme: newUser.equipped_name_theme || "none",
					equippedChatTheme: newUser.equipped_chat_theme || "none",
					role: newUser.role || (isOwner ? "admin" : "user"),
					customTag: newUser.custom_tag || (isOwner ? "FOUNDER & DEV" : ""),
					settings: JSON.parse(newUser.settings_json || "{}"),
					currentLevelXp: getXpRequiredForLevel(newUser.level),
					nextLevelXp: getXpForNextLevel(newUser.level)
				}
			};
		} catch (err) {
			console.error("Registration error:", err);
			return reply.code(500).send({ error: "Failed to create account. Please try again." });
		}
	});

	// Login
	fastify.post("/api/auth/login", async (req, reply) => {
		const { username, password } = req.body || {};

		if (!username || !password) {
			return reply.code(400).send({ error: "Username and password are required." });
		}

		try {
			const cleanUser = String(username).trim();
			let user = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUser);
			if (!user) {
				user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(cleanUser);
			}
			if (!user) {
				return reply.code(401).send({ error: "Invalid username or password." });
			}

			// Owner Panel enforcement: ban / maintenance mode / whitelist
			if (user.banned && user.banned_until && Date.now() >= user.banned_until) {
				// Timed ban expired — auto-lift and allow login
				db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?").run(user.id);
				user.banned = 0;
			}
			if (user.banned) {
				const until = user.banned_until ? ` (until ${new Date(user.banned_until).toISOString().replace("T", " ").slice(0, 16)} UTC)` : "";
				return reply.code(403).send({ error: `This account has been banned by the network team${until}.` });
			}
			try {
				const acl = JSON.parse(readFileSync(fileURLToPath(new URL("../../data/access-control.json", import.meta.url)), "utf8"));
				const staff = user.role === "admin";
				if (acl.maintenance && !staff) {
					return reply.code(503).send({ error: acl.maintenanceMessage || "Scheduled maintenance in progress. Please try again later." });
				}
				if (acl.whitelistEnabled && !staff) {
					const list = Array.isArray(acl.whitelist) ? acl.whitelist : [];
					if (!list.some((w) => String(w).toLowerCase() === user.username.toLowerCase())) {
						return reply.code(403).send({ error: "Access is currently restricted to whitelisted accounts." });
					}
				}
			} catch { /* no access-control file = open access */ }

			// No password backdoors: everyone (founders included) proves their real password
			const isValid = comparePassword(password, user.password_hash);
			if (!isValid) {
				return reply.code(401).send({ error: "Invalid username or password." });
			}

			// Update login streak
			const today = new Date().toISOString().split("T")[0];
			let newStreak = user.streak_days || 1;

			if (user.last_login_date) {
				const lastDate = new Date(user.last_login_date);
				const currDate = new Date(today);
				const diffDays = Math.floor((currDate - lastDate) / (1000 * 60 * 60 * 24));

				if (diffDays === 1) {
					newStreak += 1;
				} else if (diffDays > 1) {
					newStreak = 1;
				}
			}

			db.prepare(`
				UPDATE users 
				SET streak_days = ?, last_login_date = ? 
				WHERE id = ?
			`).run(newStreak, today, user.id);

			// Record last login IP for the Owner Panel IP audit
			try { db.prepare("UPDATE users SET last_ip = ? WHERE id = ?").run(req.ip || null, user.id); } catch {}

			user.streak_days = newStreak;
			if (newStreak >= 3) {
				awardAchievement(user.id, "streak_3");
			}

			const token = generateToken(user);

			return {
				success: true,
				token,
				user: {
					...user,
					displayName: user.display_name,
					avatarUrl: user.avatar_url,
					streakDays: user.streak_days,
					coins: user.coins || 0,
					equippedFrame: user.equipped_frame || "none",
					equippedNameTheme: user.equipped_name_theme || "none",
					equippedChatTheme: user.equipped_chat_theme || "none",
					role: user.role || "user",
					customTag: user.custom_tag || "",
					settings: JSON.parse(user.settings_json || "{}"),
					currentLevelXp: getXpRequiredForLevel(user.level),
					nextLevelXp: getXpForNextLevel(user.level)
				}
			};
		} catch (err) {
			console.error("Login error:", err);
			return reply.code(500).send({ error: "Login failed. Please try again." });
		}
	});

	// Current User
	fastify.get("/api/auth/me", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) {
			return reply.code(401).send({ error: "Unauthorized" });
		}

		try {
			const user = db.prepare("SELECT id, username, display_name, avatar_url, bio, xp, level, streak_days, role, custom_tag, games_played_override, sites_visited_override, coins, equipped_frame, equipped_name_theme, equipped_chat_theme, settings_json, created_at FROM users WHERE id = ?").get(auth.id);
			if (!user) {
				return reply.code(404).send({ error: "User not found." });
			}

			const achievements = db.prepare("SELECT badge_id, unlocked_at FROM achievements WHERE user_id = ?").all(user.id);

			return {
				success: true,
				user: {
					...user,
					displayName: user.display_name,
					avatarUrl: user.avatar_url,
					streakDays: user.streak_days,
					coins: user.coins || 0,
					equippedFrame: user.equipped_frame || "none",
					equippedNameTheme: user.equipped_name_theme || "none",
					equippedChatTheme: user.equipped_chat_theme || "none",
					role: user.role || "user",
					customTag: user.custom_tag || "",
					settings: JSON.parse(user.settings_json || "{}"),
					currentLevelXp: getXpRequiredForLevel(user.level),
					nextLevelXp: getXpForNextLevel(user.level),
					achievements: achievements.map(a => a.badge_id)
				}
			};
		} catch (err) {
			console.error("Auth me error:", err);
			return reply.code(500).send({ error: "Server error." });
		}
	});
}
