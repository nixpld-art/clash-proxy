import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const soundsDir = fileURLToPath(new URL("../../data/sounds/", import.meta.url));
if (!existsSync(soundsDir)) {
	try {
		mkdirSync(soundsDir, { recursive: true });
	} catch {}
}

const SOUND_CATEGORIES = [
	{ id: "all", label: "All Sounds", icon: "🎵" },
	{ id: "memes", label: "Memes", icon: "🔥" },
	{ id: "gaming", label: "Gaming", icon: "🎮" },
	{ id: "reactions", label: "Reactions", icon: "😂" },
	{ id: "anime", label: "Anime", icon: "✨" },
	{ id: "effects", label: "Sound FX", icon: "🔊" }
];

const SOUNDS_CATALOG = [
	// MEMES
	{ id: "vine-boom", title: "Vine Boom", category: "memes", icon: "💥" },
	{ id: "metal-pipe-falling-sound-effect", title: "Metal Pipe", category: "memes", icon: "🏗️" },
	{ id: "fart-with-reverb", title: "Fart with Reverb", category: "memes", icon: "💨" },
	{ id: "emotional-damage-meme", title: "Emotional Damage", category: "memes", icon: "💔" },
	{ id: "discord-notification", title: "Discord Ping", category: "memes", icon: "💬" },
	{ id: "bruh", title: "Bruh", category: "memes", icon: "🗿" },
	{ id: "fbi-open-up-sfx", title: "FBI Open Up!", category: "memes", icon: "🚨" },
	{ id: "taco-bell-bong-sound", title: "Taco Bell Bong", category: "memes", icon: "🔔" },
	{ id: "giga-chad-theme", title: "Giga Chad Theme", category: "memes", icon: "🗿" },
	{ id: "sad-violin", title: "Sad Violin", category: "memes", icon: "🎻" },
	{ id: "rick-roll", title: "Rickroll", category: "memes", icon: "🕺" },
	{ id: "run-vine-sound-effect", title: "RUN!", category: "memes", icon: "🏃" },
	{ id: "coffin-dance-meme-song", title: "Coffin Dance", category: "memes", icon: "⚰️" },
	{ id: "why-are-you-running", title: "Why Are You Running", category: "memes", icon: "🏃" },
	{ id: "sheesh-sound-effect", title: "Sheesh!", category: "memes", icon: "🧊" },
	{ id: "what-the-dog-doin", title: "What The Dog Doin", category: "memes", icon: "🐶" },
	{ id: "bing-chilling", title: "Bing Chilling", category: "memes", icon: "🍦" },
	{ id: "spongebob-fail", title: "SpongeBob Fail", category: "memes", icon: "🧽" },
	{ id: "dun-dun-dun", title: "Dun Dun Dun!", category: "memes", icon: "🥁" },
	{ id: "quandale-dingle", title: "Quandale Dingle", category: "memes", icon: "👃" },
	{ id: "huh-sound-effect", title: "Huh?! Cat", category: "memes", icon: "🐱" },
	{ id: "aughhhhh", title: "AUGHHHHH!", category: "memes", icon: "😫" },
	{ id: "smoke-weed-everyday", title: "Smoke Weed Everyday", category: "memes", icon: "🕶️" },
	{ id: "illuminati-confirmed", title: "Illuminati (X-Files)", category: "memes", icon: "👁️" },
	{ id: "bye-bye-mewing", title: "Bye Bye (Mewing)", category: "memes", icon: "🤫" },
	{ id: "wide-putin-song", title: "Wide Putin", category: "memes", icon: "🚶" },
	{ id: "shrek-all-star", title: "Shrek All Star", category: "memes", icon: "🧅" },

	// GAMING
	{ id: "among-us-role-reveal-sound", title: "Among Us Role Reveal", category: "gaming", icon: "🔪" },
	{ id: "amogus", title: "Amogus!", category: "gaming", icon: "🚀" },
	{ id: "oof", title: "Roblox OOF", category: "gaming", icon: "🤕" },
	{ id: "gta-san-andreas-mission-passed", title: "GTA Mission Passed", category: "gaming", icon: "🎖️" },
	{ id: "gta-san-andreas-theme", title: "GTA San Andreas Theme", category: "gaming", icon: "🚗" },
	{ id: "wasted-gta", title: "GTA Wasted", category: "gaming", icon: "💀" },
	{ id: "super-mario-death-sound-sound-effect", title: "Super Mario Death", category: "gaming", icon: "🍄" },
	{ id: "mario-coin", title: "Mario Coin", category: "gaming", icon: "🪙" },
	{ id: "mario-jump", title: "Mario Jump", category: "gaming", icon: "🍄" },
	{ id: "minecraft-hurt", title: "Minecraft Hurt", category: "gaming", icon: "⛏️" },
	{ id: "fortnite-death-sound", title: "Fortnite Knocked", category: "gaming", icon: "🛡️" },
	{ id: "fortnite-default-dance", title: "Fortnite Dance", category: "gaming", icon: "🕺" },
	{ id: "hitmarker", title: "COD Hitmarker", category: "gaming", icon: "🎯" },
	{ id: "metal-gear-solid-alert", title: "Metal Gear Alert (!)", category: "gaming", icon: "❗" },
	{ id: "clash-royale-king-laugh", title: "Clash King Laugh", category: "gaming", icon: "👑" },
	{ id: "clash-royale-hog-rider", title: "Hog Rider!", category: "gaming", icon: "🐗" },
	{ id: "sans", title: "Sans Megalovania", category: "gaming", icon: "💀" },

	// REACTIONS
	{ id: "mlg-air-horn", title: "MLG Airhorn", category: "reactions", icon: "📢" },
	{ id: "applause-sound-effect", title: "Crowd Applause", category: "reactions", icon: "👏" },
	{ id: "boo-sound-effect", title: "Audience Boo", category: "reactions", icon: "👎" },
	{ id: "ba-dum-tss", title: "Ba-Dum-Tss", category: "reactions", icon: "🥁" },
	{ id: "buzzer-wrong-answer", title: "Wrong Buzzer", category: "reactions", icon: "❌" },
	{ id: "hell-naw", title: "Oh Hell Nah!", category: "reactions", icon: "🚫" },
	{ id: "screaming-goat", title: "Screaming Goat", category: "reactions", icon: "🐐" },
	{ id: "wilhelm-scream-original", title: "Wilhelm Scream", category: "reactions", icon: "😱" },
	{ id: "bonk", title: "Bonk!", category: "reactions", icon: "🔨" },
	{ id: "slap-sound-effect", title: "Slap", category: "reactions", icon: "🖐️" },
	{ id: "punch-sound-effect", title: "Cartoon Punch", category: "reactions", icon: "🥊" },
	{ id: "chewbacca", title: "Chewbacca", category: "reactions", icon: "🐻" },
	{ id: "nope", title: "Nope.avi", category: "reactions", icon: "🙅" },

	// ANIME
	{ id: "anime-wow", title: "Anime Wow", category: "anime", icon: "✨" },
	{ id: "nani-meme-sound-effect", title: "Omae Wa Mou Nani?!", category: "anime", icon: "⚡" },
	{ id: "yamete-kudasai", title: "Yamete Kudasai", category: "anime", icon: "😳" },
	{ id: "deja-vu", title: "Deja Vu (Initial D)", category: "anime", icon: "🏎️" },
	{ id: "ultra-instinct", title: "Ultra Instinct Theme", category: "anime", icon: "🌌" },
	{ id: "tuturu_1", title: "Tuturu! (Mayuri)", category: "anime", icon: "🎶" },

	// EFFECTS / SYSTEM
	{ id: "windows-xp-error", title: "Windows XP Error", category: "effects", icon: "⚠️" },
	{ id: "windows-xp-startup", title: "Windows XP Startup", category: "effects", icon: "💻" },
	{ id: "windows-shutdown", title: "Windows Shutdown", category: "effects", icon: "🔌" },
	{ id: "crab-rave", title: "Crab Rave", category: "effects", icon: "🦀" }
];

