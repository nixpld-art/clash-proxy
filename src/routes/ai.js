// ============================================================
// Clash AI — chat-only assistant endpoint for the main site.
// Pure conversation: this route has NO access to site powers
// (bans, games, panel). Those belong to Jarvis AI (owner panel).
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";
import { extractAuthUser } from "../auth-utils.js";
import { recordActivity } from "../activity.js";

const PANEL_KEY_FILE = fileURLToPath(new URL("../../clash owner pannel/jarvis-key.txt", import.meta.url));

const SYS_PROMPT =
	"You are Clash AI, the friendly built-in chat assistant of Clash Proxy, a browser proxy and gaming website. " +
	"You are a pure chat assistant: you cannot control, modify, or inspect the website, its games, its users, or any moderation tools, " +
	"and you must never claim that you can. Keep answers concise, helpful and friendly. " +
	"If someone asks you to administer the site (ban a user, add a game, change settings), explain that site administration is done " +
	"by the owner directly in the Owner Panel, not by you.";

const FREE_MODELS = [
	"tencent/hy3:free",
	"google/gemma-4-31b-it:free",
	"google/gemma-4-26b-a4b-it:free",
	"meta-llama/llama-3.3-70b-instruct:free",
	"qwen/qwen3-coder:free",
	"liquid/lfm-2.5-1.2b-instruct:free",
	"nousresearch/hermes-3-llama-3.1-405b:free",
	"nvidia/nemotron-3-nano-30b-a3b:free",
	"cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
];

const HF_MODELS = [
	"google/gemma-2-2b-it",
	"microsoft/Phi-3-mini-4k-instruct",
	"HuggingFaceH4/zephyr-7b-beta",
	"mistralai/Mistral-7B-Instruct-v0.3",
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let lastWorkingModel = null;
let aiDeadline = 0; // overall budget for one askAIReply call

function sanitizeMessages(raw) {
	const out = [];
	if (!Array.isArray(raw)) return out;
	for (const m of raw.slice(-12)) {
		if (!m || typeof m !== "object") continue;
		const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
		const content = String(m.content || "").slice(0, 4000).trim();
		if (content) out.push({ role, content });
	}
	return out;
}

// Key resolution: env first, then the owner-panel key file so a single
// OpenRouter key powers both Clash AI and Jarvis AI.
export function resolveOpenRouterKey() {
	if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
	try {
		const raw = readFileSync(PANEL_KEY_FILE, "utf8").trim();
		if (!raw) return "";
		return raw.startsWith("[ENC]") ? Buffer.from(raw.slice(5), "base64").toString("utf8") : raw;
	} catch { return ""; }
}

// Probe a key with a 1-token completion. Used by the panel when saving.
export async function validateOpenRouterKey(key) {
	if (!key || typeof key !== "string") return { valid: false, detail: "no key" };
	try {
		const ac = new AbortController();
		setTimeout(() => { try { ac.abort(); } catch {} }, 15000);
		const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
			body: JSON.stringify({ model: FREE_MODELS[0], messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
			signal: ac.signal,
		});
		if (res.ok) return { valid: true, detail: "key accepted by OpenRouter" };
		const body = await res.text().catch(() => "");
		return { valid: false, detail: `OpenRouter ${res.status}: ${body.slice(0, 160)}` };
	} catch (e) { return { valid: false, detail: "probe failed: " + e.message }; }
}

async function callOpenRouter(messages, openrouterKey, maxTokens = 700, temperature = 0.7) {
	const models = [...FREE_MODELS];
	if (lastWorkingModel && models.includes(lastWorkingModel)) {
		models.splice(models.indexOf(lastWorkingModel), 1);
		models.unshift(lastWorkingModel);
	}
	for (let i = 0; i < models.length; i++) {
		try {
			if (Date.now() > aiDeadline) break;
			if (i > 0) await delay(800);
			const ac = new AbortController();
			setTimeout(() => { try { ac.abort(); } catch {} }, 30000);
			const headers = { "Content-Type": "application/json", "HTTP-Referer": "http://localhost:8080", "X-Title": "Clash Proxy" };
			const key = openrouterKey || resolveOpenRouterKey();
			if (key) headers["Authorization"] = "Bearer " + key;
			const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers,
				body: JSON.stringify({ model: models[i], messages, max_tokens: maxTokens, temperature }),
				signal: ac.signal,
			});
			if (res.ok) {
				const data = await res.json();
				const text = data.choices?.[0]?.message?.content?.trim();
				if (text) { lastWorkingModel = models[i]; return text; }
			} else if (res.status === 401 || res.status === 403) {
				// Invalid/revoked key — trying the other models would just waste 401s.
				return null;
			} else if (res.status === 429) { continue; }
		} catch { continue; }
	}
	return null;
};

