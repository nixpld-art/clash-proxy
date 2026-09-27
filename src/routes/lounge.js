import { getLoungeRooms, getLoungeRoom, createLoungeRoom } from "../presence.js";
import { verifyToken } from "../auth-utils.js";
import db from "../db.js";

export default async function loungeRoutes(fastify, options) {
	// GET /api/lounge/rooms - List all active public lounge rooms
	fastify.get("/api/lounge/rooms", async (req, reply) => {
		const rooms = getLoungeRooms();
		return { rooms };
	});

	// GET /api/lounge/room/:code - Get single room status
	fastify.get("/api/lounge/room/:code", async (req, reply) => {
		const { code } = req.params;
		const room = getLoungeRoom(code);
		if (!room) {
			return reply.code(404).send({ error: "Lounge party room not found or has ended." });
		}
		return { room };
	});

	// POST /api/lounge/create - Create a new party room
	fastify.post("/api/lounge/create", async (req, reply) => {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return reply.code(401).send({ error: "Please sign in to host a Clash Lounge party room." });
		}

		const token = authHeader.slice(7);
		const decoded = verifyToken(token);
		if (!decoded) {
			return reply.code(401).send({ error: "Invalid authentication session." });
		}

		const { name, featuredGame, featuredGameUrl, isPublic = true, maxMembers = 8 } = req.body || {};

		const user = db.prepare("SELECT username, display_name, avatar_url FROM users WHERE id = ?").get(decoded.id);
		const host = {
			id: decoded.id,
			username: user?.username || decoded.username,
			displayName: user?.display_name || user?.username || decoded.username,
			avatarUrl: user?.avatar_url || "avatar-1"
		};

		const room = createLoungeRoom({
			host,
			name: String(name || `${host.displayName}'s Party`).slice(0, 40),
			featuredGame: featuredGame ? String(featuredGame).slice(0, 50) : "Free Play",
			featuredGameUrl: featuredGameUrl ? String(featuredGameUrl).slice(0, 200) : null,
			isPublic: !!isPublic,
			maxMembers: Math.min(16, Math.max(2, parseInt(maxMembers, 10) || 8))
		});

		return { room };
	});
}
