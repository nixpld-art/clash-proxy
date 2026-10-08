import db from "../db.js";
import { extractAuthUser } from "../auth-utils.js";
import { broadcastGlobalChat } from "../presence.js";

export default async function chatRoutes(fastify, options) {
	// Helper: Check if two users are accepted friends
	function areFriends(userId1, userId2) {
		const row = db.prepare(`
			SELECT id FROM friendships
			WHERE status = 'accepted'
			  AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
		`).get(userId1, userId2, userId2, userId1);
		return !!row;
	}

	// GET /api/chat/unread
	fastify.get("/api/chat/unread", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const unreadRows = db.prepare(`
			SELECT sender_id, COUNT(*) as unread_count
			FROM messages
			WHERE receiver_id = ? AND is_read = 0
			GROUP BY sender_id
		`).all(auth.id);

		let totalUnread = 0;
		const unreadBySender = {};
		for (const row of unreadRows) {
			unreadBySender[row.sender_id] = row.unread_count;
			totalUnread += row.unread_count;
		}

		return { success: true, totalUnread, unreadBySender };
	});

	// GET /api/chat/conversations - List all friend conversations with latest message & unread count
	fastify.get("/api/chat/conversations", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const friendRows = db.prepare(`
			SELECT 
				u.id, u.username, u.display_name, u.avatar_url, u.role, u.custom_tag
			FROM friendships f
			JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
			WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
			ORDER BY u.display_name ASC
		`).all(auth.id, auth.id, auth.id);

		const conversations = friendRows.map(friend => {
			const lastMsg = db.prepare(`
				SELECT id, sender_id, receiver_id, content, type, meta_json, created_at
				FROM messages
				WHERE (sender_id = ? AND receiver_id = ?)
				   OR (sender_id = ? AND receiver_id = ?)
				ORDER BY id DESC
				LIMIT 1
			`).get(auth.id, friend.id, friend.id, auth.id);

			const unread = db.prepare(`
				SELECT COUNT(*) as count
				FROM messages
				WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
			`).get(friend.id, auth.id)?.count || 0;

			return {
				friend: {
					id: friend.id,
					username: friend.username,
					displayName: friend.display_name || friend.username,
					avatarUrl: friend.avatar_url || "avatar-1",
					role: friend.role,
					customTag: friend.custom_tag
				},
				lastMessage: lastMsg ? {
					id: lastMsg.id,
					senderId: lastMsg.sender_id,
					content: lastMsg.content,
					type: lastMsg.type,
					createdAt: lastMsg.created_at
				} : null,
				unreadCount: unread
			};
		});

		conversations.sort((a, b) => {
			const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
			const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
			return timeB - timeA;
		});

		return { success: true, conversations };
	});

	// GET /api/chat/:friendId
	fastify.get("/api/chat/:friendId", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const friendId = parseInt(req.params.friendId, 10);
		if (isNaN(friendId) || friendId === auth.id) {
			return reply.code(400).send({ error: "Invalid friend ID" });
		}

		if (!areFriends(auth.id, friendId)) {
			return reply.code(403).send({ error: "You can only view chat messages with accepted friends." });
		}

		// Retrieve last 50 messages in chronological order
		const messages = db.prepare(`
			SELECT * FROM (
				SELECT id, sender_id, receiver_id, content, type, meta_json, is_read, created_at
				FROM messages
				WHERE (sender_id = ? AND receiver_id = ?)
				   OR (sender_id = ? AND receiver_id = ?)
				ORDER BY id DESC
				LIMIT 50
			) ORDER BY id ASC
		`).all(auth.id, friendId, friendId, auth.id);

		// Mark any incoming messages as read
		db.prepare(`
			UPDATE messages
			SET is_read = 1
			WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
		`).run(friendId, auth.id);

		return { success: true, messages };
	});

	// POST /api/chat/:friendId/read
	fastify.post("/api/chat/:friendId/read", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const friendId = parseInt(req.params.friendId, 10);
		if (isNaN(friendId)) {
			return reply.code(400).send({ error: "Invalid friend ID" });
		}

		const result = db.prepare(`
			UPDATE messages
			SET is_read = 1
			WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
		`).run(friendId, auth.id);

		return { success: true, markedRead: result.changes };
	});

	// GET /api/chat/global - Fetch recent global community chat messages
	fastify.get("/api/chat/global", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) {
			return reply.code(401).send({ error: "Please sign in with a username and password to view and participate in Community Chat." });
		}

		const rows = db.prepare(`
			SELECT 
				gm.id, gm.user_id as userId, gm.content, gm.created_at as createdAt,
				u.username, u.display_name as displayName, u.avatar_url as avatarUrl,
				u.role, u.custom_tag as customTag, u.equipped_frame as frame,
				u.equipped_name_theme as nameTheme, u.equipped_chat_theme as chatTheme
			FROM global_messages gm
			JOIN users u ON u.id = gm.user_id
			ORDER BY gm.id DESC
			LIMIT 60
		`).all();

		rows.reverse();

		return { success: true, messages: rows };
	});

	// POST /api/chat/global - Send a message to global community chat
	fastify.post("/api/chat/global", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) {
			return reply.code(401).send({ error: "You must sign in with a username and password to chat." });
		}

		const content = String(req.body?.content || "").trim().slice(0, 500);
		if (!content) {
			return reply.code(400).send({ error: "Message content cannot be empty." });
		}

		const user = db.prepare("SELECT role, custom_tag, display_name, avatar_url, equipped_frame, equipped_name_theme, equipped_chat_theme, banned, banned_until, muted, muted_until FROM users WHERE id = ?").get(auth.id);
		if (!user) return reply.code(404).send({ error: "User account not found." });

		if (user.banned) {
			if (user.banned_until && Date.now() >= user.banned_until) {
				db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?").run(auth.id);
			} else {
				return reply.code(403).send({ error: "Your account is suspended." });
			}
		}

		if (user.muted) {
			if (user.muted_until && Date.now() >= user.muted_until) {
				db.prepare("UPDATE users SET muted = 0, muted_until = NULL WHERE id = ?").run(auth.id);
			} else {
				return reply.code(403).send({ error: "You are currently muted." });
			}
		}

		const insertResult = db.prepare(`
			INSERT INTO global_messages (user_id, content) VALUES (?, ?)
		`).run(auth.id, content);

		const messageObj = {
			id: insertResult.lastInsertRowid,
			userId: auth.id,
			username: auth.username,
			displayName: user.display_name || auth.username,
			avatarUrl: user.avatar_url || "avatar-1",
			role: user.role || "user",
			customTag: user.custom_tag || null,
			frame: user.equipped_frame || "none",
			nameTheme: user.equipped_name_theme || "none",
			chatTheme: user.equipped_chat_theme || "none",
			content,
			createdAt: new Date().toISOString()
		};

		try {
			broadcastGlobalChat(messageObj);
		} catch (e) {}

		return { success: true, message: messageObj };
	});
}
