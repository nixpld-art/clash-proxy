"use strict";

/**
 * Aura OS 2.0 — Autonomous Web & Arcade Engine
 *
 * Full Feature Architecture:
 * - Anonymous Device Vault (zero registration / zero personal identities)
 * - 3 Proxy Engine Modes: Auto (Recommended), Service Worker (Scramjet V2), Classic (No SW)
 * - Search Engine selector (Google, DuckDuckGo, Bing, Brave, Yahoo)
 * - Aura Shield & AdBlocker integration
 * - Chromebook Optimizer (Static BG, Light UI, Frame boost, Resolution scaling)
 * - Ghost Mode (zero trace privacy)
 * - Complete Cloak Suite (Drive, Classroom, Canvas, Khan, Custom, Panic Key with Custom URL)
 * - About:Blank Cloaker with Decoy Redirect & Auto-Launch
 * - 3,958+ Unblocked Arcade catalog with instant search & pagination
 * - Aura Intelligence AI Assistant
 * - School-safe Sound FX Deck
 * - Secret Operator Modal with Anonymous Device KPIs & Owner Panel login for Nils, Ted, Ozzy
 */

// ============================================================
// 1. Toast Notification Utility
// ============================================================
const toastEl = document.getElementById("aura-toast");
let toastTimer = null;
function showToast(message, duration = 3000) {
	if (!toastEl) return;
	toastEl.textContent = message;
	toastEl.classList.remove("hidden");
	toastEl.classList.add("visible");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toastEl.classList.remove("visible");
		setTimeout(() => toastEl.classList.add("hidden"), 300);
	}, duration);
}

// ============================================================
// 2. Anonymous Device Vault Key Architecture
// ============================================================
function generateVaultId() {
	const rand = () => Math.random().toString(36).substring(2, 6).toUpperCase();
	return `AURA-${rand()}-${rand()}`;
}

let vaultId = localStorage.getItem("aura_vault_id");
const urlParams = new URLSearchParams(window.location.search);
const hashVault = window.location.hash.match(/[#&]vault=([A-Za-z0-9_-]+)/);
const importedVault = urlParams.get("vault") || (hashVault && hashVault[1]);

if (importedVault) {
	vaultId = importedVault.toUpperCase();
	localStorage.setItem("aura_vault_id", vaultId);
} else if (!vaultId) {
	vaultId = generateVaultId();
	localStorage.setItem("aura_vault_id", vaultId);
}

const vaultDisplay = document.getElementById("vault-key-display");
const vaultFull = document.getElementById("vault-key-full");
const vaultPill = document.getElementById("vault-key-pill");
const copyVaultBtn = document.getElementById("copy-vault-btn");
const importVaultBtn = document.getElementById("import-vault-btn");

if (vaultDisplay) vaultDisplay.textContent = vaultId;
if (vaultFull) vaultFull.textContent = vaultId;

function copyVaultKey() {
	if (!vaultId) return;
	navigator.clipboard.writeText(vaultId).then(() => {
		showToast("✓ Anonymous Vault Key copied to clipboard!");
	}).catch(() => {
		showToast(`Vault Key: ${vaultId}`);
	});
}
if (vaultPill) vaultPill.addEventListener("click", copyVaultKey);
if (copyVaultBtn) copyVaultBtn.addEventListener("click", copyVaultKey);

if (importVaultBtn) {
	importVaultBtn.addEventListener("click", () => {
		const entered = prompt("Enter or paste your Vault Key (e.g. AURA-XXXX-XXXX):", vaultId);
		if (entered && entered.trim()) {
			const cleaned = entered.trim().toUpperCase();
			localStorage.setItem("aura_vault_id", cleaned);
			showToast("✓ Vault Key updated! Reloading...");
			setTimeout(() => location.reload(), 600);
		}
	});
}

// Ghost mode check
function isGhostMode() {
	return localStorage.getItem("aura_ghost_mode") === "true";
}

// Telemetry & Activity Tracker (Guest ID based)
function trackActivity(type, data = {}) {
	if (isGhostMode()) return;
	try {
		fetch("/api/activity/track", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Guest-Id": vaultId
			},
			body: JSON.stringify({ type, data, guestId: vaultId })
		}).catch(() => {});
	} catch (e) {}
}
trackActivity("aura_session_start");

// ============================================================
// 3. View Management (Floating Island Dock)
// ============================================================
const dockItems = document.querySelectorAll(".dock-item");
const views = document.querySelectorAll(".aura-view");
const brandHomeBtn = document.getElementById("brand-home-btn");

function switchView(viewName) {
	views.forEach(v => {
		if (v.id === `view-${viewName}`) {
			v.classList.add("active");
		} else {
			v.classList.remove("active");
		}
	});

	dockItems.forEach(item => {
		if (item.dataset.view === viewName) {
			item.classList.add("active");
		} else {
			item.classList.remove("active");
		}
	});

	window.scrollTo({ top: 0, behavior: "smooth" });
}

dockItems.forEach(item => {
	item.addEventListener("click", () => {
		const target = item.dataset.view;
		if (target) switchView(target);
	});
});

if (brandHomeBtn) {
	brandHomeBtn.addEventListener("click", () => switchView("browse"));
}