export default async function soundboardRoutes(fastify, options) {
	// GET /api/soundboard/sounds - Full soundboard catalog
	fastify.get("/api/soundboard/sounds", async (req, reply) => {
		return {
			categories: SOUND_CATEGORIES,
			sounds: SOUNDS_CATALOG
		};
	});

	// GET /api/soundboard/audio/:key - Proxied/cached MyInstants audio stream
	// Safe against school filters (LGfL) since student client connects to Clash Proxy directly
	fastify.get("/api/soundboard/audio/:key", async (req, reply) => {
		let key = String(req.params.key || "").trim().toLowerCase();
		// Sanitize key (allow only lowercase alphanumeric, dashes, underscores)
		key = key.replace(/[^a-z0-9_-]/g, "");
		if (!key) {
			return reply.code(400).send({ error: "Invalid sound key" });
		}

		const localFilePath = join(soundsDir, `${key}.mp3`);

		// 1. Serve from disk cache if already downloaded
		if (existsSync(localFilePath)) {
			try {
				const buf = readFileSync(localFilePath);
				reply.header("Content-Type", "audio/mpeg");
				reply.header("Cache-Control", "public, max-age=604800, immutable");
				reply.header("Accept-Ranges", "bytes");
				return reply.send(buf);
			} catch (err) {
				// Fallthrough to re-fetch if file read fails
			}
		}

		// 2. Fetch from MyInstants CDN
		try {
			const remoteUrl = `https://www.myinstants.com/media/sounds/${key}.mp3`;
			const res = await fetch(remoteUrl, {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					"Referer": "https://www.myinstants.com/"
				},
				signal: AbortSignal.timeout(8000)
			});

			if (!res.ok) {
				return reply.code(res.status === 404 ? 404 : 502).send({ error: "Sound effect not found on MyInstants" });
			}

			const arrayBuf = await res.arrayBuffer();
			const buffer = Buffer.from(arrayBuf);

			// Write to cache asynchronously so subsequent plays are instant
			try {
				writeFileSync(localFilePath, buffer);
			} catch {}

			reply.header("Content-Type", "audio/mpeg");
			reply.header("Cache-Control", "public, max-age=604800, immutable");
			reply.header("Accept-Ranges", "bytes");
			return reply.send(buffer);
		} catch (e) {
			return reply.code(502).send({ error: "Failed to load sound from MyInstants: " + e.message });
		}
	});

	// GET /api/soundboard/custom?url= - Safely stream any MyInstants URL or custom audio
	fastify.get("/api/soundboard/custom", async (req, reply) => {
		const targetUrl = String(req.query.url || "").trim();
		if (!targetUrl.startsWith("https://www.myinstants.com/media/sounds/") || !targetUrl.endsWith(".mp3")) {
			return reply.code(400).send({ error: "Only official MyInstants sound URLs are permitted." });
		}

		const match = targetUrl.match(/\/media\/sounds\/([a-z0-9_-]+)\.mp3$/i);
		if (match && match[1]) {
			return reply.redirect(`/api/soundboard/audio/${match[1]}`, 302);
		}

		return reply.code(400).send({ error: "Invalid sound URL" });
	});
}
