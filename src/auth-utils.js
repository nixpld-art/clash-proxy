import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./db.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

// Cached reader for shared config files written by the Owner Panel (data/*.json)
const dataJsonCache = new Map();
export function readDataJson(name) {
	try {
		const url = new URL(`../data/${name}`, import.meta.url);
		const st = readFileSync(url, "utf8");
		const entry = dataJsonCache.get(name);
		if (entry && entry.raw === st) return entry.val;
		const val = JSON.parse(st);
		dataJsonCache.set(name, { raw: st, val });
		return val;
	} catch {
		return null;
	}
}

// Per-install JWT secret: env override, else generated once into data/.jwt-secret (never committed)
const JWT_SECRET = (() => {
	if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
	try {
		const file = new URL("../data/.jwt-secret", import.meta.url);
		if (existsSync(file)) {
			const saved = readFileSync(file, "utf8").trim();
			if (saved) return saved;
		}
		const secret = randomBytes(48).toString("hex");
		writeFileSync(file, secret, { mode: 0o600 });
		return secret;
	} catch {
		return randomBytes(48).toString("hex");
	}
})();

// Users with full TED-level access (admin role, founder perks)
const PRIVILEGED_USERS = new Set(["ted", "nils"]);

export function isPrivilegedUsername(username) {
	return PRIVILEGED_USERS.has(String(username || "").toLowerCase());
}

export function hashPassword(password) {
	return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
	return bcrypt.compareSync(password, hash);
}

export function generateToken(user) {
	const isTed = isPrivilegedUsername(user.username);
	return jwt.sign(
		{
			id: user.id,
			username: user.username,
			displayName: user.display_name,
			role: user.role || (isTed ? "admin" : "user"),
			custom_tag: user.custom_tag || (isTed ? "FOUNDER & DEV" : null)
		},
		JWT_SECRET,
		{ expiresIn: "30d" }
	);
}

export function verifyToken(token) {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (err) {
		return null;
	}
}

export function extractAuthUser(req) {
	const authHeader = req.headers.authorization;
	let token = null;
	if (authHeader && authHeader.startsWith("Bearer ")) {
		token = authHeader.slice(7).trim();
	} else if (req.query && req.query.token) {
		token = req.query.token;
	}
	if (!token) return null;
	const decoded = verifyToken(token);
	if (decoded && isPrivilegedUsername(decoded.username)) {
		decoded.role = "admin";
		if (!decoded.custom_tag) decoded.custom_tag = "FOUNDER & DEV";
	}
	return decoded;
}

// ============================================================
// Temporary Owner Mode — when enabled, ANY signed-in user
// is treated as owner in the Admin Center. Resets on restart.
// ============================================================
let ownerModeEnabled = false;

export function setOwnerMode(enabled) {
	ownerModeEnabled = !!enabled;
}

export function isOwnerMode() {
	return ownerModeEnabled;
}

export function isAdminUser(user) {
	if (!user) return false;
	if (ownerModeEnabled) return true;
	return isPrivilegedUsername(user.username) || user.role === "admin";
}

// XP & Level calculations
export function getLevelFromXp(xp) {
	if (!xp || xp <= 0) return 1;
	return Math.floor(Math.pow(xp / 100, 1 / 1.5)) + 1;
}

export function getXpRequiredForLevel(level) {
	if (level <= 1) return 0;
	return Math.floor(100 * Math.pow(level - 1, 1.5));
}

export function getXpForNextLevel(level) {
	return Math.floor(100 * Math.pow(level, 1.5));
}

export const BADGES = [
	{ id: "first_voyage", name: "First Voyage", description: "Browsed your first website with Clash Proxy", icon: "🌐" },
	{ id: "arcade_rookie", name: "Arcade Rookie", description: "Played your first game in the Arcade", icon: "🕹️" },
	{ id: "arcade_master", name: "Arcade Master", description: "Played 5 different games in the Arcade", icon: "🏆" },
	{ id: "socialite", name: "Socialite", description: "Connected with your first friend", icon: "🤝" },
	{ id: "ghost_walker", name: "Ghost Walker", description: "Activated Ghost Mode for zero-trace browsing", icon: "👻" },
	{ id: "level_5", name: "Shadow Runner", description: "Achieved Level 5 rank", icon: "⚡" },
	{ id: "level_10", name: "Proxy Master", description: "Achieved Level 10 rank", icon: "👑" },
	{ id: "streak_3", name: "Dedication", description: "Maintained a 3-day active streak", icon: "🔥" }
];

export function awardAchievement(userId, badgeId) {
	try {
		const check = db.prepare("SELECT id FROM achievements WHERE user_id = ? AND badge_id = ?").get(userId, badgeId);
		if (!check) {
			db.prepare("INSERT INTO achievements (user_id, badge_id) VALUES (?, ?)").run(userId, badgeId);
			// Award bonus XP for achievement
			addXp(userId, 50, `Achievement Unlocked: ${badgeId}`);
			return true;
		}
	} catch (e) {
		console.error("Error awarding achievement:", e);
	}
	return false;
}

export function addXp(userId, amount, reason = "Activity") {
	try {
		const user = db.prepare("SELECT id, xp, level FROM users WHERE id = ?").get(userId);
		if (!user) return null;

		// Owner Panel XP event: network-wide multiplier with countdown
		const xpEvent = readDataJson("xp-event.json");
		if (xpEvent && xpEvent.active && (!xpEvent.endsAt || Date.now() < xpEvent.endsAt)) {
			amount = Math.max(1, Math.round(amount * (Number(xpEvent.mult) || 2)));
		}

		const newXp = (user.xp || 0) + amount;
		const newLevel = getLevelFromXp(newXp);
		const leveledUp = newLevel > (user.level || 1);

		db.prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?").run(newXp, newLevel, userId);

		// Record activity
		db.prepare("INSERT INTO activity_log (user_id, type, data_json) VALUES (?, ?, ?)").run(
			userId,
			"xp_earned",
			JSON.stringify({ amount, reason, newXp, newLevel })
		);

		// Check Level Achievements
		if (newLevel >= 5) awardAchievement(userId, "level_5");
		if (newLevel >= 10) awardAchievement(userId, "level_10");

		return {
			xp: newXp,
			level: newLevel,
			leveledUp,
			earned: amount,
			reason
		};
	} catch (e) {
		console.error("Error adding XP:", e);
		return null;
	}
}
