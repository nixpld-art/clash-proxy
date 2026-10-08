import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");

try {
	mkdirSync(dataDir, { recursive: true });
} catch (e) {}

const dbPath = join(dataDir, "clash.db");
const db = new Database(dbPath);

// Enable WAL mode for high performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize Schema
db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL COLLATE NOCASE,
		password_hash TEXT NOT NULL,
		display_name TEXT,
		avatar_url TEXT DEFAULT 'avatar-1',
		bio TEXT DEFAULT 'Cruising the web with Clash Proxy.',
		xp INTEGER DEFAULT 0,
		level INTEGER DEFAULT 1,
		streak_days INTEGER DEFAULT 1,
		last_login_date TEXT,
		settings_json TEXT DEFAULT '{"theme":"neon-purple","ghostMode":false,"soundEffects":true}',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS friendships (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		friend_id INTEGER NOT NULL,
		status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'blocked')),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE(user_id, friend_id)
	);

	CREATE TABLE IF NOT EXISTS achievements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		badge_id TEXT NOT NULL,
		unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE(user_id, badge_id)
	);

	CREATE TABLE IF NOT EXISTS activity_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		type TEXT NOT NULL,
		data_json TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS bookmarks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		url TEXT NOT NULL,
		icon TEXT,
		category TEXT DEFAULT 'favorites',
		is_game INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		receiver_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		type TEXT DEFAULT 'text',
		meta_json TEXT,
		is_read INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
	CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, status);
	CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id, status);
	CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, category);
	CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id, created_at);
	CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read);

	CREATE TABLE IF NOT EXISTS game_saves (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		game_key TEXT NOT NULL,
		save_name TEXT DEFAULT 'Save Slot',
		save_data TEXT NOT NULL,
		slot_index INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE(user_id, game_key, slot_index)
	);

	CREATE TABLE IF NOT EXISTS user_cosmetics (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		item_id TEXT NOT NULL,
		item_type TEXT NOT NULL,
		acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE(user_id, item_id)
	);

	CREATE TABLE IF NOT EXISTS userscripts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		name TEXT NOT NULL,
		match_pattern TEXT DEFAULT '*',
		script_code TEXT NOT NULL,
		is_enabled INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS global_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_game_saves_user ON game_saves(user_id, game_key);
	CREATE INDEX IF NOT EXISTS idx_user_cosmetics_user ON user_cosmetics(user_id);
	CREATE INDEX IF NOT EXISTS idx_userscripts_user ON userscripts(user_id);
	CREATE INDEX IF NOT EXISTS idx_global_messages_created ON global_messages(created_at);
`);

// Safe migrations for bookmarks columns
try {
	const cols = db.prepare("PRAGMA table_info(bookmarks)").all().map(c => c.name);
	if (!cols.includes("icon")) {
		if (cols.includes("icon_url")) {
			db.exec("ALTER TABLE bookmarks RENAME COLUMN icon_url TO icon");
		} else {
			db.exec("ALTER TABLE bookmarks ADD COLUMN icon TEXT");
		}
	}
	if (!cols.includes("is_game")) {
		db.exec("ALTER TABLE bookmarks ADD COLUMN is_game INTEGER DEFAULT 0");
	}
} catch (e) {
	console.warn("[DB] Bookmarks migration notice:", e.message);
}

// Safe migrations for users columns (role, custom_tag, overrides, coins, cosmetics)
try {
	const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
	if (!userCols.includes("role")) {
		db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
	}
	if (!userCols.includes("custom_tag")) {
		db.exec("ALTER TABLE users ADD COLUMN custom_tag TEXT DEFAULT NULL");
	}
	if (!userCols.includes("games_played_override")) {
		db.exec("ALTER TABLE users ADD COLUMN games_played_override INTEGER DEFAULT NULL");
	}
	if (!userCols.includes("sites_visited_override")) {
		db.exec("ALTER TABLE users ADD COLUMN sites_visited_override INTEGER DEFAULT NULL");
	}
	if (!userCols.includes("coins")) {
		db.exec("ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 350");
	}
	if (!userCols.includes("equipped_frame")) {
		db.exec("ALTER TABLE users ADD COLUMN equipped_frame TEXT DEFAULT 'none'");
	}
	if (!userCols.includes("equipped_name_theme")) {
		db.exec("ALTER TABLE users ADD COLUMN equipped_name_theme TEXT DEFAULT 'none'");
	}
	if (!userCols.includes("equipped_chat_theme")) {
		db.exec("ALTER TABLE users ADD COLUMN equipped_chat_theme TEXT DEFAULT 'none'");
	}
	if (!userCols.includes("equipped_title")) {
		db.exec("ALTER TABLE users ADD COLUMN equipped_title TEXT DEFAULT 'none'");
	}
	if (!userCols.includes("banned")) {
		db.exec("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0");
	}
	if (!userCols.includes("muted")) {
		db.exec("ALTER TABLE users ADD COLUMN muted INTEGER DEFAULT 0");
	}
	if (!userCols.includes("banned_until")) {
		db.exec("ALTER TABLE users ADD COLUMN banned_until INTEGER DEFAULT NULL");
	}
	if (!userCols.includes("muted_until")) {
		db.exec("ALTER TABLE users ADD COLUMN muted_until INTEGER DEFAULT NULL");
	}
	if (!userCols.includes("last_ip")) {
		db.exec("ALTER TABLE users ADD COLUMN last_ip TEXT DEFAULT NULL");
	}
	// NOTE: the old boot-time auto-promotion of ted/nils was removed —
	// owner is granted ONLY by registering with the owner key (auth.js).
} catch (e) {
	console.warn("[DB] Users migration notice:", e.message);
}

export default db;
