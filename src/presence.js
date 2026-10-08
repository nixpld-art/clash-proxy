import { WebSocketServer } from "ws";
import { readFileSync } from "node:fs";
import db from "./db.js";
import { verifyToken } from "./auth-utils.js";
import { touchUserActive, touchGuestActive, recordActivity } from "./activity.js";

// Active user sockets: userId -> Set<WebSocket>
const activeSockets = new Map();
// Active user activity state: userId -> { status, activity, lastSeen, ghostMode }
const userPresence = new Map();
// Anonymous guest presence: guestId -> { lastSeen, ip }
const guestPresence = new Map();

export function touchGuestPresence(guestId, ip = "") {
	const gid = String(guestId || "").trim();
	if (!gid) return;
	guestPresence.set(gid, { lastSeen: Date.now(), ip });
	touchGuestActive(gid, ip);
}

export function getGuestPresenceStats() {
	const now = Date.now();
	let online = 0;
	for (const g of guestPresence.values()) {
		if (now - g.lastSeen <= 120_000) online++;
	}
	return online;
}

setInterval(() => {
	const now = Date.now();
	for (const [gid, g] of guestPresence.entries()) {
		if (now - g.lastSeen > 120_000) guestPresence.delete(gid);
	}
}, 30_000).unref?.();

// ============================================================
// Clash Lounge Party Rooms State
// ============================================================
// roomCode -> room object
const loungeRooms = new Map();
// userId -> roomCode
const userToRoom = new Map();

// ============================================================
// Owner Panel chat controls (freeze / slowmode / filter / mute)
// ============================================================
let chatCfgCache = { raw: null, val: null };
function getChatConfig() {
	try {
		const raw = readFileSync(new URL("../data/chat-config.json", import.meta.url), "utf8");
		if (chatCfgCache.raw !== raw) chatCfgCache = { raw, val: JSON.parse(raw) };
		return chatCfgCache.val || {};
	} catch {
		return {};
	}
}

const lastChatAt = new Map();