// Pollinations — anonymous/keyless chat API (gpt-oss). Free, no key.
// Their anonymous tier allows 1 queued request per IP, generation is
// slow (~15-20s cold), and the servers intermittently 500. Strategy:
// never abort too early (an aborted request keeps holding the queue
// slot), wait out 429 "queue full" states, retry patiently, then fall
// back to the legacy GET path.
async function askPollinations(messages, maxTokens = 400, temperature = 0.7, legacy = true) {
	const payload = JSON.stringify({ model: "openai", messages, max_tokens: maxTokens, temperature });
	for (let attempt = 0; attempt < 3; attempt++) {
		if (Date.now() > aiDeadline) return null;
		if (attempt) await delay(5000); // let any previous generation finish
		try {
			const budget = Math.max(3000, aiDeadline - Date.now());
			const ac = new AbortController();
			setTimeout(() => { try { ac.abort(); } catch {} }, Math.min(30000, budget));
			const res = await fetch("https://text.pollinations.ai/openai", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
				signal: ac.signal,
			});
			if (res.ok) {
				const data = await res.json();
				const text = data?.choices?.[0]?.message?.content?.trim();
				if (text) return text;
			} else if (res.status === 429) {
				await res.text().catch(() => {});
				await delay(3000); // queue full — the slot frees up shortly
			}
		} catch { /* transient — timeout, 500, network */ }
	}
	// Final fallback: legacy GET path (different code path, often alive
	// when POST generation is struggling).
	if (!legacy) return null;
	try {
		if (Date.now() > aiDeadline) return null;
		const sys = messages.find((m) => m.role === "system")?.content || "";
		const user = [...messages].reverse().find((m) => m.role === "user")?.content || "";
		const url = "https://text.pollinations.ai/" + encodeURIComponent(user.slice(0, 800)) +
			"?model=openai" + (sys ? "&system=" + encodeURIComponent(sys.slice(0, 600)) : "");
		const ac = new AbortController();
		setTimeout(() => { try { ac.abort(); } catch {} }, Math.min(20000, Math.max(2000, aiDeadline - Date.now())));
		const res = await fetch(url, { signal: ac.signal });
		if (res.ok) {
			const text = (await res.text()).trim();
			if (text && !/^<\s*!DOCTYPE|^\s*\{/) return text;
		}
	} catch { /* fall through */ }
	return null;
}

async function askGemini(messages) {
	const key = process.env.GEMINI_API_KEY || "";
	if (!key) return null;
	try {
		const systemMsg = messages.find((m) => m.role === "system")?.content || "";
		const chat = messages.filter((m) => m.role !== "system");
		const contents = chat.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
		const body = { contents };
		if (systemMsg) body.system_instruction = { parts: [{ text: systemMsg }] };
		const ac = new AbortController();
		setTimeout(() => { try { ac.abort(); } catch {} }, 20000);
		const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + key, {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal,
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
	} catch { return null; }
}

async function askHuggingFace(messages) {
	const systemMsg = messages.find((m) => m.role === "system")?.content || "You are a helpful assistant.";
	const chat = messages.filter((m) => m.role !== "system");
	const lastUser = chat.filter((m) => m.role === "user").pop()?.content || "";
	if (!lastUser) return null;
	let prompt = systemMsg + "\n\n";
	for (const m of chat.slice(-6)) prompt += (m.role === "user" ? "User: " : "Assistant: ") + m.content + "\n";
	prompt += "Assistant: ";
	for (const model of HF_MODELS) {
		try {
			const ac = new AbortController();
			setTimeout(() => { try { ac.abort(); } catch {} }, 45000);
			const doFetch = () => fetch("https://api-inference.huggingface.co/models/" + model, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512, temperature: 0.7, return_full_text: false } }),
				signal: ac.signal,
			});
			let res = await doFetch();
			if (res.status === 503) {
				let wait = 8;
				try { const err = await res.json(); wait = Math.min(err.estimated_time || 8, 15); } catch {}
				await delay(wait * 1000);
				res = await doFetch();
				if (!res.ok) continue;
			} else if (!res.ok) { continue; }
			const data = await res.json();
			const text = (Array.isArray(data) ? data[0]?.generated_text : data.generated_text) || "";
			if (text.trim()) return text.trim();
		} catch { continue; }
	}
	return null;
}

