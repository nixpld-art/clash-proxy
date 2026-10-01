import db from "../db.js";
import { extractAuthUser, awardAchievement, addXp } from "../auth-utils.js";
import { notifyUser } from "../presence.js";

export default async function friendsRoutes(fastify) {
	// List friends and pending requests
	fastify.get("/api/friends", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		// Accepted friends
		const friends = db.prepare(`
			SELECT 
				f.id as friendship_id,
				f.created_at as friendship_date,
				u.id, u.username, u.display_name, u.avatar_url, u.level, u.xp, u.role, u.custom_tag
			FROM friendships f
			JOIN users u ON (
				CASE 
					WHEN f.user_id = ? THEN f.friend_id = u.id 
					ELSE f.user_id = u.id 
				END
			)
			WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
			ORDER BY u.display_name ASC
		`).all(auth.id, auth.id, auth.id);

		// Incoming pending requests
		const incoming = db.prepare(`
			SELECT 
				f.id as friendship_id,
				f.created_at,
				u.id as user_id, u.username, u.display_name, u.avatar_url, u.level, u.role, u.custom_tag
			FROM friendships f
			JOIN users u ON f.user_id = u.id
			WHERE f.friend_id = ? AND f.status = 'pending'
			ORDER BY f.created_at DESC
		`).all(auth.id);

		// Outgoing pending requests
		const outgoing = db.prepare(`
			SELECT 
				f.id as friendship_id,
				f.created_at,
				u.id as friend_id, u.username, u.display_name, u.avatar_url, u.level, u.role, u.custom_tag
			FROM friendships f
			JOIN users u ON f.friend_id = u.id
			WHERE f.user_id = ? AND f.status = 'pending'
			ORDER BY f.created_at DESC
		`).all(auth.id);

		return {
			success: true,
			friends,
			incoming,
			outgoing
		};
	});

	// Send friend request
	fastify.post("/api/friends/request", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const { username } = req.body || {};
		if (!username || typeof username !== "string") {
			return reply.code(400).send({ error: "Username is required." });
		}

		const target = db.prepare("SELECT id, username, display_name FROM users WHERE username = ?").get(username.trim());
		if (!target) {
			return reply.code(404).send({ error: `User "${username}" was not found.` });
		}

		if (target.id === auth.id) {
			return reply.code(400).send({ error: "You cannot add yourself as a friend." });
		}

		// Check if friendship already exists
		const existing = db.prepare(`
			SELECT id, user_id, friend_id, status FROM friendships
			WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
		`).get(auth.id, target.id, target.id, auth.id);

		if (existing) {
			if (existing.status === "accepted") {
				return reply.code(400).send({ error: `You are already friends with ${target.username}.` });
			}
			if (existing.status === "pending") {
				if (existing.user_id === auth.id) {
					return reply.code(400).send({ error: "Friend request is already pending." });
				} else {
					// Other user already sent us a request! Auto-accept it!
					db.prepare("UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(existing.id);
					awardAchievement(auth.id, "socialite");
					awardAchievement(target.id, "socialite");
					addXp(auth.id, 25, "Made a new friend!");
					addXp(target.id, 25, "Made a new friend!");

					notifyUser(target.id, {
						type: "friend_accepted",
						user: { id: auth.id, username: auth.username, display_name: auth.displayName }
					});

					return { success: true, message: `Accepted friend request from ${target.username}!` };
				}
			}
			if (existing.status === "blocked") {
				return reply.code(403).send({ error: "Unable to send friend request." });
			}
		}

		// Create request
		db.prepare(`
			INSERT INTO friendships (user_id, friend_id, status)
			VALUES (?, ?, 'pending')
		`).run(auth.id, target.id);

		notifyUser(target.id, {
			type: "friend_request",
			from: { id: auth.id, username: auth.username, display_name: auth.displayName }
		});

		return {
			success: true,
			message: `Friend request sent to ${target.username}!`
		};
	});

	// Respond to friend request (accept / decline)
	fastify.post("/api/friends/respond", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const { friendshipId, action } = req.body || {};
		if (!friendshipId || !action) {
			return reply.code(400).send({ error: "friendshipId and action are required." });
		}

		const request = db.prepare(`
			SELECT f.id, f.user_id, f.friend_id, u.username, u.display_name
			FROM friendships f
			JOIN users u ON f.user_id = u.id
			WHERE f.id = ? AND f.friend_id = ? AND f.status = 'pending'
		`).get(friendshipId, auth.id);

		if (!request) {
			return reply.code(404).send({ error: "Friend request not found or already processed." });
		}

		if (action === "accept") {
			db.prepare("UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(friendshipId);
			awardAchievement(auth.id, "socialite");
			awardAchievement(request.user_id, "socialite");
			addXp(auth.id, 25, "Made a new friend!");
			addXp(request.user_id, 25, "Made a new friend!");

			notifyUser(request.user_id, {
				type: "friend_accepted",
				user: { id: auth.id, username: auth.username, display_name: auth.displayName }
			});

			return { success: true, message: `You and ${request.username} are now friends!` };
		} else if (action === "decline") {
			db.prepare("DELETE FROM friendships WHERE id = ?").run(friendshipId);
			return { success: true, message: "Friend request declined." };
		}

		return reply.code(400).send({ error: "Invalid action." });
	});

	// Remove friend
	fastify.delete("/api/friends/:id", async (req, reply) => {
		const auth = extractAuthUser(req);
		if (!auth) return reply.code(401).send({ error: "Unauthorized" });

		const { id } = req.params;
		if (!id) return reply.code(400).send({ error: "ID required" });

		const res = db.prepare(`
			DELETE FROM friendships
			WHERE id = ? AND (user_id = ? OR friend_id = ?)
		`).run(id, auth.id, auth.id);

		if (res.changes === 0) {
			return reply.code(404).send({ error: "Friendship not found." });
		}

		return { success: true, message: "Friend removed." };
	});
}
