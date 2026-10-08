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

// Support cross-mirror progression sync via URL hash or params
const hashXp = window.location.hash.match(/[#&]xp=([0-9]+)/);
const paramXp = urlParams.get("xp") || (hashXp && hashXp[1]);
if (paramXp) {
	const currentXp = parseInt(localStorage.getItem("aura_vault_xp") || "0", 10);
	const importedXp = parseInt(paramXp, 10);
	if (importedXp > currentXp) {
		localStorage.setItem("aura_vault_xp", importedXp.toString());
	}
}

const hashStats = window.location.hash.match(/[#&]stats=([^&]+)/);
const paramStats = urlParams.get("stats") || (hashStats && decodeURIComponent(hashStats[1]));
if (paramStats) {
	try {
		const importedStats = JSON.parse(paramStats);
		const currentStats = JSON.parse(localStorage.getItem("aura_vault_stats") || "{}");
		localStorage.setItem("aura_vault_stats", JSON.stringify({ ...currentStats, ...importedStats }));
	} catch (e) {}
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

// ============================================================
// 2b. Vault Gamification & Cyber Badges Engine
// ============================================================
const VAULT_BADGES = [
	{ id: "first_game", title: "First Spark", desc: "Launch your first arcade game", icon: "/assets/icons/badge-spark.svg", test: (s) => (s.games || 0) >= 1 },
	{ id: "game_10", title: "Arcade Veteran", desc: "Play 10 arcade games", icon: "/assets/icons/badge-veteran.svg", test: (s) => (s.games || 0) >= 10 },
	{ id: "game_50", title: "Master of Grid", desc: "Play 50 arcade games", icon: "/assets/icons/badge-master.svg", test: (s) => (s.games || 0) >= 50 },
	{ id: "first_browse", title: "Ghost Gateway", desc: "Proxy your first web destination", icon: "/assets/icons/badge-gateway.svg", test: (s) => (s.sites || 0) >= 1 },
	{ id: "browse_20", title: "Net Voyager", desc: "Proxy 20 web sessions", icon: "/assets/icons/badge-voyager.svg", test: (s) => (s.sites || 0) >= 20 },
	{ id: "sound_expert", title: "Sonic Disruptor", desc: "Play 5 sound effects", icon: "/assets/icons/badge-sonic.svg", test: (s) => (s.sounds || 0) >= 5 },
	{ id: "ai_convo", title: "Neural Symbiosis", desc: "Converse with Aura Intelligence", icon: "/assets/icons/badge-neural.svg", test: (s) => (s.ai || 0) >= 1 },
	{ id: "stealth_cloak", title: "Ghost Chameleon", desc: "Activate a Stealth Cloak disguise", icon: "/assets/icons/badge-chameleon.svg", test: (s) => (s.cloaks || 0) >= 1 },
	{ id: "about_blank", title: "Null Void", desc: "Launch in about:blank mode", icon: "/assets/icons/badge-void.svg", test: (s) => (s.blank || 0) >= 1 },
	{ id: "speed_dial", title: "Grid Customizer", desc: "Add a custom speed dial shortcut", icon: "/assets/icons/badge-customizer.svg", test: (s) => (s.shortcuts || 0) >= 1 }
];

function getVaultStats() {
	try {
		return JSON.parse(localStorage.getItem("aura_vault_stats")) || { games: 0, sites: 0, sounds: 0, ai: 0, cloaks: 0, blank: 0, shortcuts: 0 };
	} catch (e) {
		return { games: 0, sites: 0, sounds: 0, ai: 0, cloaks: 0, blank: 0, shortcuts: 0 };
	}
}

function saveVaultStats(stats) {
	localStorage.setItem("aura_vault_stats", JSON.stringify(stats));
}

function getVaultProgression() {
	const xp = parseInt(localStorage.getItem("aura_vault_xp") || "0", 10);
	const level = Math.floor(xp / 150) + 1;
	const currentLevelXp = xp % 150;
	const xpToNext = 150;
	const percent = Math.min(100, Math.round((currentLevelXp / 150) * 100));

	let rank = "Novice Netrunner";
	if (level >= 40) rank = "Transcendent Operator";
	else if (level >= 25) rank = "Singularity Architect";
	else if (level >= 15) rank = "Apex Vanguard";
	else if (level >= 10) rank = "Protocol Infiltrator";
	else if (level >= 7) rank = "Matrix Phantom";
	else if (level >= 4) rank = "Aura Operative";
	else if (level >= 2) rank = "Cyber Drift";

	return { xp, level, currentLevelXp, xpToNext, percent, rank };
}

function updateVaultPillDisplay(prog = getVaultProgression()) {
	const disp = document.getElementById("vault-level-display");
	if (disp) {
		disp.textContent = `Lv. ${prog.level} • ${prog.xp} XP`;
	}
}

function checkBadgeUnlocks() {
	const stats = getVaultStats();
	let unlocked = JSON.parse(localStorage.getItem("aura_unlocked_badges") || "[]");
	let changed = false;

	VAULT_BADGES.forEach(b => {
		if (!unlocked.includes(b.id) && b.test(stats)) {
			unlocked.push(b.id);
			changed = true;
			showToast(`🏆 Badge Unlocked: ${b.title}! (${b.desc})`, 4000);
		}
	});

	if (changed) {
		localStorage.setItem("aura_unlocked_badges", JSON.stringify(unlocked));
	}
}

function awardXp(amount, statKey = null) {
	const prevProg = getVaultProgression();
	const prevLevel = prevProg.level;
	const prevXp = prevProg.xp;
	const newXp = prevXp + amount;
	localStorage.setItem("aura_vault_xp", newXp.toString());

	if (statKey) {
		const stats = getVaultStats();
		stats[statKey] = (stats[statKey] || 0) + 1;
		saveVaultStats(stats);
	}

	const newProg = getVaultProgression();
	updateVaultPillDisplay(newProg);

	if (newProg.level > prevLevel) {
		showToast(`🎉 LEVEL UP! You reached Level ${newProg.level}: ${newProg.rank}!`, 4500);
	}

	checkBadgeUnlocks();
}

const vaultModal = document.getElementById("vault-progression-modal");
const vaultLevelPill = document.getElementById("vault-level-pill");
const vaultModalClose = document.getElementById("vault-modal-close");
const vpCopySyncLinkBtn = document.getElementById("vp-copy-sync-link-btn");

function renderVaultModal() {
	const prog = getVaultProgression();
	const stats = getVaultStats();
	const unlocked = JSON.parse(localStorage.getItem("aura_unlocked_badges") || "[]");

	const lvlTag = document.getElementById("vp-level-tag");
	const rankTitle = document.getElementById("vp-rank-title");
	const xpDisp = document.getElementById("vp-xp-display");
	const barFill = document.getElementById("vp-bar-fill");
	const statGames = document.getElementById("vp-stat-games");
	const statSites = document.getElementById("vp-stat-sites");
	const statSounds = document.getElementById("vp-stat-sounds");
	const badgesGrid = document.getElementById("vault-badges-grid");

	if (lvlTag) lvlTag.textContent = `LEVEL ${prog.level}`;
	if (rankTitle) rankTitle.textContent = prog.rank;
	if (xpDisp) xpDisp.textContent = `${prog.currentLevelXp} / ${prog.xpToNext} XP (Total: ${prog.xp})`;
	if (barFill) barFill.style.width = `${prog.percent}%`;
	if (statGames) statGames.textContent = (stats.games || 0).toLocaleString();
	if (statSites) statSites.textContent = (stats.sites || 0).toLocaleString();
	if (statSounds) statSounds.textContent = (stats.sounds || 0).toLocaleString();

	if (badgesGrid) {
		badgesGrid.innerHTML = "";
		VAULT_BADGES.forEach(b => {
			const isUnlocked = unlocked.includes(b.id) || b.test(stats);
			const card = document.createElement("div");
			card.className = `badge-card ${isUnlocked ? "unlocked" : ""}`;
			card.innerHTML = `
				<span class="badge-icon"><img src="${b.icon}" class="badge-img" alt="${escapeHtml(b.title)}" /></span>
				<span class="badge-title">${escapeHtml(b.title)}</span>
				<span class="badge-desc">${escapeHtml(b.desc)}</span>
			`;
			badgesGrid.appendChild(card);
		});
	}
}

if (vaultLevelPill) {
	vaultLevelPill.addEventListener("click", () => {
		renderVaultModal();
		if (vaultModal) vaultModal.classList.remove("hidden");
	});
}
if (vaultModalClose) {
	vaultModalClose.addEventListener("click", () => {
		if (vaultModal) vaultModal.classList.add("hidden");
	});
}

function getVaultSyncUrl() {
	const xp = localStorage.getItem("aura_vault_xp") || "0";
	const stats = encodeURIComponent(localStorage.getItem("aura_vault_stats") || "{}");
	return `${window.location.origin}/#vault=${vaultId}&xp=${xp}&stats=${stats}`;
}

if (vpCopySyncLinkBtn) {
	vpCopySyncLinkBtn.addEventListener("click", () => {
		const syncUrl = getVaultSyncUrl();
		navigator.clipboard.writeText(syncUrl).then(() => {
			showToast("✓ 1-Click Vault Sync link copied! Open on any mirror to transfer progress.");
		}).catch(() => {
			prompt("Copy your Vault Sync link:", syncUrl);
		});
	});
}

// Multi-Mirror Hub
const mirrorHubBtn = document.getElementById("mirror-hub-btn");
const mirrorHubModal = document.getElementById("mirror-hub-modal");
const mirrorHubClose = document.getElementById("mirror-hub-close");
const mirrorCopySyncBtn = document.getElementById("mirror-copy-sync-btn");

if (mirrorHubBtn) {
	mirrorHubBtn.addEventListener("click", () => {
		if (mirrorHubModal) mirrorHubModal.classList.remove("hidden");
	});
}
if (mirrorHubClose) {
	mirrorHubClose.addEventListener("click", () => {
		if (mirrorHubModal) mirrorHubModal.classList.add("hidden");
	});
}
if (mirrorCopySyncBtn) {
	mirrorCopySyncBtn.addEventListener("click", () => {
		const syncUrl = getVaultSyncUrl();
		navigator.clipboard.writeText(syncUrl).then(() => {
			showToast("✓ Cross-Mirror 1-Click Sync Link copied!");
		}).catch(() => {
			prompt("Copy your mirror sync link:", syncUrl);
		});
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

const deckTabList = document.getElementById("deck-tab-list");
const deckNewTabBtn = document.getElementById("deck-new-tab-btn");
const deckUrlInput = document.getElementById("deck-url-input");
const deckBookmarkBtn = document.getElementById("deck-bookmark-btn");
const deckBookmarksBar = document.getElementById("deck-bookmarks-bar");
const deckBackBtn = document.getElementById("deck-back-btn");
const deckForwardBtn = document.getElementById("deck-forward-btn");
const deckReloadBtn = document.getElementById("deck-reload-btn");
const deckAboutblankBtn = document.getElementById("deck-aboutblank-btn");
const deckFullscreenBtn = document.getElementById("deck-fullscreen-btn");
const deckCloseBtn = document.getElementById("deck-close-btn");

function updateOmnibarEngineBadge() {
	if (!omnibarEngineBadge) return;
	const currentEngine = localStorage.getItem("aura_search_engine") || "google";
	const labels = { google: "Google", duckduckgo: "DuckDuckGo", bing: "Bing", brave: "Brave", yahoo: "Yahoo" };
	omnibarEngineBadge.textContent = labels[currentEngine] || "Google";
}
updateOmnibarEngineBadge();

// ============================================================
// 4b. VisionOS Multi-Tab Browser Engine & Bookmarks
// ============================================================
let browserTabs = [];
let activeTabId = null;
let browserBookmarks = JSON.parse(localStorage.getItem("aura_browser_bookmarks") || "[]");

function extractTitleFromUrl(url) {
	try {
		const u = new URL(url);
		return u.hostname.replace(/^www\./, "");
	} catch (e) {
		return url && url.length > 20 ? url.substring(0, 18) + "..." : (url || "New Tab");
	}
}

function updateBookmarkBtnState(url) {
	if (!deckBookmarkBtn) return;
	const isBookmarked = browserBookmarks.some(b => b.url === url);
	if (isBookmarked) {
		deckBookmarkBtn.classList.add("favorited");
		deckBookmarkBtn.style.color = "#eab308";
	} else {
		deckBookmarkBtn.classList.remove("favorited");
		deckBookmarkBtn.style.color = "";
	}
}

function toggleBookmark() {
	const currentTab = browserTabs.find(t => t.id === activeTabId);
	if (!currentTab || !currentTab.url) return;
	const existingIdx = browserBookmarks.findIndex(b => b.url === currentTab.url);
	if (existingIdx !== -1) {
		browserBookmarks.splice(existingIdx, 1);
		showToast("Bookmark removed");
	} else {
		browserBookmarks.push({ title: currentTab.title || currentTab.url, url: currentTab.url });
		showToast("★ Saved to Bookmarks");
	}
	localStorage.setItem("aura_browser_bookmarks", JSON.stringify(browserBookmarks));
	updateBookmarkBtnState(currentTab.url);
	renderBookmarksBar();
}

if (deckBookmarkBtn) deckBookmarkBtn.addEventListener("click", toggleBookmark);

function renderBookmarksBar() {
	if (!deckBookmarksBar) return;
	deckBookmarksBar.innerHTML = "";
	if (browserBookmarks.length === 0) {
		deckBookmarksBar.style.display = "none";
		return;
	}
	deckBookmarksBar.style.display = "flex";
	browserBookmarks.forEach(bm => {
		const chip = document.createElement("button");
		chip.className = "bookmark-chip";
		chip.innerHTML = `<img src="/assets/icons/star.svg" class="inline-icon-img" alt="" /> ` + escapeHtml(bm.title);
		chip.title = bm.url;
		chip.addEventListener("click", () => {
			const currentTab = browserTabs.find(t => t.id === activeTabId);
			if (currentTab) {
				loadTabUrl(currentTab, bm.url);
			} else {
				createTab(bm.url);
			}
		});
		deckBookmarksBar.appendChild(chip);
	});
}

function renderTabs() {
	if (!deckTabList) return;
	deckTabList.innerHTML = "";
	browserTabs.forEach(tab => {
		const tabBtn = document.createElement("div");
		tabBtn.className = "deck-tab" + (tab.id === activeTabId ? " active" : "");
		tabBtn.innerHTML = `
			<span class="deck-tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
			<button class="deck-tab-close" title="Close Tab">✕</button>
		`;
		tabBtn.addEventListener("click", () => switchTab(tab.id));
		const closeBtn = tabBtn.querySelector(".deck-tab-close");
		if (closeBtn) closeBtn.addEventListener("click", (e) => closeTab(tab.id, e));
		deckTabList.appendChild(tabBtn);
	});
}

function switchTab(tabId) {
	activeTabId = tabId;
	browserTabs.forEach(t => {
		if (t.id === tabId) {
			t.iframe.style.display = "block";
			activeProxyIframe = t.iframe;
			if (deckUrlInput) deckUrlInput.value = t.url || "";
			updateBookmarkBtnState(t.url);
		} else {
			t.iframe.style.display = "none";
		}
	});
	renderTabs();
}

function closeTab(tabId, e) {
	if (e) e.stopPropagation();
	const idx = browserTabs.findIndex(t => t.id === tabId);
	if (idx === -1) return;

	const [closedTab] = browserTabs.splice(idx, 1);
	if (closedTab && closedTab.iframe) {
		closedTab.iframe.remove();
	}

	if (browserTabs.length === 0) {
		activeTabId = null;
		activeProxyIframe = null;
		if (proxyDeck) proxyDeck.classList.add("hidden");
	} else if (activeTabId === tabId) {
		const nextTab = browserTabs[Math.max(0, idx - 1)];
		switchTab(nextTab.id);
	} else {
		renderTabs();
	}
}

function createTab(initialUrl = "") {
	const tabId = "tab_" + Math.random().toString(36).substring(2, 9);
	const iframe = document.createElement("iframe");
	iframe.className = "proxy-frame";
	iframe.id = "frame_" + tabId;
	iframe.allow = "camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen";
	iframe.setAttribute("allowfullscreen", "true");
	iframe.style.width = "100%";
	iframe.style.height = "100%";
	iframe.style.border = "none";
	iframe.style.display = "none";
	if (proxyHost) proxyHost.appendChild(iframe);

	const tab = {
		id: tabId,
		url: initialUrl,
		title: initialUrl ? extractTitleFromUrl(initialUrl) : "New Tab",
		iframe: iframe
	};
	browserTabs.push(tab);

	if (proxyDeck) proxyDeck.classList.remove("hidden");
	switchView("browse");
	switchTab(tabId);

	if (initialUrl) {
		loadTabUrl(tab, initialUrl);
	}
	renderTabs();
	return tab;
}

async function loadTabUrl(tab, rawInput) {
	if (!tab || !rawInput) return;
	const targetUrl = resolveSearchUrl(rawInput);
	tab.url = targetUrl;
	tab.title = extractTitleFromUrl(targetUrl);

	if (tab.id === activeTabId) {
		if (deckUrlInput) deckUrlInput.value = targetUrl;
		updateBookmarkBtnState(targetUrl);
	}
	renderTabs();

	trackActivity("proxy_browse", { target: targetUrl });
	awardXp(5, "sites");

	await initSWPromise;

	const isYouTube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\b/i.test(targetUrl);
	const mode = getProxyMode();
	let routed = false;

	if (mode !== "classic" && !classicMode && !isYouTube && sjController) {
		try {
			const frame = sjController.createFrame(tab.iframe);
			frame.go(targetUrl);
			routed = true;
		} catch (e) {
			console.warn("[Aura] Scramjet route retry:", e);
			try {
				if (typeof sjController.wait === "function") await sjController.wait();
				const frame = sjController.createFrame(tab.iframe);
				frame.go(targetUrl);
				routed = true;
			} catch (e2) {}
		}
	}

	if (!routed) {
		tab.iframe.src = (mode === "classic" || classicMode || isYouTube)
			? "/classic/" + targetUrl
			: "/scram/service/" + encodeURIComponent(targetUrl);
	}
}

async function navigateProxy(rawInput) {
	if (!rawInput) return;
	const targetUrl = resolveSearchUrl(rawInput);

	let currentTab = browserTabs.find(t => t.id === activeTabId);
	if (currentTab && (!currentTab.url || currentTab.url === "about:blank")) {
		await loadTabUrl(currentTab, targetUrl);
	} else {
		createTab(targetUrl);
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

// In-Deck URL Bar navigation
if (deckUrlInput) {
	deckUrlInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const val = deckUrlInput.value.trim();
			if (!val) return;
			const currentTab = browserTabs.find(t => t.id === activeTabId);
			if (currentTab) {
				loadTabUrl(currentTab, val);
			} else {
				createTab(val);
			}
		}
	});
}

// In-Deck Controls
if (deckNewTabBtn) {
	deckNewTabBtn.addEventListener("click", () => {
		createTab("");
		if (deckUrlInput) {
			deckUrlInput.value = "";
			deckUrlInput.focus();
		}
	});
}
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
if (deckFullscreenBtn) {
	deckFullscreenBtn.addEventListener("click", () => {
		if (!document.fullscreenElement) {
			if (proxyDeck) proxyDeck.requestFullscreen().catch(() => {});
		} else {
			document.exitFullscreen().catch(() => {});
		}
	});
}
if (deckCloseBtn) {
	deckCloseBtn.addEventListener("click", () => {
		browserTabs.forEach(t => t.iframe && t.iframe.remove());
		browserTabs = [];
		activeTabId = null;
		activeProxyIframe = null;
		if (proxyDeck) proxyDeck.classList.add("hidden");
	});
}
if (deckAboutblankBtn) {
	deckAboutblankBtn.addEventListener("click", () => {
		const currentTab = browserTabs.find(t => t.id === activeTabId);
		if (currentTab && currentTab.url) {
			openInAboutBlank(currentTab.url);
		}
	});
}

// ============================================================
// 4c. Speed Dial & Custom Shortcuts Adder
// ============================================================
const speedDialGrid = document.getElementById("speed-dial-grid");
const shortcutModal = document.getElementById("shortcut-modal");
const shortcutModalClose = document.getElementById("shortcut-modal-close");
const shortcutSubmitBtn = document.getElementById("shortcut-submit-btn");
const shortcutNameInput = document.getElementById("shortcut-name-input");
const shortcutUrlInput = document.getElementById("shortcut-url-input");
const shortcutIconInput = document.getElementById("shortcut-icon-input");

const DEFAULT_SHORTCUTS = [
	{ name: "YouTube", url: "https://youtube.com", icon: "/assets/icons/youtube.svg" },
	{ name: "Discord", url: "https://discord.com", icon: "/assets/icons/discord.svg" },
	{ name: "Reddit", url: "https://reddit.com", icon: "/assets/icons/reddit.svg" },
	{ name: "Twitch", url: "https://twitch.tv", icon: "/assets/icons/twitch.svg" },
	{ name: "Wikipedia", url: "https://wikipedia.org", icon: "/assets/icons/wikipedia.svg" },
	{ name: "GitHub", url: "https://github.com", icon: "/assets/icons/github.svg" }
];

function getCustomShortcuts() {
	try {
		return JSON.parse(localStorage.getItem("aura_custom_shortcuts")) || [];
	} catch (e) {
		return [];
	}
}

function saveCustomShortcuts(list) {
	localStorage.setItem("aura_custom_shortcuts", JSON.stringify(list));
}

function renderSpeedDials() {
	if (!speedDialGrid) return;
	speedDialGrid.innerHTML = "";

	const custom = getCustomShortcuts();
	const allShortcuts = [
		...DEFAULT_SHORTCUTS.map(s => ({ ...s, isCustom: false })),
		...custom.map((s, idx) => ({ ...s, isCustom: true, idx }))
	];

	allShortcuts.forEach(s => {
		const btn = document.createElement("button");
		btn.className = "speed-dial-item";
		btn.dataset.url = s.url;
		const iconMarkup = (s.icon && (s.icon.startsWith("/") || s.icon.startsWith("http")))
			? `<img src="${s.icon}" class="sd-icon-img" alt="${escapeHtml(s.name)}" />`
			: `<span class="sd-icon">${s.icon || "🌐"}</span>`;

		btn.innerHTML = `
			<span class="sd-icon">${iconMarkup}</span>
			<span class="sd-label">${escapeHtml(s.name)}</span>
			${s.isCustom ? `<span class="sd-del-btn" title="Remove Shortcut" style="position:absolute;top:4px;right:6px;font-size:0.7rem;color:#ef4444;cursor:pointer;">✕</span>` : ""}
		`;

		btn.addEventListener("click", (e) => {
			if (e.target.classList.contains("sd-del-btn")) {
				e.stopPropagation();
				const updated = getCustomShortcuts();
				updated.splice(s.idx, 1);
				saveCustomShortcuts(updated);
				renderSpeedDials();
				showToast("Shortcut removed");
				return;
			}
			navigateProxy(s.url);
		});

		speedDialGrid.appendChild(btn);
	});

	// Append "+ Add Site" button
	const addBtn = document.createElement("button");
	addBtn.className = "speed-dial-item add-shortcut-btn";
	addBtn.id = "add-shortcut-btn";
	addBtn.title = "Add Custom Shortcut";
	addBtn.innerHTML = `
		<span class="sd-icon"><img src="/assets/icons/plus.svg" class="sd-icon-img" alt="Add" /></span>
		<span class="sd-label">Add Site</span>
	`;
	addBtn.addEventListener("click", () => {
		if (shortcutModal) shortcutModal.classList.remove("hidden");
	});
	speedDialGrid.appendChild(addBtn);
}

if (shortcutModalClose) {
	shortcutModalClose.addEventListener("click", () => {
		if (shortcutModal) shortcutModal.classList.add("hidden");
	});
}
if (shortcutSubmitBtn) {
	shortcutSubmitBtn.addEventListener("click", () => {
		const name = shortcutNameInput ? shortcutNameInput.value.trim() : "";
		const url = shortcutUrlInput ? shortcutUrlInput.value.trim() : "";
		const icon = (shortcutIconInput && shortcutIconInput.value.trim()) || "🌐";
		if (!name || !url) {
			showToast("Please provide both site name and URL");
			return;
		}
		const custom = getCustomShortcuts();
		custom.push({ name, url, icon });
		saveCustomShortcuts(custom);
		renderSpeedDials();
		if (shortcutNameInput) shortcutNameInput.value = "";
		if (shortcutUrlInput) shortcutUrlInput.value = "";
		if (shortcutModal) shortcutModal.classList.add("hidden");
		awardXp(20, "shortcuts");
		showToast(`✓ Added shortcut for ${name}!`);
	});
}

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

// ============================================================
// 5b. Game of the Week, Favorites & Recently Played
// ============================================================
const gotwPlayBtn = document.getElementById("gotw-play-btn");

function getFavoriteGames() {
	try {
		return JSON.parse(localStorage.getItem("aura_fav_games")) || [];
	} catch (e) {
		return [];
	}
}

function saveFavoriteGames(list) {
	localStorage.setItem("aura_fav_games", JSON.stringify(list));
}

function isGameFavorited(title) {
	return getFavoriteGames().includes(title);
}

function toggleGameFavorite(title, e) {
	if (e) e.stopPropagation();
	const favs = getFavoriteGames();
	const idx = favs.indexOf(title);
	if (idx !== -1) {
		favs.splice(idx, 1);
		saveFavoriteGames(favs);
		showToast(`Removed "${title}" from favorites`);
	} else {
		favs.push(title);
		saveFavoriteGames(favs);
		showToast(`⭐ Added "${title}" to favorites!`);
	}
	if (activeCategory === "favorites") {
		applyFilterAndSearch();
	}
}

function getRecentGames() {
	try {
		return JSON.parse(localStorage.getItem("aura_recent_games")) || [];
	} catch (e) {
		return [];
	}
}

function pushRecentGame(game) {
	if (!game || !game.title) return;
	let recents = getRecentGames();
	recents = recents.filter(g => g.title !== game.title);
	recents.unshift({ title: game.title, url: game.url, icon: game.icon || "🕹️", category: game.category || "Arcade" });
	if (recents.length > 30) recents = recents.slice(0, 30);
	localStorage.setItem("aura_recent_games", JSON.stringify(recents));
}

if (gotwPlayBtn) {
	gotwPlayBtn.addEventListener("click", () => {
		const found = allGamesList.find(g => (g.title || "").toLowerCase().includes("drive mad"));
		if (found) {
			launchGame(found);
		} else {
			launchGame({ title: "Drive Mad", url: "/games/drivemad/index.html", icon: "🚙", category: "Racing" });
		}
	});
}

function applyFilterAndSearch() {
	const query = arcadeSearchInput ? arcadeSearchInput.value.trim().toLowerCase() : "";
	const favs = getFavoriteGames();
	const recents = getRecentGames();

	let baseList = allGamesList;
	if (activeCategory === "recent") {
		baseList = recents.map(r => {
			return allGamesList.find(g => g.title === r.title) || r;
		});
	}

	filteredGamesList = baseList.filter(game => {
		const title = (game.title || "").toLowerCase();
		const cat = (game.category || "").toLowerCase();

		const matchesQuery = !query || title.includes(query) || cat.includes(query);
		if (!matchesQuery) return false;

		if (activeCategory === "all") return true;
		if (activeCategory === "favorites") return favs.includes(game.title);
		if (activeCategory === "recent") return true;
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

function getGameMonogram(title) {
	if (!title) return "GM";
	const clean = title.replace(/[^a-zA-Z0-9\s]/g, "").trim();
	const words = clean.split(/\s+/).filter(Boolean);
	if (words.length === 0) return "GM";
	if (/^\d+$/.test(words[0])) return words[0].substring(0, 4);
	if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
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

		const monogram = getGameMonogram(game.title);
		const cat = game.category || game.cat || "Arcade";
		const isFav = isGameFavorited(game.title);

		card.innerHTML = `
			<button class="game-star-btn ${isFav ? "favorited" : ""}" title="${isFav ? "Remove Favorite" : "Add to Favorites"}"><img src="/assets/icons/star.svg" class="icon-inline" alt="" /></button>
			<div class="game-thumb">
				<div class="game-cover-art" data-category="${escapeHtml(cat.toLowerCase())}">
					<div class="game-cover-mesh"></div>
					<img src="/assets/icons/gamepad.svg" class="game-cover-svg" alt="" />
					<span class="game-cover-code">${monogram}</span>
				</div>
			</div>
			<div class="game-meta">
				<span class="game-title" title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</span>
				<span class="game-cat">${escapeHtml(cat)}</span>
			</div>
		`;

		const starBtn = card.querySelector(".game-star-btn");
		if (starBtn) {
			starBtn.addEventListener("click", (e) => {
				toggleGameFavorite(game.title, e);
				const updatedFav = isGameFavorited(game.title);
				starBtn.classList.toggle("favorited", updatedFav);
				starBtn.title = updatedFav ? "Remove Favorite" : "Add to Favorites";
			});
		}

		card.addEventListener("click", () => {
			launchGame(game);
		});

		frag.appendChild(card);
	});

	arcadeGrid.appendChild(frag);
	renderedGameCount += batch.length;
}

// Infinite scroll on games grid
function checkScrollForGames() {
	const arcadeView = document.getElementById("view-arcade");
	if (!arcadeView || !arcadeView.classList.contains("active")) return;
	const ws = document.querySelector(".aura-workspace");
	const atBottom = ws ? (ws.scrollTop + ws.clientHeight >= ws.scrollHeight - 600) : (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500);
	if (atBottom && renderedGameCount < filteredGamesList.length) {
		renderNextGamesBatch();
	}
}
window.addEventListener("scroll", checkScrollForGames);
const auraWorkspaceEl = document.querySelector(".aura-workspace");
if (auraWorkspaceEl) auraWorkspaceEl.addEventListener("scroll", checkScrollForGames);


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

	pushRecentGame(game);
	awardXp(15, "games");

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
	showToast("Playing " + (game.title || "Game") + " — Press ESC or '✕ Exit' anytime to return");
	trackActivity("game_play", { title: game.title, url: activeGameUrl });
}

function closeGamePlayer() {
	if (document.fullscreenElement) {
		document.exitFullscreen().catch(() => {});
	}
	if (playerModal) playerModal.classList.add("hidden");
	if (playerContainer) playerContainer.innerHTML = "";
	activeGameUrl = "";
	showToast("Exited game");
}

const playerFloatExitBtn = document.getElementById("player-float-exit-btn");
if (playerCloseBtn) playerCloseBtn.addEventListener("click", closeGamePlayer);
if (playerFloatExitBtn) playerFloatExitBtn.addEventListener("click", closeGamePlayer);

// Global Escape key listener to exit game from anywhere
window.addEventListener("keydown", (e) => {
	if (e.key === "Escape" || e.code === "Escape") {
		if (playerModal && !playerModal.classList.contains("hidden")) {
			e.preventDefault();
			e.stopPropagation();
			closeGamePlayer();
		}
	}
}, true);

if (playerFullscreenBtn) {
	playerFullscreenBtn.addEventListener("click", () => {
		if (document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
		} else if (playerModal && playerModal.requestFullscreen) {
			playerModal.requestFullscreen().catch(() => {
				const iframe = playerContainer ? playerContainer.querySelector("iframe") : null;
				if (iframe && iframe.requestFullscreen) iframe.requestFullscreen().catch(() => {});
			});
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
		awardXp(10, "ai");
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
// 7. Sound FX Deck & Custom Audio Player
// ============================================================
const soundGrid = document.getElementById("soundboard-grid");
const sbStopBtn = document.getElementById("sb-stop-btn");
const sbCustomInput = document.getElementById("sb-custom-input");
const sbCustomPlayBtn = document.getElementById("sb-custom-play-btn");
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
					<span class="sb-icon"><img src="/assets/icons/sound.svg" class="sb-icon-img" alt="" /></span>
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
	awardXp(5, "sounds");
	trackActivity("soundboard_play", { soundId });
}

if (sbCustomPlayBtn) {
	sbCustomPlayBtn.addEventListener("click", () => {
		const url = sbCustomInput ? sbCustomInput.value.trim() : "";
		if (!url) {
			showToast("Please paste an MP3 or audio link");
			return;
		}
		if (activeAudio) {
			activeAudio.pause();
			activeAudio = null;
		}
		try {
			const audio = new Audio(url);
			activeAudio = audio;
			audio.play().then(() => {
				showToast("▶ Playing custom audio track");
				awardXp(5, "sounds");
			}).catch(err => {
				showToast("Could not play audio: " + err.message);
			});
		} catch (err) {
			showToast("Invalid audio link");
		}
	});
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
		awardXp(10, "cloaks");
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
	awardXp(10, "blank");
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
	updateVaultPillDisplay();
	renderSpeedDials();
	renderBookmarksBar();
	loadArcadeCatalog();
	loadSoundboard();
	updateShieldDisplay();
});