async function askKobold(messages) {
	const last = messages.filter((m) => m.role === "user").pop()?.content;
	if (!last) return null;
	try {
		const ac = new AbortController();
		setTimeout(() => { try { ac.abort(); } catch {} }, 30000);
		const res = await fetch("https://lite.koboldai.net/api/v1/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt: "User: " + last + "\nAssistant:", max_context_length: 512, max_length: 256, temperature: 0.7 }),
			signal: ac.signal,
		});
		if (!res.ok) return null;
		const data = await res.json();
		const text = data.results?.[0]?.text || "";
		return text.trim() || null;
	} catch { return null; }
}

// Shared reply pipeline: OpenRouter free models → Pollinations (keyless)
// → Gemini → HF → Kobold. Used by the public /api/ai/chat route AND by
// Jarvis AI in the owner panel (panel passes its stored OpenRouter key
// as opts.openrouterKey). Returns a reply string, or null on total failure.
export async function askAIReply(messages, opts = {}) {
	aiDeadline = Date.now() + (opts.timeoutMs || 75000);
	const agent = !!opts.agent;
	const maxTokens = opts.maxTokens || (agent ? 3000 : 0);
	const steps = agent
		// Agent mode: only backends that honour the full multi-turn history.
		? [
			() => callOpenRouter(messages, opts.openrouterKey || "", maxTokens, 0.3),
			() => askPollinations(messages, maxTokens, 0.3, false),
			() => askGemini(messages),
		]
		: [
			() => callOpenRouter(messages, opts.openrouterKey || ""),
			() => askPollinations(messages),
			() => askGemini(messages),
			() => askHuggingFace(messages),
			() => askKobold(messages),
		];
	for (const step of steps) {
		if (Date.now() > aiDeadline) break;
		try {
			const text = await step();
			if (text) return String(text).slice(0, agent ? 30000 : 6000);
		} catch { /* try next backend */ }
	}
	return null;
}

// Friendly local reply when every AI backend is unreachable (no valid
// key / rate-limited). Keeps the widget alive instead of erroring out.
function localChatFallback(messages) {
	const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
	const t = last.toLowerCase().trim();
	if (/^(hi|hello|hey|yo|sup|greetings)\b/.test(t))
		return "Hey! I'm Clash AI, the Clash Proxy assistant. My AI backends are taking a break right now, but I'll be back online shortly — ask me again in a minute.";
	if (/who are you|what are you/.test(t))
		return "I'm Clash AI — the chat assistant built into Clash Proxy. I chat about anything, but I can't touch the site itself; administration happens in the owner's panel.";
	if (/thank/.test(t)) return "You're welcome!";
	if (/how are you/.test(t)) return "Running smooth — though the AI backends are a bit congested right now. Try me again in a minute!";
	if (/\bhelp\b/.test(t))
		return "I'm a chat-only assistant: ask me questions, brainstorm, or chat about Clash Proxy. (Site moderation and game management are handled by the owner in their panel.)";
	return "My AI backends are unreachable right now (no valid key or rate-limited), so I can only give you this canned reply for the moment. Try again in a minute!";
}

export default async function aiRoutes(fastify) {
	// Chat-only AI. No session auth required; no site powers exposed.
	fastify.post("/api/ai/chat", async (req, reply) => {
		const messages = sanitizeMessages(req.body?.messages);
		if (!messages.length) return reply.code(400).send({ error: "messages required" });
		messages.unshift({ role: "system", content: SYS_PROMPT });

		const auth = extractAuthUser(req);
		const lastMsg = messages[messages.length - 1]?.content || "";
		recordActivity(auth?.id || 0, "ai_query", { promptSnippet: lastMsg.slice(0, 100) });

		const text = await askAIReply(messages);
		if (text) return { reply: text };
		// All backends failed → stay alive with a friendly local reply.
		return { reply: localChatFallback(messages), source: "local" };
	});
}
