import db from "./db.js";

// ============================================================
// Safe Migrations for activity_log, users, and guest_visitors
// ============================================================
try {
	const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
	if (!userCols.includes("last_active_at")) {
		db.exec("ALTER TABLE users ADD COLUMN last_active_at INTEGER DEFAULT 0");
		db.exec("CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at)");
	}
} catch (e) {
	console.warn("[DB] users last_active_at migration notice:", e.message);
}

try {
	const actCols = db.prepare("PRAGMA table_info(activity_log)").all().map(c => c.name);
	if (!actCols.includes("timestamp")) {
		db.exec("ALTER TABLE activity_log ADD COLUMN timestamp INTEGER DEFAULT 0");
		db.exec("CREATE INDEX IF NOT EXISTS idx_activity_log_ts ON activity_log(timestamp)");
		db.exec("CREATE INDEX IF NOT EXISTS idx_activity_log_type_ts ON activity_log(type, timestamp)");
		try {
			db.exec("UPDATE activity_log SET timestamp = CAST(strftime('%s', created_at) AS INTEGER) * 1000 WHERE timestamp = 0 OR timestamp IS NULL");
		} catch {}
	}
	if (!actCols.includes("guest_id")) {
		db.exec("ALTER TABLE activity_log ADD COLUMN guest_id TEXT DEFAULT NULL");
		db.exec("CREATE INDEX IF NOT EXISTS idx_activity_log_guest ON activity_log(guest_id)");
	}
} catch (e) {
	console.warn("[DB] activity_log migration notice:", e.message);
}

try {
	db.exec(`
		CREATE TABLE IF NOT EXISTS guest_visitors (
			guest_id TEXT PRIMARY KEY,
			first_seen_at INTEGER,
			last_active_at INTEGER,
			ip TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_guest_last_active ON guest_visitors(last_active_at);
	`);
} catch (e) {
	console.warn("[DB] guest_visitors migration notice:", e.message);
}

// In-memory throttles for SQLite updates
const lastActiveDbTouch = new Map();
const lastGuestDbTouch = new Map();

/**
 * Touch a signed-in user's active timestamp in memory & database (throttled to at most once per 30s)
 */
export function touchUserActive(userId) {
	const id = Number(userId);
	if (!id || id <= 0) return;
	const now = Date.now();
	const last = lastActiveDbTouch.get(id) || 0;
	if (now - last > 30_000) {
		lastActiveDbTouch.set(id, now);
		try {
			db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(now, id);
		} catch {}
	}
}

/**
 * Touch an anonymous guest visitor's active timestamp in memory & database (throttled to at most once per 30s)
 */
export function touchGuestActive(guestId, ip = "") {
	const gid = String(guestId || "").trim();
	if (!gid) return;
	const now = Date.now();
	const last = lastGuestDbTouch.get(gid) || 0;
	if (now - last > 30_000) {
		lastGuestDbTouch.set(gid, now);
		try {
			db.prepare(`
				INSERT INTO guest_visitors (guest_id, first_seen_at, last_active_at, ip)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(guest_id) DO UPDATE SET last_active_at = excluded.last_active_at
			`).run(gid, now, now, ip || null);
		} catch {}
	}
}

/**
 * Record a feature usage or activity event in activity_log
 */
export function recordActivity(userId, type, data = {}, guestId = null) {
	try {
		const uid = Number(userId) || 0;
		const now = Date.now();
		const gid = guestId ? String(guestId).trim() : null;
		if (uid > 0) touchUserActive(uid);
		else if (gid) touchGuestActive(gid);

		db.prepare("INSERT INTO activity_log (user_id, type, data_json, timestamp, guest_id) VALUES (?, ?, ?, ?, ?)").run(
			uid,
			String(type),
			typeof data === "string" ? data : JSON.stringify(data || {}),
			now,
			gid
		);
	} catch (e) {
		// Non-fatal
	}
}

/**
 * Calculate standard time windows:
 * - now: past 15 minutes
 * - lastHr: past 60 minutes
 * - lastDay: past 24 hours
 * - lastWeek: previous calendar week Monday 00:00:00 to Sunday 23:59:59.999
 * - thisWeek: current calendar week Monday 00:00:00 to now
 */