// ============================================================
// 4. Scramjet V2 & Classic Fallback Proxy Engine
// ============================================================
const PROXY_MODE_KEY = "aura_proxy_mode";
function getProxyMode() {
	const mode = localStorage.getItem(PROXY_MODE_KEY);
	return mode === "sw" || mode === "classic" ? mode : "auto";
}

let sjController = null;
let classicMode = false;
let activeProxyIframe = null;

const initSWPromise = (async () => {
	const chosenMode = getProxyMode();
	if (chosenMode === "classic") {
		classicMode = true;
		console.log("[Aura] Forced Classic mode via user settings");
		return false;
	}

	try {
		if (!("serviceWorker" in navigator)) {
			classicMode = true;
			return false;
		}

		let registration = null;
		try {
			registration = await Promise.race([
				typeof registerSW === "function" ? registerSW() : Promise.reject(new Error("registerSW missing")),
				new Promise((_, rej) => setTimeout(() => rej(new Error("sw_timeout")), 5000))
			]);
		} catch (swErr) {
			if (chosenMode === "auto") {
				classicMode = true;
				console.log("[Aura] SW blocked or timed out, auto falling back to Classic mode");
				return false;
			}
			throw swErr;
		}

		if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
			await new Promise(res => {
				navigator.serviceWorker.addEventListener("controllerchange", () => res(), { once: true });
				setTimeout(res, 500);
			});
		}

		const swController = (navigator.serviceWorker && navigator.serviceWorker.controller) || (registration && registration.active);
		const workerPath = (typeof _CONFIG !== "undefined" && _CONFIG.baremuxWorkerPath) ? _CONFIG.baremuxWorkerPath : "/baremux/worker.js";
		const transportPath = (typeof _CONFIG !== "undefined" && _CONFIG.transportPath) ? _CONFIG.transportPath : "/libcurl/index.mjs";
		const wispUrl = (typeof _CONFIG !== "undefined" && _CONFIG.wispUrl) ? _CONFIG.wispUrl : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;

		let transportAdapter = null;
		try {
			const libcurlMod = await import(transportPath);
			const LibcurlClass = libcurlMod.default;
			const libcurlClient = new LibcurlClass({ wisp: wispUrl });
			for (let i = 0; i < 30 && !libcurlClient.ready; i++) {
				try { await libcurlClient.init(); } catch (e) { await new Promise(r => setTimeout(r, 400)); }
			}
			transportAdapter = {
				ready: true,
				init: async () => {},
				request: async (remote, method, body, headers, signal) => {
					let hdrs = headers;
					if (hdrs && typeof hdrs.entries === "function" && !Array.isArray(hdrs)) hdrs = Array.from(hdrs.entries());
					return libcurlClient.request(remote, method, body, hdrs, signal);
				},
				connect: (remote, protocols) => libcurlClient.connect(remote, protocols)
			};
		} catch (tpErr) {
			console.warn("[Aura] libcurl transport fallback to classic:", tpErr);
			classicMode = true;
			return false;
		}

		if (transportAdapter) {
			const controllerGlobal = window.$scramjetController || (typeof $scramjetController !== "undefined" ? $scramjetController : null);
			const ControllerClass = controllerGlobal ? (controllerGlobal.Controller || controllerGlobal.ScramjetController) : null;
			if (ControllerClass) {
				sjController = new ControllerClass({
					serviceworker: swController,
					config: {
						prefix: (typeof _CONFIG !== "undefined" && _CONFIG.prefix) || "/scram/service/",
						scramjetPath: "/scram/scramjet.js",
						injectPath: "/controller/controller.inject.js",
						wasmPath: "/scram/scramjet.wasm",
						codec: {
							encode: (e) => e ? encodeURIComponent(e) : e,
							decode: (e) => e ? decodeURIComponent(e) : e,
						}
					},
					transport: transportAdapter,
				});
				if (typeof sjController.init === "function") await sjController.init();
			}
		}

		if (!sjController && chosenMode === "auto") classicMode = true;
		return true;
	} catch (err) {
		classicMode = true;
		return false;
	}
})();

// Search Engine Resolution
const SEARCH_ENGINES = {
	google: "https://www.google.com/search?q=%s",
	duckduckgo: "https://duckduckgo.com/?q=%s",
	bing: "https://www.bing.com/search?q=%s",
	brave: "https://search.brave.com/search?q=%s",
	yahoo: "https://search.yahoo.com/search?p=%s"
};

function getSearchEngineTemplate() {
	const saved = localStorage.getItem("aura_search_engine") || "google";
	return SEARCH_ENGINES[saved] || SEARCH_ENGINES.google;
}

function resolveSearchUrl(input) {
	if (!input) return "";
	const trimmed = input.trim();
	if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("http://localhost") || trimmed.startsWith("http://127.0.0.1")) {
		return trimmed;
	}
	try {
		return new URL(trimmed).toString();
	} catch (e) {}
	try {
		const u = new URL(`https://${trimmed}`);
		if (u.hostname.includes(".")) return u.toString();
	} catch (e) {}
	const template = getSearchEngineTemplate();
	return template.replace("%s", encodeURIComponent(trimmed));
}