function formatRemaining(ms) {
	const m = Math.max(1, Math.ceil(ms / 60000));
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ${m % 60}m`;
	return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// Returns an error string to block the message, or null to allow it.
// Call with the message content so the word filter can inspect it.
function moderateOutgoing(userId, content) {
	try {
		const cfg = getChatConfig();
		const user = db.prepare("SELECT role, muted, muted_until, banned, banned_until FROM users WHERE id = ?").get(userId);
		if (user?.banned) {
			if (user.banned_until && Date.now() >= user.banned_until) {
				db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?").run(userId);
			} else {
				return "Your account is currently suspended.";
			}
		}
		const staff = user?.role === "admin" || user?.role === "staff";
		if (user?.muted) {
			if (user.muted_until && Date.now() >= user.muted_until) {
				// Timed-out expired — auto-lift
				db.prepare("UPDATE users SET muted = 0, muted_until = NULL WHERE id = ?").run(userId);
			} else {
				return user.muted_until
					? `You are timed out for another ${formatRemaining(user.muted_until - Date.now())}.`
					: "You are muted by the network team.";
			}
		}
		if (cfg.freeze && !staff) return "Public chat is frozen — only administrators can send messages.";
		if (!staff && Number(cfg.slowmodeSeconds) > 0) {
			const last = lastChatAt.get(userId) || 0;
			const wait = Number(cfg.slowmodeSeconds) * 1000 - (Date.now() - last);
			if (wait > 0) return `Slowmode active — wait ${Math.ceil(wait / 1000)}s.`;
		}
		if (cfg.filterEnabled) {
			const words = Array.isArray(cfg.filterWords) ? cfg.filterWords : [];
			const low = String(content || "").toLowerCase();
			if (words.some((w) => w && low.includes(String(w).toLowerCase()))) {
				return "Message blocked by the network filter.";
			}
		}
		lastChatAt.set(userId, Date.now());
	} catch {}
	return null;
}

function formatRoom(room) {
	return {
		code: room.code,
		name: room.name,
		host: room.host,
		featuredGame: room.featuredGame,
		featuredGameUrl: room.featuredGameUrl,
		isPublic: room.isPublic,
		maxMembers: room.maxMembers,
		members: Array.from(room.members.values()),
		createdAt: room.createdAt
	};
}

export function getLoungeRooms() {
	return Array.from(loungeRooms.values())
		.filter(r => r.isPublic)
		.map(r => ({
			code: r.code,
			name: r.name,
			host: r.host,
			featuredGame: r.featuredGame,
			featuredGameUrl: r.featuredGameUrl,
			memberCount: r.members.size,
			maxMembers: r.maxMembers,
			createdAt: r.createdAt
		}));
}

export function getLoungeRoom(code) {
	const room = loungeRooms.get(String(code).trim().toUpperCase());
	if (!room) return null;
	return formatRoom(room);
}

export function createLoungeRoom({ host, name, featuredGame, featuredGameUrl, isPublic = true, maxMembers = 8 }) {
	let code;
	do {
		const num = Math.floor(1000 + Math.random() * 9000);
		code = `CLASH-${num}`;
	} while (loungeRooms.has(code));

	leaveLoungeRoom(host.id);

	const room = {
		code,
		name,
		host,
		featuredGame: featuredGame || "Free Play",
		featuredGameUrl: featuredGameUrl || null,
		isPublic: !!isPublic,
		maxMembers: Math.min(16, Math.max(2, maxMembers)),
		members: new Map(),
		createdAt: Date.now()
	};

	room.members.set(host.id, {
		id: host.id,
		username: host.username,
		displayName: host.displayName,
		avatarUrl: host.avatarUrl,
		isHost: true,
		activity: "In Lounge"
	});

	loungeRooms.set(code, room);
	userToRoom.set(host.id, code);

	return formatRoom(room);
}

export function joinLoungeRoom(code, user) {
	const room = loungeRooms.get(String(code).trim().toUpperCase());
	if (!room) return { error: "Room not found or has expired." };
	if (room.members.size >= room.maxMembers && !room.members.has(user.id)) {
		return { error: "This room is currently full." };
	}

	leaveLoungeRoom(user.id);

	const memberObj = {
		id: user.id,
		username: user.username,
		displayName: user.displayName || user.username,
		avatarUrl: user.avatarUrl || "avatar-1",
		isHost: user.id === room.host.id,
		activity: "In Lounge"
	};

	room.members.set(user.id, memberObj);
	userToRoom.set(user.id, room.code);

	broadcastToRoom(room.code, {
		type: "lounge_user_joined",
		room: formatRoom(room),
		user: memberObj
	});

	return { room: formatRoom(room) };
}

export function leaveLoungeRoom(userId) {
	const code = userToRoom.get(userId);
	if (!code) return;

	userToRoom.delete(userId);
	const room = loungeRooms.get(code);
	if (!room) return;

	const departingUser = room.members.get(userId);
	room.members.delete(userId);

	if (room.members.size === 0) {
		loungeRooms.delete(code);
		return;
	}

	if (room.host.id === userId) {
		const nextHost = Array.from(room.members.values())[0];
		nextHost.isHost = true;
		room.host = {
			id: nextHost.id,
			username: nextHost.username,
			displayName: nextHost.displayName,
			avatarUrl: nextHost.avatarUrl
		};
	}

	broadcastToRoom(code, {
		type: "lounge_user_left",
		room: formatRoom(room),
		userId,
		user: departingUser
	});
}

export function broadcastToRoom(roomCode, payload) {
	const room = loungeRooms.get(roomCode);
	if (!room) return;
	const msg = JSON.stringify(payload);
	for (const member of room.members.values()) {
		const sockets = activeSockets.get(member.id);
		if (sockets) {
			for (const ws of sockets) {
				if (ws.readyState === ws.OPEN) {
					ws.send(msg);
				}
			}
		}
	}
}

export function broadcastGlobalChat(messageObj) {
	const msg = JSON.stringify({
		type: "global_chat_message",
		message: messageObj
	});
	for (const sockets of activeSockets.values()) {
		for (const ws of sockets) {
			if (ws.readyState === ws.OPEN) {
				ws.send(msg);
			}
		}
	}
}

export const presenceWss = new WebSocketServer({ noServer: true });

presenceWss.on("connection", (ws, req) => {
	let currentUserId = null;

	ws.on("message", (raw) => {
		try {
			const data = JSON.parse(raw.toString());

			if (data.type === "auth") {
				const decoded = verifyToken(data.token);
				if (!decoded) {
					ws.send(JSON.stringify({ type: "error", message: "Invalid auth token" }));
					return;
				}

				currentUserId = decoded.id;

				const user = db.prepare("SELECT settings_json, banned, banned_until FROM users WHERE id = ?").get(currentUserId);
				if (!user) {
					ws.send(JSON.stringify({ type: "error", message: "Account not found." }));
					ws.close(4001, "not_found");
					return;
				}

				if (user.banned) {
					if (user.banned_until && Date.now() >= user.banned_until) {
						db.prepare("UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?").run(currentUserId);
						user.banned = 0;
					} else {
						const banMsg = user.banned_until
							? `Account suspended for another ${formatRemaining(user.banned_until - Date.now())}.`
							: "Account permanently suspended by network administrators.";
						ws.send(JSON.stringify({ type: "kicked", message: banMsg, banned: true }));
						ws.close(4003, "banned");
						return;
					}
				}

				if (!activeSockets.has(currentUserId)) {
					activeSockets.set(currentUserId, new Set());
				}
				activeSockets.get(currentUserId).add(ws);

				const settings = JSON.parse(user?.settings_json || "{}");
				const ghostMode = !!settings.ghostMode;

				userPresence.set(currentUserId, {
					userId: currentUserId,
					username: decoded.username,
					status: ghostMode ? "offline" : "online",
					activity: ghostMode ? null : "Browsing",
					lastSeen: Date.now(),
					ghostMode
				});
				touchUserActive(currentUserId);

				ws.send(JSON.stringify({
					type: "auth_success",
					userId: currentUserId,
					presence: userPresence.get(currentUserId)
				}));

				if (!ghostMode) {
					broadcastPresenceToFriends(currentUserId);
				}

				sendFriendsPresence(currentUserId, ws);

				// Send current lounge room if user is already in one
				const activeRoomCode = userToRoom.get(currentUserId);
				if (activeRoomCode) {
					const room = getLoungeRoom(activeRoomCode);
					if (room) {
						ws.send(JSON.stringify({
							type: "lounge_room_update",
							room
						}));
					}
				}
			} else if (data.type === "activity" && currentUserId) {
				const current = userPresence.get(currentUserId);
				if (current && !current.ghostMode) {
					current.status = data.status || "online";
					current.activity = data.activity || null;
					current.lastSeen = Date.now();
					broadcastPresenceToFriends(currentUserId);

					// Also sync activity to current lounge party room
					const code = userToRoom.get(currentUserId);
					if (code) {
						const room = loungeRooms.get(code);
						if (room && room.members.has(currentUserId)) {
							room.members.get(currentUserId).activity = data.activity || "In Lounge";
							broadcastToRoom(code, {
								type: "lounge_room_update",
								room: formatRoom(room)
							});
						}
					}
				}
			} else if (data.type === "invite" && currentUserId) {
				const { targetUserId, gameUrl, gameTitle } = data;
				const sender = db.prepare("SELECT username, display_name, avatar_url FROM users WHERE id = ?").get(currentUserId);
				notifyUser(targetUserId, {
					type: "game_invite",
					from: {
						id: currentUserId,
						username: sender?.username,
						displayName: sender?.display_name || sender?.username,
						avatarUrl: sender?.avatar_url
					},
					gameUrl,
					gameTitle
				});
		} else if (data.type === "chat_send" && currentUserId) {
			const { receiverId, content, messageType = "text", meta = null } = data;
			if (!receiverId || !content) return;

			const modErr = moderateOutgoing(currentUserId, content);
			if (modErr) {
				ws.send(JSON.stringify({ type: "error", message: modErr }));
				return;
			}

			const targetId = parseInt(receiverId, 10);
				const areFriends = db.prepare(`
					SELECT id FROM friendships
					WHERE status = 'accepted'
					  AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
				`).get(currentUserId, targetId, targetId, currentUserId);

				if (!areFriends) {
					ws.send(JSON.stringify({ type: "error", message: "You can only message accepted friends." }));
					return;
				}

				const sender = db.prepare("SELECT username, display_name, avatar_url FROM users WHERE id = ?").get(currentUserId);
				const metaJson = meta ? JSON.stringify(meta) : null;

				const insertResult = db.prepare(`
					INSERT INTO messages (sender_id, receiver_id, content, type, meta_json, is_read)
					VALUES (?, ?, ?, ?, ?, 0)
				`).run(currentUserId, targetId, String(content).slice(0, 1000), messageType, metaJson);
				recordActivity(currentUserId, "chat_message", { receiverId: targetId });

				const messageObj = {
					id: insertResult.lastInsertRowid,
					sender_id: currentUserId,
					receiver_id: targetId,
					content: String(content).slice(0, 1000),
					type: messageType,
					meta_json: metaJson,
					is_read: 0,
					created_at: new Date().toISOString(),
					sender: {
						id: currentUserId,
						username: sender?.username,
						displayName: sender?.display_name || sender?.username,
						avatarUrl: sender?.avatar_url
					}
				};

				ws.send(JSON.stringify({
					type: "chat_sent",
					message: messageObj
				}));

				notifyUser(targetId, {
					type: "chat_message",
					message: messageObj
				});
			} else if (data.type === "chat_read" && currentUserId) {
				const { friendId } = data;
				if (friendId) {
					const targetId = parseInt(friendId, 10);
					db.prepare(`
						UPDATE messages
						SET is_read = 1
						WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
					`).run(targetId, currentUserId);

					notifyUser(targetId, {
						type: "chat_read_receipt",
						readBy: currentUserId
					});
				}
			} else if (data.type === "chat_typing" && currentUserId) {
				const { receiverId, isTyping } = data;
				if (receiverId) {
					const targetId = parseInt(receiverId, 10);
					notifyUser(targetId, {
						type: "chat_typing",
						senderId: currentUserId,
						isTyping: !!isTyping
					});
				}
			} else if (data.type === "lounge_create" && currentUserId) {
				const user = db.prepare("SELECT username, display_name, avatar_url FROM users WHERE id = ?").get(currentUserId);
				const host = {
					id: currentUserId,
					username: user?.username,
					displayName: user?.display_name || user?.username,
					avatarUrl: user?.avatar_url || "avatar-1"
				};
				const room = createLoungeRoom({
					host,
					name: String(data.name || `${host.displayName}'s Party`).slice(0, 40),
					featuredGame: data.featuredGame || "Free Play",
					featuredGameUrl: data.featuredGameUrl || null,
					isPublic: data.isPublic !== false,
					maxMembers: Math.min(16, Math.max(2, parseInt(data.maxMembers, 10) || 8))
				});
				ws.send(JSON.stringify({ type: "lounge_room_update", room }));
			} else if (data.type === "lounge_join" && currentUserId) {
				const user = db.prepare("SELECT username, display_name, avatar_url FROM users WHERE id = ?").get(currentUserId);
				const res = joinLoungeRoom(data.code, {
					id: currentUserId,
					username: user?.username,
					displayName: user?.display_name || user?.username,
					avatarUrl: user?.avatar_url || "avatar-1"
				});
				if (res.error) {
					ws.send(JSON.stringify({ type: "error", message: res.error }));
				} else {
					ws.send(JSON.stringify({ type: "lounge_room_update", room: res.room }));
				}
			} else if (data.type === "lounge_leave" && currentUserId) {
				leaveLoungeRoom(currentUserId);
				ws.send(JSON.stringify({ type: "lounge_left" }));
			} else if (data.type === "lounge_chat" && currentUserId) {
				const code = userToRoom.get(currentUserId);
				if (!code) {
					ws.send(JSON.stringify({ type: "error", message: "You are not in a Lounge party room." }));
					return;
				}
				const user = db.prepare("SELECT username, display_name, avatar_url FROM users WHERE id = ?").get(currentUserId);
				const content = String(data.content || "").trim().slice(0, 500);
				if (!content) return;

				const loungeErr = moderateOutgoing(currentUserId, content);
				if (loungeErr) {
					ws.send(JSON.stringify({ type: "error", message: loungeErr }));
					return;
				}

				broadcastToRoom(code, {
					type: "lounge_message",
					message: {
						id: Date.now() + Math.random().toString(36).slice(2, 6),
						senderId: currentUserId,
						senderName: user?.display_name || user?.username,
						senderAvatar: user?.avatar_url || "avatar-1",
						content,
						timestamp: Date.now()
					}
				});
			} else if (data.type === "lounge_set_game" && currentUserId) {
				const code = userToRoom.get(currentUserId);
				if (!code) return;
				const room = loungeRooms.get(code);
				if (!room || room.host.id !== currentUserId) {
					ws.send(JSON.stringify({ type: "error", message: "Only the party host can change the featured game." }));
					return;
				}
				room.featuredGame = String(data.gameTitle || "Free Play").slice(0, 50);
				room.featuredGameUrl = data.gameUrl ? String(data.gameUrl).slice(0, 200) : null;
				broadcastToRoom(code, {
					type: "lounge_game_changed",
					featuredGame: room.featuredGame,
					featuredGameUrl: room.featuredGameUrl,
					room: formatRoom(room)
				});
			} else if (data.type === "lounge_get_rooms") {
				ws.send(JSON.stringify({
					type: "lounge_rooms_list",
					rooms: getLoungeRooms()
				}));
			} else if (data.type === "global_chat_send" && currentUserId) {
				const content = String(data.content || "").trim().slice(0, 500);
				if (content) {
					const modErr = moderateOutgoing(currentUserId, content);
					if (modErr) {
						ws.send(JSON.stringify({ type: "error", message: modErr }));
					} else {
						const sender = db.prepare(`
							SELECT id, username, display_name, avatar_url, role, custom_tag, equipped_frame, equipped_name_theme, equipped_chat_theme
							FROM users WHERE id = ?
						`).get(currentUserId);

						const insertResult = db.prepare(`
							INSERT INTO global_messages (user_id, content) VALUES (?, ?)
						`).run(currentUserId, content);

						const messageObj = {
							id: insertResult.lastInsertRowid,
							userId: currentUserId,
							username: sender?.username || "Anonymous",
							displayName: sender?.display_name || sender?.username || "Anonymous",
							avatarUrl: sender?.avatar_url || "avatar-1",
							role: sender?.role || "user",
							customTag: sender?.custom_tag || null,
							frame: sender?.equipped_frame || "none",
							nameTheme: sender?.equipped_name_theme || "none",
							chatTheme: sender?.equipped_chat_theme || "none",
							content,
							createdAt: new Date().toISOString()
						};

						broadcastGlobalChat(messageObj);
					}
				}
			} else if (data.type === "ping") {
				if (currentUserId) touchUserActive(currentUserId);
				else if (data.guestId) touchGuestPresence(data.guestId, req.socket?.remoteAddress);
				ws.send(JSON.stringify({ type: "pong" }));
			} else if (data.type === "guest_ping" && data.guestId) {
				touchGuestPresence(data.guestId, req.socket?.remoteAddress);
				ws.send(JSON.stringify({ type: "pong", guest: true }));
			}
		} catch (err) {
			console.error("Presence WS message error:", err);
		}
	});

	ws.on("close", () => {
		if (currentUserId) {
			leaveLoungeRoom(currentUserId);
			if (activeSockets.has(currentUserId)) {
				const set = activeSockets.get(currentUserId);
				set.delete(ws);
				if (set.size === 0) {
					activeSockets.delete(currentUserId);
					const current = userPresence.get(currentUserId);
					if (current) {
						current.status = "offline";
						current.activity = null;
						current.lastSeen = Date.now();
						if (!current.ghostMode) {
							broadcastPresenceToFriends(currentUserId);
						}
						userPresence.delete(currentUserId);
					}
				}
			}
		}
	});
});