export function getActivityTimeWindows() {
	const now = Date.now();
	const nowDate = new Date(now);

	const nowStart = now - (15 * 60 * 1000); // 15 mins
	const lastHrStart = now - (60 * 60 * 1000); // 1 hour
	const lastDayStart = now - (24 * 60 * 60 * 1000); // 24 hours

	// Mon - Sun calculation
	const dayOfWeek = nowDate.getDay();
	const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6

	const thisMonday = new Date(nowDate);
	thisMonday.setDate(nowDate.getDate() - daysSinceMonday);
	thisMonday.setHours(0, 0, 0, 0);
	const thisWeekStart = thisMonday.getTime();

	const lastWeekStart = thisWeekStart - (7 * 24 * 60 * 60 * 1000);
	const lastWeekEnd = thisWeekStart - 1;

	const formatDateRange = (dStart, dEnd) => {
		const s = new Date(dStart);
		const e = new Date(dEnd);
		return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
	};

	return {
		now: { start: nowStart, end: now, label: "Right Now (15m)" },
		lastHr: { start: lastHrStart, end: now, label: "Last Hour" },
		lastDay: { start: lastDayStart, end: now, label: "Last 24 Hours" },
		lastWeek: {
			start: lastWeekStart,
			end: lastWeekEnd,
			label: "Last Week (Mon – Sun)",
			rangeText: formatDateRange(lastWeekStart, lastWeekEnd)
		},
		thisWeek: {
			start: thisWeekStart,
			end: now,
			label: "This Week (Mon – Sun)",
			rangeText: formatDateRange(thisWeekStart, now)
		}
	};
}

/**
 * Get count of unique signed-in users active within a time range
 */
export function getSignedInUsersCount(startTime, endTime = Date.now()) {
	try {
		const row = db.prepare(`
			SELECT COUNT(DISTINCT id) as cnt
			FROM users
			WHERE last_active_at >= ? AND last_active_at <= ?
		`).get(startTime, endTime);
		return row?.cnt || 0;
	} catch {
		return 0;
	}
}

/**
 * Get count of unique anonymous guest users active within a time range
 */
export function getGuestUsersCount(startTime, endTime = Date.now()) {
	try {
		const row = db.prepare(`
			SELECT COUNT(DISTINCT guest_id) as cnt
			FROM guest_visitors
			WHERE last_active_at >= ? AND last_active_at <= ?
		`).get(startTime, endTime);
		return row?.cnt || 0;
	} catch {
		return 0;
	}
}

/**
 * Human readable metadata for feature activity types
 */
export const FEATURE_INFO = {
	ai_query: { name: "Clash AI Assistant", icon: "🤖", category: "AI & Chat" },
	proxy_browse: { name: "Web Proxy & Navigation", icon: "🌐", category: "Core Proxy" },
	site_visit: { name: "Web Proxy Visits", icon: "🌐", category: "Core Proxy" },
	game_play: { name: "Arcade & Web Games", icon: "🎮", category: "Gaming" },
	soundboard_play: { name: "Soundboard Effects", icon: "🔊", category: "Audio" },
	chat_message: { name: "Direct Messages & Chat", icon: "💬", category: "Social" },
	lounge_party: { name: "Lounge Multiplayer Parties", icon: "🛋️", category: "Social" },
	stealth_cloak: { name: "Tab Cloaking & Stealth", icon: "🕵️", category: "Privacy" },
	mirror_switch: { name: "26 Mirrors Hub", icon: "🔗", category: "Connectivity" },
	bazaar_shop: { name: "Bazaar & Cosmetics", icon: "🏪", category: "Economy" },
	soundboard_favorite: { name: "Soundboard Favorites", icon: "⭐", category: "Audio" }
};

/**
 * Get feature usage breakdown across a time range with signed-in vs guest user counts
 */
export function getFeatureUsageStats(startTime, endTime = Date.now()) {
	try {
		const rows = db.prepare(`
			SELECT 
				type,
				COUNT(*) as total_uses,
				COUNT(DISTINCT CASE WHEN user_id > 0 THEN user_id ELSE NULL END) as signed_in_users,
				COUNT(DISTINCT CASE WHEN user_id = 0 AND guest_id IS NOT NULL THEN guest_id ELSE NULL END) as guest_users
			FROM activity_log
			WHERE (timestamp >= ? AND timestamp <= ?)
			   OR (timestamp = 0 AND datetime(created_at) >= datetime(?, 'unixepoch') AND datetime(created_at) <= datetime(?, 'unixepoch'))
			GROUP BY type
		`).all(startTime, endTime, Math.floor(startTime / 1000), Math.floor(endTime / 1000));

		const featureMap = {};
		for (const r of rows) {
			const info = FEATURE_INFO[r.type] || { name: r.type, icon: "⚡", category: "Other" };
			const signedIn = r.signed_in_users || 0;
			const guests = r.guest_users || 0;
			const totalUnique = signedIn + guests;
			featureMap[r.type] = {
				type: r.type,
				name: info.name,
				icon: info.icon,
				category: info.category,
				totalUses: r.total_uses,
				signedInUsers: signedIn,
				guestUsers: guests,
				totalUsers: totalUnique
			};
		}
		return featureMap;
	} catch (e) {
		return {};
	}
}