// Proxy Browser UI Controls
const omnibarInput = document.getElementById("omnibar-input");
const omnibarGoBtn = document.getElementById("omnibar-go-btn");
const omnibarEngineBadge = document.getElementById("omnibar-engine-badge");
const proxyDeck = document.getElementById("proxy-frame-deck");
const proxyHost = document.getElementById("proxy-frames-host");
const deckUrl = document.getElementById("deck-current-url");
const deckBackBtn = document.getElementById("deck-back-btn");
const deckForwardBtn = document.getElementById("deck-forward-btn");
const deckReloadBtn = document.getElementById("deck-reload-btn");
const deckAboutblankBtn = document.getElementById("deck-aboutblank-btn");
const deckCloseBtn = document.getElementById("deck-close-btn");

function updateOmnibarEngineBadge() {
	if (!omnibarEngineBadge) return;
	const currentEngine = localStorage.getItem("aura_search_engine") || "google";
	const labels = { google: "Google", duckduckgo: "DuckDuckGo", bing: "Bing", brave: "Brave", yahoo: "Yahoo" };
	omnibarEngineBadge.textContent = labels[currentEngine] || "Google";
}
updateOmnibarEngineBadge();

let currentNavigatedUrl = "";

async function navigateProxy(rawInput) {
	if (!rawInput) return;
	const targetUrl = resolveSearchUrl(rawInput);
	currentNavigatedUrl = targetUrl;

	if (deckUrl) deckUrl.textContent = targetUrl;
	if (proxyDeck) proxyDeck.classList.remove("hidden");
	switchView("browse");

	// Clean out previous frame
	if (proxyHost) proxyHost.innerHTML = "";
	const iframe = document.createElement("iframe");
	iframe.className = "proxy-frame";
	iframe.allow = "camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen";
	iframe.setAttribute("allowfullscreen", "true");
	activeProxyIframe = iframe;
	if (proxyHost) proxyHost.appendChild(iframe);

	trackActivity("proxy_browse", { target: targetUrl });

	await initSWPromise;

	const isYouTube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\b/i.test(targetUrl);
	const mode = getProxyMode();
	let routed = false;

	if (mode !== "classic" && !classicMode && !isYouTube && sjController) {
		try {
			const frame = sjController.createFrame(iframe);
			frame.go(targetUrl);
			routed = true;
		} catch (e) {
			console.warn("[Aura] Scramjet route retry:", e);
			try {
				if (typeof sjController.wait === "function") await sjController.wait();
				const frame = sjController.createFrame(iframe);
				frame.go(targetUrl);
				routed = true;
			} catch (e2) {}
		}
	}

	if (!routed) {
		// Classic server-side fallback
		iframe.src = (mode === "classic" || classicMode || isYouTube)
			? "/classic/" + targetUrl
			: "/scram/service/" + encodeURIComponent(targetUrl);
	}
}

function handleOmnibarSubmit() {
	const val = omnibarInput ? omnibarInput.value.trim() : "";
	if (val) navigateProxy(val);
}

if (omnibarInput) {
	omnibarInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleOmnibarSubmit();
		}
	});
}
if (omnibarGoBtn) omnibarGoBtn.addEventListener("click", handleOmnibarSubmit);

// Speed dial clicks
document.querySelectorAll(".speed-dial-item").forEach(btn => {
	btn.addEventListener("click", () => {
		const u = btn.dataset.url;
		if (u) navigateProxy(u);
	});
});

// Deck Controls
if (deckBackBtn) deckBackBtn.addEventListener("click", () => {
	if (activeProxyIframe && activeProxyIframe.contentWindow) {
		try { activeProxyIframe.contentWindow.history.back(); } catch (e) {}
	}
});
if (deckForwardBtn) deckForwardBtn.addEventListener("click", () => {
	if (activeProxyIframe && activeProxyIframe.contentWindow) {
		try { activeProxyIframe.contentWindow.history.forward(); } catch (e) {}
	}
});
if (deckReloadBtn) deckReloadBtn.addEventListener("click", () => {
	if (activeProxyIframe) {
		const src = activeProxyIframe.src;
		activeProxyIframe.src = src;
	}
});
if (deckCloseBtn) deckCloseBtn.addEventListener("click", () => {
	if (proxyDeck) proxyDeck.classList.add("hidden");
	if (proxyHost) proxyHost.innerHTML = "";
	activeProxyIframe = null;
});
if (deckAboutblankBtn) deckAboutblankBtn.addEventListener("click", () => {
	if (currentNavigatedUrl) openInAboutBlank(currentNavigatedUrl);
});

// ============================================================
// 5. Arcade Matrix (3,958 Games Catalog)
// ============================================================
let allGamesList = [];
let filteredGamesList = [];
let renderedGameCount = 0;
const BATCH_SIZE = 60;
let activeCategory = "all";

const arcadeGrid = document.getElementById("arcade-games-grid");
const arcadeSearchInput = document.getElementById("arcade-search-input");
const arcadeCountPill = document.getElementById("arcade-count-pill");
const topbarStats = document.getElementById("topbar-stats");
const catChips = document.querySelectorAll("#arcade-cat-chips .cat-chip");

