import db from "../db.js";
import { extractAuthUser, isAdminUser, isPrivilegedUsername } from "../auth-utils.js";
import { hasPrivilege } from "../ranks.js";

export const BAZAAR_CATALOG = [
	// ==========================================
	// 🌟 AVATAR FRAMES (18 items)
	// ==========================================
	{
		id: "frame-cyber-neon",
		type: "frame",
		name: "Neon Pulse",
		icon: "🔮",
		cost: 150,
		description: "Pulsing cyberpunk neon purple & sapphire aura"
	},
	{
		id: "frame-matrix-rain",
		type: "frame",
		name: "Emerald Matrix",
		icon: "💻",
		cost: 200,
		description: "Flowing digital green hacker code stream"
	},
	{
		id: "frame-fire-ring",
		type: "frame",
		name: "Inferno Flame",
		icon: "🔥",
		cost: 250,
		description: "Blazing animated rotating magma fire ring"
	},
	{
		id: "frame-prismatic",
		type: "frame",
		name: "Chromatic Prism",
		icon: "🌈",
		cost: 350,
		description: "Shimmering rainbow refraction gradient ring"
	},
	{
		id: "frame-sovereign-gold",
		type: "frame",
		name: "Sovereign Crest",
		icon: "👑",
		cost: 500,
		description: "Royal golden filigree crown crest (Founder Edition)"
	},
	{
		id: "frame-ice-crystal",
		type: "frame",
		name: "Frost Shard",
		icon: "❄️",
		cost: 180,
		description: "Subzero glacial ice crystals with cryogenic pulse"
	},
	{
		id: "frame-void-eclipse",
		type: "frame",
		name: "Void Eclipse",
		icon: "🌑",
		cost: 280,
		description: "Dark cosmic event horizon with ultraviolet ripples"
	},
	{
		id: "frame-neon-hexagon",
		type: "frame",
		name: "Hex Shield",
		icon: "🔷",
		cost: 160,
		description: "Futuristic glowing cyan hexagonal forcefield"
	},
	{
		id: "frame-retro-arcade",
		type: "frame",
		name: "Retro Pixel",
		icon: "🕹️",
		cost: 175,
		description: "Nostalgic 8-bit arcade cabinet border"
	},
	{
		id: "frame-stardust-orbit",
		type: "frame",
		name: "Cosmic Orbit",
		icon: "✨",
		cost: 220,
		description: "Revolving starlight satellites around your avatar"
	},
	{
		id: "frame-dragon-flame",
		type: "frame",
		name: "Dragon Wyrm",
		icon: "🐉",
		cost: 320,
		description: "Crimson dragon scale border with burning embers"
	},
	{
		id: "frame-galaxy-vortex",
		type: "frame",
		name: "Galaxy Vortex",
		icon: "🌌",
		cost: 300,
		description: "Deep galactic swirling nebula with star dust"
	},
	{
		id: "frame-toxic-slime",
		type: "frame",
		name: "Biohazard Slime",
		icon: "☣️",
		cost: 160,
		description: "Bubbling radioactive neon green bio-drip"
	},
	{
		id: "frame-cherry-blossom",
		type: "frame",
		name: "Sakura Drift",
		icon: "🌸",
		cost: 210,
		description: "Delicate pastel pink cherry blossom aura"
	},
	{
		id: "frame-golden-laurel",
		type: "frame",
		name: "Victory Laurel",
		icon: "🌿",
		cost: 290,
		description: "Gilded Olympic golden laurel wreath for champions"
	},
	{
		id: "frame-cyber-gear",
		type: "frame",
		name: "Techno Gear",
		icon: "⚙️",
		cost: 190,
		description: "Rotating mechanical brass and copper steampunk cog"
	},
	{
		id: "frame-thunder-spark",
		type: "frame",
		name: "Thunder Coil",
		icon: "⚡",
		cost: 240,
		description: "High-voltage crackling static electricity sparks"
	},
	{
		id: "frame-quantum-ripple",
		type: "frame",
		name: "Quantum Ripple",
		icon: "💫",
		cost: 260,
		description: "Expanding sonic holographic wave oscillations"
	},

	// ==========================================
	// ✨ VIP NAME EFFECTS & THEMES (18 items)
	// ==========================================
	{
		id: "name-cyber-pink",
		type: "name_theme",
		name: "Neon Cyber Pink",
		icon: "💖",
		cost: 120,
		description: "Vibrant hot magenta and cyan gradient text"
	},
	{
		id: "name-electric-blue",
		type: "name_theme",
		name: "Electric Azure",
		icon: "⚡",
		cost: 150,
		description: "Crackling cyan-to-sapphire lightning text"
	},
	{
		id: "name-matrix-green",
		type: "name_theme",
		name: "Terminal Green",
		icon: "📟",
		cost: 120,
		description: "Retro green phosphor CRT glow text"
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
	{
		id: "name-glitch-holo",
		type: "name_theme",
		name: "Holo Glitch",
		icon: "👾",
		cost: 220,
		description: "RGB split chromatic aberration shifting text"
	},
	{
		id: "name-crimson-inferno",
		type: "name_theme",
		name: "Crimson Inferno",
		icon: "🔥",
		cost: 200,
		description: "Blazing ruby-red flame molten core gradient"
	},
	{
		id: "name-blizzard-frost",
		type: "name_theme",
		name: "Blizzard Frost",
		icon: "❄️",
		cost: 160,
		description: "Glacial subzero ice-blue crystalline sheen"
	},
	{
		id: "name-sunset-vapor",
		type: "name_theme",
		name: "Sunset Vaporwave",
		icon: "🌆",
		cost: 175,
		description: "Dreamy 80s synthwave neon magenta to peach"
	},
	{
		id: "name-solar-flare",
		type: "name_theme",
		name: "Solar Flare",
		icon: "☀️",
		cost: 210,
		description: "Superheated incandescent yellow and orange glow"
	},
	{
		id: "name-toxic-acid",
		type: "name_theme",
		name: "Toxic Acid",
		icon: "🧪",
		cost: 150,
		description: "Radioactive neon lime sizzle and glow"
	},
	{
		id: "name-phantom-ghost",
		type: "name_theme",
		name: "Phantom Ghost",
		icon: "👻",
		cost: 190,
		description: "Translucent spectral mist with ethereal shimmer"
	},
	{
		id: "name-starlight-shimmer",
		type: "name_theme",
		name: "Starlight Shimmer",
		icon: "⭐",
		cost: 230,
		description: "Twinkling silver diamond starlight gradient"
	},
	{
		id: "name-plasma-surge",
		type: "name_theme",
		name: "Plasma Surge",
		icon: "🔮",
		cost: 240,
		description: "Hyper-voltage magenta & violet plasma arc"
	},
	{
		id: "name-dark-matter",
		type: "name_theme",
		name: "Dark Matter",
		icon: "🖤",
		cost: 260,
		description: "Obsidian shadow text with pulsating purple outline"
	},
	{
		id: "name-bubblegum-pop",
		type: "name_theme",
		name: "Bubblegum Pop",
		icon: "🍬",
		cost: 130,
		description: "Playful pastel candy pink and baby blue"
	},
	{
		id: "name-royal-velvet",
		type: "name_theme",
		name: "Royal Velvet",
		icon: "👑",
		cost: 250,
		description: "Imperial crimson and velvet purple gradient"
	},
	{
		id: "name-hyperdrive-neon",
		type: "name_theme",
		name: "Hyperdrive",
		icon: "🚀",
		cost: 275,
		description: "Speed-of-light turquoise beam with luminous trail"
	},

	// ==========================================
	// 💬 CHAT BUBBLE THEMES (10 items)
	// ==========================================
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
		description: "High contrast dark slate & neon yellow accents"
	},
	{
		id: "chat-glass-frost",
		type: "chat_theme",
		name: "Frost Crystal",
		icon: "❄️",
		cost: 150,
		description: "Deep icy frosted glass with cyan borders"
	},
	{
		id: "chat-midnight-velvet",
		type: "chat_theme",
		name: "Midnight Velvet",
		icon: "🌌",
		cost: 160,
		description: "Ultra-deep royal amethyst glassmorphic bubbles"
	},
	{
		id: "chat-solar-sunset",
		type: "chat_theme",
		name: "Solar Sunset",
		icon: "🌅",
		cost: 140,
		description: "Warm gradient sunset edges with dark amber backdrop"
	},
	{
		id: "chat-emerald-glass",
		type: "chat_theme",
		name: "Emerald Glass",
		icon: "💎",
		cost: 150,
		description: "Translucent jade and emerald tinted glass bubbles"
	},
	{
		id: "chat-royal-gold",
		type: "chat_theme",
		name: "Royal Gold",
		icon: "👑",
		cost: 200,
		description: "Gilded 24k gold border with warm champagne text"
	},
	{
		id: "chat-bubblegum",
		type: "chat_theme",
		name: "Bubblegum Sweet",
		icon: "🍭",
		cost: 120,
		description: "Pastel candy pink rounded bubbles with soft shadows"
	},
	{
		id: "chat-vaporwave",
		type: "chat_theme",
		name: "Synthwave Grid",
		icon: "💽",
		cost: 150,
		description: "Retro grid styling with neon magenta accents"
	},
	{
		id: "chat-deep-space",
		type: "chat_theme",
		name: "Deep Space",
		icon: "🚀",
		cost: 180,
		description: "Star-dusted black matte with interstellar nebula edge"
	},

	// ==========================================
	// 🏷️ TITLE BADGES (10 items)
	// ==========================================
	{
		id: "title-speedrunner",
		type: "title",
		name: "Speedrunner",
		icon: "⚡",
		cost: 140,
		description: "Title badge: [⚡ Speedrunner] displayed on profile"
	},
	{
		id: "title-pixel-knight",
		type: "title",
		name: "Pixel Knight",
		icon: "🛡️",
		cost: 160,
		description: "Title badge: [🛡️ Pixel Knight] for stalwart gamers"
	},
	{
		id: "title-retro-master",
		type: "title",
		name: "Retro Master",
		icon: "🕹️",
		cost: 180,
		description: "Title badge: [🕹️ Retro Master] for arcade connoisseurs"
	},
	{
		id: "title-high-roller",
		type: "title",
		name: "High Roller",
		icon: "💎",
		cost: 300,
		description: "Title badge: [💎 High Roller] for coin collectors"
	},
	{
		id: "title-shadow-walker",
		type: "title",
		name: "Shadow Walker",
		icon: "👻",
		cost: 190,
		description: "Title badge: [👻 Shadow Walker] for ghost navigators"
	},
	{
		id: "title-cosmic-voyager",
		type: "title",
		name: "Cosmic Voyager",
		icon: "🚀",
		cost: 210,
		description: "Title badge: [🚀 Cosmic Voyager] for web spacefarers"
	},
	{
		id: "title-arcade-legend",
		type: "title",
		name: "Arcade Legend",
		icon: "👑",
		cost: 350,
		description: "Title badge: [👑 Arcade Legend] for top champions"
	},
	{
		id: "title-cyber-samurai",
		type: "title",
		name: "Cyber Samurai",
		icon: "⚔️",
		cost: 240,
		description: "Title badge: [⚔️ Cyber Samurai] for keen coders"
	},
	{
		id: "title-pixel-wizard",
		type: "title",
		name: "Pixel Wizard",
		icon: "🔮",
		cost: 220,
		description: "Title badge: [🔮 Pixel Wizard] for tech enchanters"
	},
	{
		id: "title-glitch-hunter",
		type: "title",
		name: "Glitch Hunter",
		icon: "🐛",
		cost: 170,
		description: "Title badge: [🐛 Glitch Hunter] for sharp testers"
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
			SELECT id, username, role, coins, equipped_frame, equipped_name_theme, equipped_chat_theme, equipped_title
			FROM users
			WHERE id = ?
		`).get(req.authUser.id);

		if (!user) return reply.code(404).send({ error: "User not found" });

		const ownedRows = db.prepare("SELECT item_id FROM user_cosmetics WHERE user_id = ?").all(user.id);
		const ownedSet = new Set(ownedRows.map((r) => r.item_id));

		// Founders and owners own everything for free
		const isOwner = isPrivilegedUsername(user.username) || isAdminUser(user);
		const hasDiscount = hasPrivilege(user, "bazaar-staff-discount");

		const items = BAZAAR_CATALOG.map((item) => {
			const effectiveCost = hasDiscount && !isOwner ? Math.round(item.cost * 0.75) : item.cost;
			return {
				...item,
				cost: effectiveCost,
				originalCost: item.cost,
				discountApplied: hasDiscount && !isOwner,
				owned: isOwner || ownedSet.has(item.id),
				isEquipped:
					user.equipped_frame === item.id ||
					user.equipped_name_theme === item.id ||
					user.equipped_chat_theme === item.id ||
					user.equipped_title === item.id
			};
		});

		return {
			success: true,
			coins: user.coins || 0,
			isOwner,
			hasDiscount,
			equipped: {
				frame: user.equipped_frame || "none",
				nameTheme: user.equipped_name_theme || "none",
				chatTheme: user.equipped_chat_theme || "none",
				title: user.equipped_title || "none"
			},
			catalog: items
		};
	});

	// POST /api/bazaar/buy - Purchase cosmetic item
	fastify.post("/api/bazaar/buy", async (req, reply) => {
		const { itemId } = req.body || {};
		const item = BAZAAR_CATALOG.find((i) => i.id === itemId);
		if (!item) return reply.code(400).send({ error: "Invalid item ID." });

		const user = db.prepare("SELECT id, username, coins, role FROM users WHERE id = ?").get(req.authUser.id);
		if (!user) return reply.code(404).send({ error: "User not found" });

		const isOwner = isPrivilegedUsername(user.username) || isAdminUser(user);
		const hasDiscount = hasPrivilege(user, "bazaar-staff-discount");
		const effectiveCost = hasDiscount && !isOwner ? Math.round(item.cost * 0.75) : item.cost;

		// Check if already owned
		const existing = db.prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_id = ?").get(user.id, item.id);
		if (existing && !isOwner) {
			return reply.code(400).send({ error: "You already own this item!" });
		}

		if (!isOwner) {
			if ((user.coins || 0) < effectiveCost) {
				return reply.code(400).send({ error: `Not enough Clash Coins! You need ${effectiveCost} coins.` });
			}
			// Deduct coins
			db.prepare("UPDATE users SET coins = coins - ? WHERE id = ?").run(effectiveCost, user.id);
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

		const validTypes = ["frame", "name_theme", "chat_theme", "title"];
		if (!validTypes.includes(itemType)) {
			return reply.code(400).send({ error: "Invalid cosmetic type." });
		}

		const user = db.prepare("SELECT id, username, role, equipped_frame, equipped_name_theme, equipped_chat_theme, equipped_title FROM users WHERE id = ?").get(req.authUser.id);
		if (!user) return reply.code(404).send({ error: "User not found" });

		const isOwner = isPrivilegedUsername(user.username) || isAdminUser(user);

		let targetItem = "none";
		if (!unequip && itemId && itemId !== "none") {
			const item = BAZAAR_CATALOG.find((i) => i.id === itemId && i.type === itemType);
			if (!item) return reply.code(400).send({ error: "Item not found in catalog." });

			// Verify ownership
			if (!isOwner) {
				const owned = db.prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_id = ?").get(user.id, itemId);
				if (!owned) return reply.code(403).send({ error: "You do not own this item yet!" });
			}
			targetItem = item.id;
		}

		let column = "equipped_frame";
		if (itemType === "name_theme") column = "equipped_name_theme";
		else if (itemType === "chat_theme") column = "equipped_chat_theme";
		else if (itemType === "title") column = "equipped_title";

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
