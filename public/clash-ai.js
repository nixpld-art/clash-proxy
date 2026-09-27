// ============================================================
// Clash AI — floating chat widget for the main site.
// Chat-only assistant (see src/routes/ai.js). No site powers.
// ============================================================
(function () {
	"use strict";

	const SYS_PROMPT =
		"You are Clash AI, the friendly built-in chat assistant of Clash Proxy, a browser proxy and gaming website. " +
		"You are a pure chat assistant: you cannot control, modify, or inspect the website, its games, its users, or any moderation tools, " +
		"and you must never claim that you can. Keep answers concise, helpful and friendly. " +
		"If someone asks you to administer the site (ban a user, add a game, change settings), explain that site administration is done " +
		"by the owner directly in the Owner Panel, not by you.";

	let open = false;
	let busy = false;
	let history = [];
	let promptSession = null;

	/* ---------- DOM ---------- */
	const btn = document.createElement("button");
	btn.id = "cai-btn";
	btn.setAttribute("aria-label", "Open Clash AI");
	btn.innerHTML = "✦<span class='cai-btn-label'>AI</span>";

	const panel = document.createElement("div");
	panel.id = "cai-panel";
	panel.innerHTML =
		"<div class='cai-head'>" +
		"<span class='cai-dot'></span><b>Clash AI</b>" +
		"<span class='cai-sub'>chat only · no site powers</span>" +
		"<button class='cai-close' id='cai-close' aria-label='Close'>✕</button>" +
		"</div>" +
		"<div class='cai-msgs' id='cai-msgs'></div>" +
		"<div class='cai-typing' id='cai-typing' style='display:none'><i></i><i></i><i></i></div>" +
		"<form class='cai-form' id='cai-form'>" +
		"<input id='cai-input' type='text' autocomplete='off' maxlength='2000' placeholder='Ask Clash AI anything...' />" +
		"<button type='submit' id='cai-send' aria-label='Send'>➤</button>" +
		"</form>";

	document.addEventListener("DOMContentLoaded", () => {
		document.body.appendChild(btn);
		document.body.appendChild(panel);
		addBubble("assistant", "Hi! I'm Clash AI — ask me anything about Clash Proxy, games, or just chat.", true);
	});

	function msgs() { return document.getElementById("cai-msgs"); }
	function typing() { return document.getElementById("cai-typing"); }

	function esc(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	}
	function render(s) {
		return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
	}

	function addBubble(role, text, isIntro) {
		const box = msgs();
		if (!box) return null;
		const el = document.createElement("div");
		el.className = "cai-msg " + (role === "user" ? "cai-user" : "cai-ai");
		if (isIntro) el.classList.add("cai-intro");
		el.innerHTML = "<div class='cai-bubble'>" + render(text) + "</div>";
		box.appendChild(el);
		box.scrollTop = box.scrollHeight;
		return el;
	}

	function setOpen(v) {
		open = v;
		panel.classList.toggle("open", open);
		if (open) setTimeout(() => document.getElementById("cai-input")?.focus(), 60);
	}

	btn.addEventListener("click", () => setOpen(!open));
	document.addEventListener("click", (e) => {
		if (open && !panel.contains(e.target) && !btn.contains(e.target)) setOpen(false);
	});
	document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) setOpen(false); });
	document.addEventListener("DOMContentLoaded", () => {
		document.getElementById("cai-close").addEventListener("click", () => setOpen(false));
		document.getElementById("cai-form").addEventListener("submit", (e) => {
			e.preventDefault();
			const input = document.getElementById("cai-input");
			const text = (input?.value || "").trim();
			if (!text || busy) return;
			input.value = "";
			send(text);
		});
	});

	/* ---------- Chrome built-in Prompt API (local model) ---------- */
	async function chromeAI(text) {
		try {
			if (!promptSession) {
				const factory = (window.ai && window.ai.languageModel && window.ai.languageModel.create)
					? window.ai.languageModel
					: (window.LanguageModel && window.LanguageModel.create) ? window.LanguageModel : null;
				if (!factory) return null;
				promptSession = await factory.create({ systemPrompt: SYS_PROMPT, initialPrompts: [] });
			}
			const ac = new AbortController();
			// Short budget: if the local model isn't ready quickly, fall back to the server.
			setTimeout(() => { try { ac.abort(); } catch {} }, 12000);
			return await promptSession.prompt(text, { signal: ac.signal });
		} catch {
			promptSession = null;
			return null;
		}
	}

	/* ---------- Server fallback ---------- */
	async function serverAI() {
		const res = await fetch("/api/ai/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: history.slice(-10) }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || "AI unavailable");
		return data.reply;
	}

	async function send(text) {
		history.push({ role: "user", content: text });
		addBubble("user", text);
		busy = true;
		const t = typing();
		if (t) t.style.display = "flex";
		const el = addBubble("assistant", "…");
		try {
			let reply = await chromeAI(text);
			if (!reply) reply = await serverAI();
			if (!reply) throw new Error("empty");
			el.innerHTML = render(reply);
		} catch (e) {
			el.classList.add("cai-error");
			el.innerHTML = render("⚠ AI is offline right now (all backends busy). Try again in a minute.");
		} finally {
			history.push({ role: "assistant", content: el.textContent.replace(/^…$/, "") || "" });
			if (t) t.style.display = "none";
			busy = false;
			const box = msgs();
			if (box) box.scrollTop = box.scrollHeight;
		}
	}
})();