const playerModal = document.getElementById("arcade-player-modal");
const playerContainer = document.getElementById("player-frame-container");
const playerTitle = document.getElementById("player-game-title");
const playerCloseBtn = document.getElementById("player-close-btn");
const playerFullscreenBtn = document.getElementById("player-fullscreen-btn");
const playerAboutblankBtn = document.getElementById("player-aboutblank-btn");
let activeGameUrl = "";

async function loadArcadeCatalog() {
	try {
		const res = await fetch("/api/games");
		if (!res.ok) throw new Error("Catalog fetch failed");
		const data = await res.json();
		allGamesList = Array.isArray(data) ? data : (data.games || []);

		const totalCount = allGamesList.length;
		if (arcadeCountPill) arcadeCountPill.textContent = `${totalCount.toLocaleString()} Games`;
		if (topbarStats) topbarStats.textContent = `${totalCount.toLocaleString()} Games Ready`;

		applyFilterAndSearch();
	} catch (err) {
		console.error("[Aura] Games load failed:", err);
		if (arcadeGrid) {
			arcadeGrid.innerHTML = `<div class="loading-state">Failed to load games catalog. Server reconnecting...</div>`;
		}
	}
}

function applyFilterAndSearch() {
	const query = arcadeSearchInput ? arcadeSearchInput.value.trim().toLowerCase() : "";

	filteredGamesList = allGamesList.filter(game => {
		const title = (game.title || "").toLowerCase();
		const cat = (game.category || "").toLowerCase();

		const matchesQuery = !query || title.includes(query) || cat.includes(query);
		if (!matchesQuery) return false;

		if (activeCategory === "all") return true;
		if (activeCategory === "popular") return game.popular || title.includes("mad") || title.includes("slope") || title.includes("minecraft") || title.includes("geometry") || title.includes("retro bowl");
		return cat.includes(activeCategory) || title.includes(activeCategory);
	});

	if (arcadeCountPill) {
		arcadeCountPill.textContent = `${filteredGamesList.length.toLocaleString()} Games`;
	}

	renderedGameCount = 0;
	if (arcadeGrid) arcadeGrid.innerHTML = "";
	renderNextGamesBatch();
}

function renderNextGamesBatch() {
	if (!arcadeGrid) return;
	if (filteredGamesList.length === 0) {
		arcadeGrid.innerHTML = `<div class="loading-state">No games match your search query.</div>`;
		return;
	}

	const batch = filteredGamesList.slice(renderedGameCount, renderedGameCount + BATCH_SIZE);
	if (batch.length === 0) return;

	const frag = document.createDocumentFragment();

	batch.forEach(game => {
		const card = document.createElement("div");
		card.className = "game-card";
		card.dataset.url = game.url;
		card.dataset.title = game.title;

		const iconChar = game.icon || "🕹️";
		card.innerHTML = `
			<div class="game-thumb">
				<span class="game-thumb-icon">${iconChar}</span>
			</div>
			<div class="game-meta">
				<span class="game-title" title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</span>
				<span class="game-cat">${escapeHtml(game.category || "Arcade")}</span>
			</div>
		`;

		card.addEventListener("click", () => {
			launchGame(game);
		});

		frag.appendChild(card);
	});

	arcadeGrid.appendChild(frag);
	renderedGameCount += batch.length;
}

// Infinite scroll on games grid
window.addEventListener("scroll", () => {
	const arcadeView = document.getElementById("view-arcade");
	if (!arcadeView || !arcadeView.classList.contains("active")) return;
	if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
		if (renderedGameCount < filteredGamesList.length) {
			renderNextGamesBatch();
		}
	}
});

// Category filtering
catChips.forEach(chip => {
	chip.addEventListener("click", () => {
		catChips.forEach(c => c.classList.remove("active"));
		chip.classList.add("active");
		activeCategory = chip.dataset.cat || "all";
		applyFilterAndSearch();
	});
});

// Search input debounce
let searchDebounce = null;
if (arcadeSearchInput) {
	arcadeSearchInput.addEventListener("input", () => {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(applyFilterAndSearch, 250);
	});
}

// Game Launcher
function launchGame(game) {
	if (!game || !game.url) return;
	activeGameUrl = game.url.startsWith("/") ? game.url : "/" + game.url;

	if (playerTitle) playerTitle.textContent = game.title || "Game Player";
	if (playerContainer) {
		playerContainer.innerHTML = "";
		const iframe = document.createElement("iframe");
		iframe.className = "player-iframe";
		iframe.allow = "autoplay; fullscreen; camera; microphone; gamepad";
		iframe.setAttribute("allowfullscreen", "true");
		iframe.src = activeGameUrl;

		// Apply resolution scale if set
		const resScale = parseFloat(localStorage.getItem("aura_perf_resolution") || "1");
		if (resScale < 1) {
			iframe.style.transform = `scale(${resScale})`;
			iframe.style.transformOrigin = "top left";
			iframe.style.width = `${100 / resScale}%`;
			iframe.style.height = `${100 / resScale}%`;
		}

		playerContainer.appendChild(iframe);
	}

	if (playerModal) playerModal.classList.remove("hidden");
	trackActivity("game_play", { title: game.title, url: activeGameUrl });
}

