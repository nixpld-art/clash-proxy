import db from "../db.js";
import { extractAuthUser, isAdminUser } from "../auth-utils.js";

export const BAZAAR_CATALOG = [
	// Avatar Frames
	{
		id: "frame-cyber-neon",
		type: "frame",
		name: "Neon Pulse",
		icon: "🔮",
		cost: 150,
		description: "Pulsing cyberpunk neon purple aura"
	},
	{
		id: "frame-matrix-rain",
		type: "frame",
		name: "Emerald Matrix",
		icon: "💻",
		cost: 200,
		description: "Flowing digital green code stream"
	},
	{
		id: "frame-fire-ring",
		type: "frame",
		name: "Inferno Flame",
		icon: "🔥",
		cost: 250,
		description: "Blazing animated rotating magma ring"
	},
	{
		id: "frame-prismatic",
		type: "frame",
		name: "Chromatic Prism",
		icon: "🌈",
		cost: 350,
		description: "Shimmering rainbow refraction border"
	},
	{
		id: "frame-sovereign-gold",
		type: "frame",
		name: "Sovereign Crest",
		icon: "👑",
		cost: 500,
		description: "Royal golden filigree crown crest (Free for @TED)"
	},

	// VIP Name Themes
	{
		id: "name-cyber-pink",
		type: "name_theme",
		name: "Neon Cyber Pink",
		icon: "💖",
		cost: 120,
		description: "Vibrant hot magenta and cyan gradient"
	},
	{
		id: "name-electric-blue",
		type: "name_theme",
		name: "Electric Azure",
		icon: "⚡",
		cost: 150,
		description: "Crackling cyan-to-sapphire lightning"
	},
	{
		id: "name-matrix-green",
		type: "name_theme",
		name: "Terminal Green",
		icon: "📟",
		cost: 120,
		description: "Retro green phosphor CRT glow"
	},
	{
		id: "name-golden-god",
		type: "name_theme",
		name: "Golden Radiance",
		icon: "🌟",
		cost: 300,
		description: "Pure glistening gold metallic sheen"
	},
	{
		id: "name-void-purple",
		type: "name_theme",
		name: "Void Amethyst",
		icon: "🌌",
		cost: 180,
		description: "Deep cosmic ultraviolet interstellar aura"
	},

	// Chat Bubble Themes
	{
		id: "chat-terminal",
		type: "chat_theme",
		name: "Hacker Terminal",
		icon: "🖥️",
		cost: 100,
		description: "Matrix green monospace retro chat bubbles"
	},
	{
		id: "chat-cyberpunk",
		type: "chat_theme",
		name: "Neo-Tokyo Cyber",
		icon: "🌆",
		cost: 150,
		description: "High contrast dark yellow & neon accents"
	},
	{
		id: "chat-glass-frost",
		type: "chat_theme",
		name: "Frost Crystal",
		icon: "❄️",
		cost: 150,
		description: "Deep icy frosted glass with cyan borders"
	}
];

