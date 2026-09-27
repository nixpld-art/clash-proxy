import db from "../db.js";
import { extractAuthUser } from "../auth-utils.js";

export default async function savesRoutes(fastify, options) {
	// Middleware check for authenticated user
	fastify.addHook("preHandler", async (req, reply) => {
		if (req.url.startsWith("/api/saves")) {
			const auth = extractAuthUser(req);
			if (!auth) {
				return reply.code(401).send({ error: "Please sign in to access CloudVault game saves." });
			}
			req.authUser = auth;
		}
	});

	// GET /api/saves - List all game save states for current user
	fastify.get("/api/saves", async (req, reply) => {
		const saves = db.prepare(`
			SELECT id, game_key, save_name, slot_index, length(save_data) as size_bytes, created_at, updated_at
			FROM game_saves
			WHERE user_id = ?
			ORDER BY updated_at DESC
		`).all(req.authUser.id);

		return { success: true, saves };
	});

	// GET /api/saves/:gameKey - Retrieve save slots for a specific game
	fastify.get("/api/saves/:gameKey", async (req, reply) => {
		const { gameKey } = req.params;
		const cleanKey = String(gameKey).trim().toLowerCase();

		const saves = db.prepare(`
			SELECT id, game_key, save_name, save_data, slot_index, created_at, updated_at
			FROM game_saves
			WHERE user_id = ? AND game_key = ?
			ORDER BY slot_index ASC
		`).all(req.authUser.id, cleanKey);

		return { success: true, gameKey: cleanKey, saves };
	});

	// POST /api/saves/:gameKey - Create or update a save slot snapshot
	fastify.post("/api/saves/:gameKey", async (req, reply) => {
		const { gameKey } = req.params;
		const { saveData, saveName, slotIndex = 0 } = req.body || {};
		const cleanKey = String(gameKey).trim().toLowerCase();

		if (!saveData) {
			return reply.code(400).send({ error: "Save data cannot be empty." });
		}

		const slot = Math.max(0, Math.min(9, parseInt(slotIndex, 10) || 0));
		const label = saveName ? String(saveName).slice(0, 50) : `Slot ${slot + 1} (${new Date().toLocaleDateString()})`;
		const serializedData = typeof saveData === "string" ? saveData : JSON.stringify(saveData);

		const now = new Date().toISOString();

		db.prepare(`
			INSERT INTO game_saves (user_id, game_key, save_name, save_data, slot_index, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, game_key, slot_index) 
			DO UPDATE SET 
				save_name = excluded.save_name,
				save_data = excluded.save_data,
				updated_at = excluded.updated_at
		`).run(req.authUser.id, cleanKey, label, serializedData, slot, now, now);

		const saved = db.prepare(`
			SELECT id, game_key, save_name, slot_index, created_at, updated_at
			FROM game_saves
			WHERE user_id = ? AND game_key = ? AND slot_index = ?
		`).get(req.authUser.id, cleanKey, slot);

		return {
			success: true,
			message: `Game progress synced to CloudVault (${saved.save_name})!`,
			save: saved
		};
	});

	// DELETE /api/saves/:id - Delete a specific save state
	fastify.delete("/api/saves/:id", async (req, reply) => {
		const saveId = parseInt(req.params.id, 10);
		const result = db.prepare("DELETE FROM game_saves WHERE id = ? AND user_id = ?").run(saveId, req.authUser.id);

		if (result.changes === 0) {
			return reply.code(404).send({ error: "Save state not found or unauthorized." });
		}

		return { success: true, message: "Save snapshot deleted." };
	});
}