function closeGamePlayer() {
	if (playerModal) playerModal.classList.add("hidden");
	if (playerContainer) playerContainer.innerHTML = "";
	activeGameUrl = "";
}

if (playerCloseBtn) playerCloseBtn.addEventListener("click", closeGamePlayer);

if (playerFullscreenBtn) {
	playerFullscreenBtn.addEventListener("click", () => {
		const iframe = playerContainer ? playerContainer.querySelector("iframe") : null;
		if (iframe && iframe.requestFullscreen) {
			iframe.requestFullscreen().catch(() => {});
		}
	});
}

if (playerAboutblankBtn) {
	playerAboutblankBtn.addEventListener("click", () => {
		if (activeGameUrl) {
			openInAboutBlank(window.location.origin + activeGameUrl);
		}
	});
}

// ============================================================
// 6. Aura Intelligence (AI Chat Assistant)
// ============================================================
const aiMsgBox = document.getElementById("ai-messages-box");
const aiInput = document.getElementById("ai-chat-input");
const aiSendBtn = document.getElementById("ai-send-btn");
const aiHistory = [];

async function sendAiMessage() {
	if (!aiInput) return;
	const text = aiInput.value.trim();
	if (!text) return;
	aiInput.value = "";

	// Render User message
	appendAiBubble("user", text);
	aiHistory.push({ role: "user", content: text });

	// Typing indicator
	const typingBubble = appendAiBubble("bot", "Thinking...");

	try {
		trackActivity("ai_query", { promptSnippet: text.slice(0, 100) });
		const res = await fetch("/api/ai/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: aiHistory.slice(-8) })
		});

		const data = await res.json();
		const reply = data.reply || "I didn't quite catch that. Could you rephrase?";
		typingBubble.querySelector(".msg-bubble").innerHTML = escapeHtml(reply).replace(/\n/g, "<br>");
		aiHistory.push({ role: "assistant", content: reply });
	} catch (err) {
		typingBubble.querySelector(".msg-bubble").textContent = "Service temporarily unavailable. Please try again in a moment.";
	}
}

function appendAiBubble(sender, text) {
	const row = document.createElement("div");
	row.className = `ai-msg ${sender}`;
	const bubble = document.createElement("div");
	bubble.className = "msg-bubble";
	bubble.textContent = text;
	row.appendChild(bubble);
	if (aiMsgBox) {
		aiMsgBox.appendChild(row);
		aiMsgBox.scrollTop = aiMsgBox.scrollHeight;
	}
	return row;
}

if (aiSendBtn) aiSendBtn.addEventListener("click", sendAiMessage);
if (aiInput) {
	aiInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			sendAiMessage();
		}
	});
}

// ============================================================
// 7. Sound FX Deck
// ============================================================
const soundGrid = document.getElementById("soundboard-grid");
const sbStopBtn = document.getElementById("sb-stop-btn");
let activeAudio = null;

async function loadSoundboard() {
	try {
		const res = await fetch("/api/soundboard/sounds");
		if (!res.ok) throw new Error("Soundboard fetch failed");
		const data = await res.json();
		const sounds = data.sounds || [];

		if (soundGrid) {
			soundGrid.innerHTML = "";
			sounds.forEach(snd => {
				const card = document.createElement("button");
				card.className = "sound-btn";
				card.innerHTML = `
					<span class="sb-icon">${snd.icon || "🔊"}</span>
					<span class="sb-title">${escapeHtml(snd.title)}</span>
				`;
				card.addEventListener("click", () => {
					playSound(snd.id);
				});
				soundGrid.appendChild(card);
			});
		}
	} catch (e) {
		if (soundGrid) soundGrid.innerHTML = `<div class="loading-state">Sounds offline.</div>`;
	}
}

function playSound(soundId) {
	if (activeAudio) {
		activeAudio.pause();
		activeAudio = null;
	}
	const audio = new Audio(`/api/soundboard/audio/${soundId}`);
	activeAudio = audio;
	audio.play().catch(() => {});
	trackActivity("soundboard_play", { soundId });
}

if (sbStopBtn) {
	sbStopBtn.addEventListener("click", () => {
		if (activeAudio) {
			activeAudio.pause();
			activeAudio = null;
		}
	});
}