export function notifyUser(userId, payload) {
	const sockets = activeSockets.get(userId);
	if (sockets && sockets.size > 0) {
		const msg = JSON.stringify(payload);
		for (const ws of sockets) {
			if (ws.readyState === ws.OPEN) {
				ws.send(msg);
			}
		}
	}
}

export function broadcastSystemAnnouncement(message, senderUsername = "TED") {
	const payload = JSON.stringify({
		type: "system_announcement",
		message,
		sender: senderUsername,
		timestamp: Date.now()
	});

	for (const sockets of activeSockets.values()) {
		for (const ws of sockets) {
			if (ws.readyState === ws.OPEN) {
				ws.send(payload);
			}
		}
	}
}

// ============================================================
// Owner Panel hooks: kick + live presence stats
// ============================================================
export function kickUser(userId, reason = "Disconnected by an administrator", isBan = false) {
	const sockets = activeSockets.get(Number(userId));
	if (!sockets || sockets.size === 0) return false;
	for (const ws of [...sockets]) {
		try {
			ws.send(JSON.stringify({ type: "kicked", message: reason, banned: !!isBan }));
			ws.close(isBan ? 4003 : 4001, isBan ? "banned" : "kicked");
		} catch {}
	}
	try {
		leaveLoungeRoom(Number(userId));
		activeSockets.delete(Number(userId));
		userPresence.delete(Number(userId));
		broadcastPresenceToFriends(Number(userId));
	} catch {}
	return true;
}