export default async function bazaarRoutes(fastify, options) {
	// Middleware check for authenticated user
	fastify.addHook("preHandler", async (req, reply) => {
		if (req.url.startsWith("/api/bazaar")) {
			const auth = extractAuthUser(req);
			if (!auth) {
				return reply.code(401).send({ error: "Please sign in to access Clash Bazaar." });
			}
			req.authUser = auth;
		}
	});

	// GET /api/bazaar/catalog - Get items, user balance, and equipped gear
	fastify.get("/api/bazaar/catalog", async (req, reply) => {
		const user = db.prepare(`
			SELECT id, username, role, coins, equipped_frame, equipped_name_theme, equipped_chat_theme
			FROM users
			WHERE id = ?
		`).get(req.authUser.id);

		if (!user) return reply.code(404).send({ error: "User not found" });

		const ownedRows = db.prepare("SELECT item_id FROM user_cosmetics WHERE user_id = ?").all(user.id);
		const ownedSet = new Set(ownedRows.map(r => r.item_id));

		// Everyone owns 'none', and @TED owns everything
		const isTed = isAdminUser(user);

		const items = BAZAAR_CATALOG.map(item => ({
			...item,
			owned: isTed || ownedSet.has(item.id),
			isEquipped: user.equipped_frame === item.id || 
			            user.equipped_name_theme === item.id || 
			            user.equipped_chat_theme === item.id
		}));

		return {
			success: true,
			coins: user.coins || 0,
			equipped: {
				frame: user.equipped_frame || "none",
				nameTheme: user.equipped_name_theme || "none",
				chatTheme: user.equipped_chat_theme || "none"
			},
			catalog: items
		};
	});

	// POST /api/bazaar/buy - Purchase cosmetic item
	fastify.post("/api/bazaar/buy", async (req, reply) => {
		const { itemId } = req.body || {};
		const item = BAZAAR_CATALOG.find(i => i.id === itemId);
		if (!item) return reply.code(400).send({ error: "Invalid item ID." });

		const user = db.prepare("SELECT id, username, coins, role FROM users WHERE id = ?").get(req.authUser.id);
		if (!user) return reply.code(404).send({ error: "User not found" });

		const isTed = isAdminUser(user);

		// Check if already owned
		const existing = db.prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_id = ?").get(user.id, item.id);
		if (existing && !isTed) {
			return reply.code(400).send({ error: "You already own this item!" });
		}

		if (!isTed) {
			if ((user.coins || 0) < item.cost) {
				return reply.code(400).send({ error: `Not enough Clash Coins! You need ${item.cost} coins.` });
			}
			// Deduct coins
			db.prepare("UPDATE users SET coins = coins - ? WHERE id = ?").run(item.cost, user.id);
		}

		// Insert cosmetic
		db.prepare("INSERT OR IGNORE INTO user_cosmetics (user_id, item_id, item_type) VALUES (?, ?, ?)").run(user.id, item.id, item.type);

		const updatedUser = db.prepare("SELECT coins FROM users WHERE id = ?").get(user.id);
		return {
			success: true,
			message: `Unlocked "${item.name}"!`,
			itemId: item.id,
			newBalance: updatedUser.coins
		};
	});

	// POST /api/bazaar/equip - Equip or unequip cosmetic item
	fastify.post("/api/bazaar/equip", async (req, reply) => {
		const { itemId, itemType, unequip = false } = req.body || {};

		const validTypes = ["frame", "name_theme", "chat_theme"];
		if (!validTypes.includes(itemType)) {
			return reply.code(400).send({ error: "Invalid cosmetic type." });
		}

		const user = db.prepare("SELECT id, username, role, equipped_frame, equipped_name_theme, equipped_chat_theme FROM users WHERE id = ?").get(req.authUser.id);
		if (!user) return reply.code(404).send({ error: "User not found" });

		const isTed = isAdminUser(user);

		let targetItem = "none";
		if (!unequip && itemId && itemId !== "none") {
			const item = BAZAAR_CATALOG.find(i => i.id === itemId && i.type === itemType);
			if (!item) return reply.code(400).send({ error: "Item not found in catalog." });

			// Verify ownership
			if (!isTed) {
				const owned = db.prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_id = ?").get(user.id, itemId);
				if (!owned) return reply.code(403).send({ error: "You do not own this item yet!" });
			}
			targetItem = item.id;
		}

		let column = "equipped_frame";
		if (itemType === "name_theme") column = "equipped_name_theme";
		if (itemType === "chat_theme") column = "equipped_chat_theme";

		db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(targetItem, user.id);

		const updatedUser = db.prepare(`SELECT ${column} FROM users WHERE id = ?`).get(user.id);

		return {
			success: true,
			message: targetItem === "none" ? "Item unequipped." : `Equipped ${targetItem}!`,
			equippedItem: updatedUser[column],
			itemType
		};
	});

	// POST /api/bazaar/daily-reward - Claim 50 coins daily bonus
	fastify.post("/api/bazaar/daily-reward", async (req, reply) => {
		const today = new Date().toISOString().split("T")[0];
		const user = db.prepare("SELECT id, coins, settings_json FROM users WHERE id = ?").get(req.authUser.id);
		if (!user) return reply.code(404).send({ error: "User not found" });

		let settings = {};
		try { settings = JSON.parse(user.settings_json || "{}"); } catch (e) {}

		if (settings.last_coin_claim === today) {
			return reply.code(400).send({ error: "You have already collected today's coin bonus! Return tomorrow." });
		}

		settings.last_coin_claim = today;
		const bonus = 50;

		db.prepare(`
			UPDATE users 
			SET coins = coins + ?, settings_json = ? 
			WHERE id = ?
		`).run(bonus, JSON.stringify(settings), user.id);

		const updated = db.prepare("SELECT coins FROM users WHERE id = ?").get(user.id);
		return {
			success: true,
			message: `Claimed +${bonus} Clash Coins!`,
			newBalance: updated.coins
		};
	});
}