// ============================================================
// 8. Stealth Cloaking, About:Blank & Panic Key
// ============================================================
const PRESETS = {
	classroom: { title: "Classes", icon: "https://ssl.gstatic.com/classroom/favicon.png" },
	drive: { title: "My Drive - Google Drive", icon: "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png" },
	canvas: { title: "Dashboard", icon: "https://du11hjcvx0uqb.cloudfront.net/br/dist/images/favicon-e10d657a73.ico" },
	khan: { title: "Dashboard | Khan Academy", icon: "https://www.khanacademy.org/favicon.ico" },
	google: { title: "Google", icon: "https://www.google.com/favicon.ico" },
	reset: { title: "Aura — Autonomous Web & Arcade", icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◈</text></svg>" }
};

function applyCloak(presetKey) {
	const p = PRESETS[presetKey];
	if (!p) return;
	document.title = p.title;
	const fav = document.getElementById("aura-favicon");
	if (fav) fav.href = p.icon;

	if (presetKey === "reset") {
		localStorage.removeItem("aura_cloak_preset");
		showToast("Tab restored to Aura default");
	} else {
		localStorage.setItem("aura_cloak_preset", presetKey);
		showToast(`✓ Tab disguised as ${p.title}`);
	}
	trackActivity("stealth_cloak", { preset: presetKey });
}

document.querySelectorAll(".cloak-preset-btn").forEach(btn => {
	btn.addEventListener("click", () => {
		const k = btn.dataset.cloak;
		if (k) applyCloak(k);
	});
});

const quickCloakBtn = document.getElementById("quick-cloak-btn");
if (quickCloakBtn) {
	quickCloakBtn.addEventListener("click", () => {
		applyCloak("drive");
	});
}

// Custom Cloak
const customCloakTitle = document.getElementById("custom-cloak-title");
const customCloakIcon = document.getElementById("custom-cloak-icon");
const customCloakBtn = document.getElementById("custom-cloak-btn");
if (customCloakBtn) {
	customCloakBtn.addEventListener("click", () => {
		const title = customCloakTitle ? customCloakTitle.value.trim() : "";
		const icon = customCloakIcon ? customCloakIcon.value.trim() : "";
		if (title) document.title = title;
		if (icon) {
			const fav = document.getElementById("aura-favicon");
			if (fav) fav.href = icon;
		}
		showToast("✓ Custom tab disguise applied!");
	});
}

// Emergency Panic Key
const panicKeyInput = document.getElementById("panic-key-input");
const panicRedirectInput = document.getElementById("panic-redirect-input");
let currentPanicKey = localStorage.getItem("aura_panic_key") || "`";
let currentPanicUrl = localStorage.getItem("aura_panic_url") || "https://classroom.google.com";

if (panicKeyInput) {
	panicKeyInput.value = currentPanicKey;
	panicKeyInput.addEventListener("input", (e) => {
		currentPanicKey = e.target.value || "`";
		localStorage.setItem("aura_panic_key", currentPanicKey);
		showToast(`Panic key set to: "${currentPanicKey}"`);
	});
}
if (panicRedirectInput) {
	panicRedirectInput.value = currentPanicUrl;
	panicRedirectInput.addEventListener("change", (e) => {
		currentPanicUrl = e.target.value.trim() || "https://classroom.google.com";
		localStorage.setItem("aura_panic_url", currentPanicUrl);
		showToast("Panic redirect destination saved");
	});
}

window.addEventListener("keydown", (e) => {
	if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
	if (e.key === currentPanicKey) {
		e.preventDefault();
		window.location.replace(currentPanicUrl);
	}
});

// about:blank cloak utility
function openInAboutBlank(url = window.location.href, decoy = null) {
	const win = window.open("about:blank", "_blank");
	if (!win) {
		alert("Pop-up blocked! Please allow popups for about:blank cloaking.");
		return;
	}
	win.document.write(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>My Drive - Google Drive</title>
			<link rel="icon" href="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png">
			<style>body,html{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}iframe{border:none;width:100%;height:100%;}</style>
		</head>
		<body>
			<iframe src="${url}"></iframe>
		</body>
		</html>
	`);
	win.document.close();

	if (decoy) {
		window.location.replace(decoy);
	}
}

const topbarAboutBlank = document.getElementById("topbar-aboutblank-btn");
if (topbarAboutBlank) {
	topbarAboutBlank.addEventListener("click", () => openInAboutBlank(window.location.href));
}

const settingAboutBlankLaunchBtn = document.getElementById("setting-aboutblank-launch-btn");
const settingAboutBlankDecoyUrl = document.getElementById("setting-aboutblank-decoy-url");
const settingAboutBlankAutoCloak = document.getElementById("setting-aboutblank-autocloak");

if (settingAboutBlankLaunchBtn) {
	settingAboutBlankLaunchBtn.addEventListener("click", () => {
		const decoy = settingAboutBlankDecoyUrl ? settingAboutBlankDecoyUrl.value.trim() : "https://classroom.google.com";
		openInAboutBlank(window.location.href, decoy);
	});
}

if (settingAboutBlankAutoCloak) {
	settingAboutBlankAutoCloak.checked = localStorage.getItem("aura_autocloak") === "true";
	settingAboutBlankAutoCloak.addEventListener("change", (e) => {
		localStorage.setItem("aura_autocloak", e.target.checked ? "true" : "false");
		showToast(e.target.checked ? "Auto-launch enabled" : "Auto-launch disabled");
	});
}

// Auto-cloak on startup if configured and not already inside an iframe or about:blank
if (localStorage.getItem("aura_autocloak") === "true" && window.top === window.self && !window.location.href.includes("about:blank")) {
	const decoy = localStorage.getItem("aura_decoy_url") || "https://classroom.google.com";
	openInAboutBlank(window.location.href, decoy);
}

// ============================================================
// 9. All Core Settings Wiring (Proxy Engine, Shield, Optimizer)
// ============================================================
// Proxy Mode Dropdown (Auto, SW, Classic)
const settingProxyMode = document.getElementById("setting-proxy-mode");
if (settingProxyMode) {
	settingProxyMode.value = getProxyMode();
	settingProxyMode.addEventListener("change", (e) => {
		localStorage.setItem(PROXY_MODE_KEY, e.target.value);
		showToast(`Proxy mode set to ${e.target.value.toUpperCase()}. Reloading...`);
		setTimeout(() => location.reload(), 600);
	});
}

// Search Engine Dropdown
const settingSearchEngine = document.getElementById("setting-search-engine");
if (settingSearchEngine) {
	settingSearchEngine.value = localStorage.getItem("aura_search_engine") || "google";
	settingSearchEngine.addEventListener("change", (e) => {
		localStorage.setItem("aura_search_engine", e.target.value);
		updateOmnibarEngineBadge();
		showToast(`Search engine set to ${e.target.options[e.target.selectedIndex].text}`);
	});
}

// Ghost Mode Toggle
const settingGhostMode = document.getElementById("setting-ghost-mode");
if (settingGhostMode) {
	settingGhostMode.checked = isGhostMode();
	settingGhostMode.addEventListener("change", (e) => {
		localStorage.setItem("aura_ghost_mode", e.target.checked ? "true" : "false");
		showToast(e.target.checked ? "Ghost Mode ON (Zero history & telemetry)" : "Ghost Mode OFF");
	});
}

// Aura Shield Toggles & Stats
const settingShieldAdblock = document.getElementById("setting-shield-adblock");
const settingShieldPopups = document.getElementById("setting-shield-popups");
const settingShieldDarkmode = document.getElementById("setting-shield-darkmode");
const settingShieldTotalBlocked = document.getElementById("setting-shield-total-blocked");
const settingShieldDataSaved = document.getElementById("setting-shield-data-saved");
const settingShieldClearStats = document.getElementById("setting-shield-clear-stats");

function updateShieldDisplay() {
	if (typeof ClashShield !== "undefined") {
		const stats = ClashShield.getStats();
		if (settingShieldTotalBlocked) settingShieldTotalBlocked.textContent = (stats.totalBlocked || 0).toLocaleString();
		if (settingShieldDataSaved) {
			const kb = (stats.totalBlocked || 0) * 45;
			settingShieldDataSaved.textContent = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
		}
		if (settingShieldAdblock) settingShieldAdblock.checked = ClashShield.isEnabled();
		if (settingShieldPopups) settingShieldPopups.checked = ClashShield.isBlockPopups();
		if (settingShieldDarkmode) settingShieldDarkmode.checked = ClashShield.isDarkMode();
	}
}

if (settingShieldAdblock) {
	settingShieldAdblock.addEventListener("change", (e) => {
		if (typeof ClashShield !== "undefined") ClashShield.setEnabled(e.target.checked);
		showToast(e.target.checked ? "Aura AdBlocker Enabled" : "Aura AdBlocker Disabled");
	});
}
if (settingShieldPopups) {
	settingShieldPopups.addEventListener("change", (e) => {
		if (typeof ClashShield !== "undefined") ClashShield.setBlockPopups(e.target.checked);
		showToast(e.target.checked ? "Popup Blocker Enabled" : "Popup Blocker Disabled");
	});
}
if (settingShieldDarkmode) {
	settingShieldDarkmode.addEventListener("change", (e) => {
		if (typeof ClashShield !== "undefined") ClashShield.setDarkMode(e.target.checked);
		showToast(e.target.checked ? "Force Dark Mode Enabled" : "Force Dark Mode Disabled");
	});
}
if (settingShieldClearStats) {
	settingShieldClearStats.addEventListener("click", () => {
		if (typeof ClashShield !== "undefined") ClashShield.clearStats();
		updateShieldDisplay();
		showToast("Aura Shield statistics reset");
	});
}

// Chromebook Optimizer Toggles
const settingPerfStaticBg = document.getElementById("setting-perf-staticbg");
const settingPerfLightUi = document.getElementById("setting-perf-lightui");
const settingPerfFrameBoost = document.getElementById("setting-perf-frameboost");
const settingPerfResolution = document.getElementById("setting-perf-resolution");

if (settingPerfStaticBg) {
	settingPerfStaticBg.checked = localStorage.getItem("aura_perf_staticbg") === "true";
	const applyStaticBg = (on) => {
		document.querySelectorAll(".ambient-glow").forEach(el => {
			el.style.display = on ? "none" : "";
		});
	};
	applyStaticBg(settingPerfStaticBg.checked);
	settingPerfStaticBg.addEventListener("change", (e) => {
		localStorage.setItem("aura_perf_staticbg", e.target.checked ? "true" : "false");
		applyStaticBg(e.target.checked);
		showToast(e.target.checked ? "Static background enabled (GPU saved)" : "Dynamic background restored");
	});
}

if (settingPerfLightUi) {
	settingPerfLightUi.checked = localStorage.getItem("aura_perf_lightui") === "true";
	if (settingPerfLightUi.checked) document.body.classList.add("perf-light-ui");
	settingPerfLightUi.addEventListener("change", (e) => {
		localStorage.setItem("aura_perf_lightui", e.target.checked ? "true" : "false");
		if (e.target.checked) document.body.classList.add("perf-light-ui");
		else document.body.classList.remove("perf-light-ui");
		showToast(e.target.checked ? "Light Interface active (Blur removed)" : "Glassmorphism restored");
	});
}

if (settingPerfFrameBoost) {
	settingPerfFrameBoost.checked = localStorage.getItem("aura_perf_frameboost") === "true";
	settingPerfFrameBoost.addEventListener("change", (e) => {
		localStorage.setItem("aura_perf_frameboost", e.target.checked ? "true" : "false");
		showToast(e.target.checked ? "Smooth Frame Boost ON" : "Smooth Frame Boost OFF");
	});
}

if (settingPerfResolution) {
	settingPerfResolution.value = localStorage.getItem("aura_perf_resolution") || "1";
	settingPerfResolution.addEventListener("change", (e) => {
		localStorage.setItem("aura_perf_resolution", e.target.value);
		showToast(`Arcade resolution scale set to ${Math.round(parseFloat(e.target.value) * 100)}%`);
	});
}

// ============================================================
// 10. Operator Telemetry & Owner Access Portal (Nils, Ted, Ozzy)
// ============================================================
const ownerModal = document.getElementById("owner-bridge-modal");
const ownerCloseBtn = document.getElementById("owner-bridge-close");
const ownerRefreshBtn = document.getElementById("owner-refresh-stats");

const kpiLive = document.getElementById("kpi-live-online");
const kpiHour = document.getElementById("kpi-hour-online");
const kpiDay = document.getElementById("kpi-day-online");
const kpiWeek = document.getElementById("kpi-week-online");

const ownerUsernameInput = document.getElementById("owner-login-username");
const ownerPasswordInput = document.getElementById("owner-login-password");
const ownerSubmitBtn = document.getElementById("owner-login-submit");
const ownerMsg = document.getElementById("owner-login-msg");

async function fetchOwnerTelemetry() {
	try {
		const res = await fetch("/api/telemetry/stats");
		if (!res.ok) throw new Error("Stats offline");
		const data = await res.json();

		if (kpiLive) kpiLive.textContent = data.nowTotal.toLocaleString();
		if (kpiHour) kpiHour.textContent = data.lastHrTotal.toLocaleString();
		if (kpiDay) kpiDay.textContent = data.lastDayTotal.toLocaleString();
		if (kpiWeek) kpiWeek.textContent = data.thisWeekTotal.toLocaleString();
	} catch (err) {
		console.warn("[Aura] Telemetry fetch:", err);
	}
}

function openOwnerModal() {
	if (ownerModal) {
		ownerModal.classList.remove("hidden");
		fetchOwnerTelemetry();
	}
}

function closeOwnerModal() {
	if (ownerModal) ownerModal.classList.add("hidden");
}

if (ownerCloseBtn) ownerCloseBtn.addEventListener("click", closeOwnerModal);
if (ownerRefreshBtn) ownerRefreshBtn.addEventListener("click", fetchOwnerTelemetry);

// Secret shortcut: Ctrl + Shift + O opens Owner telemetry
window.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.shiftKey && (e.key === "O" || e.key === "o")) {
		e.preventDefault();
		openOwnerModal();
	}
});

// Secret triple-click on brand glyph
let brandClicks = 0;
let brandTimer = null;
const brandGlyph = document.querySelector(".brand-glyph");
if (brandGlyph) {
	brandGlyph.addEventListener("click", (e) => {
		e.stopPropagation();
		brandClicks++;
		clearTimeout(brandTimer);
		brandTimer = setTimeout(() => { brandClicks = 0; }, 600);
		if (brandClicks >= 3) {
			brandClicks = 0;
			openOwnerModal();
		}
	});
}

// Owner Authentication into /panel
if (ownerSubmitBtn) {
	ownerSubmitBtn.addEventListener("click", async () => {
		const u = ownerUsernameInput ? ownerUsernameInput.value.trim() : "";
		const p = ownerPasswordInput ? ownerPasswordInput.value : "";
		if (!u || !p) {
			if (ownerMsg) {
				ownerMsg.style.color = "#ef4444";
				ownerMsg.textContent = "Please enter both username and password.";
			}
			return;
		}

		if (ownerMsg) {
			ownerMsg.style.color = "#94a3b8";
			ownerMsg.textContent = "Verifying owner credentials...";
		}

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: u, password: p })
			});
			const data = await res.json();
			if (!res.ok) {
				if (ownerMsg) {
					ownerMsg.style.color = "#ef4444";
					ownerMsg.textContent = data.error || "Invalid owner credentials.";
				}
				return;
			}

			if (ownerMsg) {
				ownerMsg.style.color = "#10b981";
				ownerMsg.textContent = `✓ Access granted as @${data.user.username}! Opening Owner Panel...`;
			}

			// Store token and redirect directly to /panel
			if (data.token) {
				localStorage.setItem("clash_jwt_token", data.token);
				setTimeout(() => {
					window.location.href = `/panel/?token=${encodeURIComponent(data.token)}`;
				}, 600);
			}
		} catch (err) {
			if (ownerMsg) {
				ownerMsg.style.color = "#ef4444";
				ownerMsg.textContent = "Connection failed: " + err.message;
			}
		}
	});
}

// Utility: HTML escape
function escapeHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// ============================================================
// 11. Initialization
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
	loadArcadeCatalog();
	loadSoundboard();
	updateShieldDisplay();
});