const presenceHistory = [];
setInterval(() => {
	let online = 0;
	for (const p of userPresence.values()) if (p.status !== "offline") online++;
	presenceHistory.push({ t: Date.now(), online });
	if (presenceHistory.length > 288) presenceHistory.shift();
}, 60_000).unref?.();

export function getPresenceStats() {
	const users = [];
	let online = 0;
	for (const p of userPresence.values()) {
		if (p.status !== "offline") online++;
		users.push({ userId: p.userId, username: p.username, status: p.status, activity: p.activity || null });
	}
	const guestsOnline = getGuestPresenceStats();
	return { 
		online, 
		signedInOnline: online, 
		guestsOnline, 
		totalOnline: online + guestsOnline, 
		users, 
		history: presenceHistory.slice(-144), 
		rooms: getLoungeRooms() 
	};
}

export function isUserOnline(userId) {
	const p = userPresence.get(Number(userId));
	return !!p && p.status !== "offline";
}

export function getOnlineUserIds() {
	const ids = new Set();
	for (const p of userPresence.values()) {
		if (p.status !== "offline") ids.add(Number(p.userId));
	}
	return ids;
}

function broadcastPresenceToFriends(userId) {
	try {
		const friendRows = db.prepare(`
			SELECT 
				CASE WHEN user_id = ? THEN friend_id ELSE user_id END as friend_id
			FROM friendships
			WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
		`).all(userId, userId, userId);

		const presence = userPresence.get(userId) || { userId, status: "offline", activity: null };
		const payload = JSON.stringify({
			type: "friend_presence",
			presence
		});

		for (const row of friendRows) {
			const friendSockets = activeSockets.get(row.friend_id);
			if (friendSockets) {
				for (const ws of friendSockets) {
					if (ws.readyState === ws.OPEN) {
						ws.send(payload);
					}
				}
			}
		}
	} catch (e) {
		console.error("Broadcast presence error:", e);
	}
}

function sendFriendsPresence(userId, ws) {
	try {
		const friendRows = db.prepare(`
			SELECT 
				CASE WHEN user_id = ? THEN friend_id ELSE user_id END as friend_id
			FROM friendships
			WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
		`).all(userId, userId, userId);

		const statuses = {};
		for (const row of friendRows) {
			const p = userPresence.get(row.friend_id);
			if (p && !p.ghostMode) {
				statuses[row.friend_id] = p;
			} else {
				statuses[row.friend_id] = { userId: row.friend_id, status: "offline", activity: null };
			}
		}

		ws.send(JSON.stringify({
			type: "friends_presence_batch",
			statuses
		}));
	} catch (e) {
		console.error("Send friends presence error:", e);
	}
}
