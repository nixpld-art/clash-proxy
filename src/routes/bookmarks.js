import db from "../db.js";
import { extractAuthUser } from "../auth-utils.js";

const DEFAULT_BOOKMARKS = [
	{ title: "Google", url: "https://www.google.com", icon: "🌐", category: "favorites", is_game: 0 },
	{ title: "YouTube", url: "https://www.youtube.com", icon: "▶️", category: "favorites", is_game: 0 },
	{ title: "Discord", url: "https://discord.com", icon: "💬", category: "favorites", is_game: 0 },
	{ title: "Wikipedia", url: "https://www.wikipedia.org", icon: "📚", category: "favorites", is_game: 0 },
	{ title: "Drive Mad", url: "/games/cldrivemady.html", icon: "🚗", category: "arcade", is_game: 1 },
	{ title: "Retro Bowl", url: "/games/clretrobowl.html", icon: "🏈", category: "arcade", is_game: 1 },
	{ title: "1v1.LOL", url: "/games/cl1v1lol.html", icon: "🎯", category: "arcade", is_game: 1 },
	{ title: "Slope", url: "/games/clslope.html", icon: "⚡", category: "arcade", is_game: 1 }
];

export default async function bookmarksRoutes(fastify, options) {
	// GET /api/bookmarks
	fastify.get("/api/bookmarks", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		let bookmarks = db.prepare("SELECT * FROM bookmarks WHERE user_id = ? ORDER BY id ASC").all(auth.id);

		// Seed initial default bookmarks if newly registered / empty
		if (bookmarks.length === 0) {
			const insertStmt = db.prepare(`
				INSERT INTO bookmarks (user_id, title, url, icon, category, is_game)
				VALUES (?, ?, ?, ?, ?, ?)
			`);
			for (const b of DEFAULT_BOOKMARKS) {
				insertStmt.run(auth.id, b.title, b.url, b.icon, b.category, b.is_game);
			}
			bookmarks = db.prepare("SELECT * FROM bookmarks WHERE user_id = ? ORDER BY id ASC").all(auth.id);
		}

		return { success: true, bookmarks };
	});

	// POST /api/bookmarks
	fastify.post("/api/bookmarks", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const { title, url, icon, category = "favorites", is_game = 0 } = req.body || {};
		if (!title || !url) {
			return reply.code(400).send({ error: "Title and URL are required." });
		}

		const cleanTitle = String(title).trim().slice(0, 60);
		const cleanUrl = String(url).trim();
		const cleanCategory = String(category).trim().slice(0, 30) || "favorites";
		const cleanIcon = icon ? String(icon).trim().slice(0, 100) : (is_game ? "🎮" : "🌐");
		const isGameFlag = is_game || cleanUrl.includes("/games/") || cleanUrl.endsWith(".html") ? 1 : 0;

		// Check if already bookmarked
		const existing = db.prepare("SELECT * FROM bookmarks WHERE user_id = ? AND url = ?").get(auth.id, cleanUrl);
		if (existing) {
			return reply.code(409).send({ error: "Already bookmarked", bookmark: existing });
		}

		const result = db.prepare(`
			INSERT INTO bookmarks (user_id, title, url, icon, category, is_game)
			VALUES (?, ?, ?, ?, ?, ?)
		`).run(auth.id, cleanTitle, cleanUrl, cleanIcon, cleanCategory, isGameFlag);

		const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(result.lastInsertRowid);
		return { success: true, bookmark };
	});

	// DELETE /api/bookmarks/:id
	fastify.delete("/api/bookmarks/:id", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const bookmarkId = req.params.id;
		const result = db.prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?").run(bookmarkId, auth.id);

		if (result.changes === 0) {
			return reply.code(404).send({ error: "Bookmark not found or unauthorized." });
		}

		return { success: true };
	});
}
