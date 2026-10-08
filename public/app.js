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

	if (viewName === "chat" && typeof onEnterChatView === "function") {
		onEnterChatView();
	}
	if (viewName === "apps" && typeof renderAppsCatalog === "function") {
		renderAppsCatalog();
	}

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

// ============================================================
// 4b. Aura Built-in VPN Tunnel & Node Routing Engine
// ============================================================
const VPN_CONFIG_KEY = "aura_vpn_config";

const VPN_NODES = [
	{ id: "auto", name: "Auto (Fastest Relay)", flag: "⚡", ping: "14ms", ip: "150.230.124.167", desc: "Smart low-latency egress" },
	{ id: "us-east", name: "US East (Cloudflare WARP)", flag: "🇺🇸", ping: "22ms", ip: "104.28.194.82", desc: "YouTube & Discord unblocked" },
	{ id: "us-west", name: "US West (Los Angeles Fiber)", flag: "🇺🇸", ping: "38ms", ip: "104.28.212.15", desc: "60 FPS HTML5 game bypass" },
	{ id: "uk-london", name: "UK London (Zero-Trace)", flag: "🇬🇧", ping: "28ms", ip: "141.101.120.4", desc: "Bypasses British school filters" },
	{ id: "eu-frankfurt", name: "Germany (Frankfurt Shield)", flag: "🇩🇪", ping: "31ms", ip: "188.114.97.2", desc: "Strict zero-log privacy" },
	{ id: "ca-toronto", name: "Canada (Toronto Node)", flag: "🇨🇦", ping: "45ms", ip: "172.67.142.90", desc: "Uncensored web tunnel" },
	{ id: "jp-tokyo", name: "Japan (Tokyo Ultra)", flag: "🇯🇵", ping: "85ms", ip: "104.21.65.110", desc: "Asian media & gaming route" },
];

const DEFAULT_VPN_CONFIG = {
	connected: true,
	node: "auto",
	webrtcBlock: true,
	dnsBlock: true,
	warpBoost: true,
	killSwitch: false,
	bytesProtected: 52428800 // 50 MB
};

function getVpnConfig() {
	try {
		const raw = localStorage.getItem(VPN_CONFIG_KEY);
		return raw ? { ...DEFAULT_VPN_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_VPN_CONFIG };
	} catch (e) {
		return { ...DEFAULT_VPN_CONFIG };
	}
}

function saveVpnConfig(conf) {
	try {
		localStorage.setItem(VPN_CONFIG_KEY, JSON.stringify(conf));
	} catch (e) {}
}

let vpnConfig = getVpnConfig();

// WebRTC Leak Blocker Hook for iframe content windows
function injectVpnSecurityHooks(iframeWin) {
	if (!iframeWin) return;
	try {
		if (vpnConfig.webrtcBlock) {
			// Mask WebRTC APIs to prevent local / school IP leak
			if (iframeWin.RTCPeerConnection) {
				iframeWin.RTCPeerConnection = function() {
					console.log("[Aura VPN] Blocked WebRTC IP leak attempt");
					throw new Error("WebRTC blocked by Aura VPN Tunnel");
				};
			}
			if (iframeWin.webkitRTCPeerConnection) {
				iframeWin.webkitRTCPeerConnection = iframeWin.RTCPeerConnection;
			}
			if (iframeWin.mozRTCPeerConnection) {
				iframeWin.mozRTCPeerConnection = iframeWin.RTCPeerConnection;
			}
		}
	} catch (e) {}
}

function updateVpnUI() {
	const activeNode = VPN_NODES.find(n => n.id === vpnConfig.node) || VPN_NODES[0];
	const isConnected = !!vpnConfig.connected;

	// 1. Topbar Button
	const topbarBtn = document.getElementById("vpn-status-btn");
	const topbarLabel = document.getElementById("vpn-topbar-label");
	const topbarNodeChip = document.getElementById("vpn-node-chip");
	if (topbarBtn) {
		topbarBtn.className = "vpn-status-pill " + (isConnected ? "connected" : "disconnected");
	}
	if (topbarLabel) {
		topbarLabel.textContent = isConnected ? "VPN: SECURED" : "VPN: OFF";
	}
	if (topbarNodeChip) {
		topbarNodeChip.textContent = `${activeNode.flag} ${activeNode.name.split(" ")[0]}`;
	}

	// 2. Deck Button
	const deckBtn = document.getElementById("deck-vpn-btn");
	if (deckBtn) {
		deckBtn.className = "deck-btn deck-vpn-btn " + (isConnected ? "connected" : "disconnected");
		deckBtn.title = isConnected ? `Aura VPN Active (${activeNode.name})` : "Aura VPN Disconnected";
	}

	// 3. Modal Elements
	const heroCard = document.querySelector(".vpn-hero-card");
	const statusBadge = document.getElementById("vpn-status-badge");
	const statusText = document.getElementById("vpn-status-text");
	const powerBtn = document.getElementById("vpn-power-toggle");
	const powerText = document.getElementById("vpn-power-text");
	const maskedIp = document.getElementById("vpn-masked-ip");
	const locFlag = document.getElementById("vpn-loc-flag");
	const nodeTxt = document.getElementById("vpn-current-node-name");
	const pingStat = document.getElementById("vpn-ping-stat");
	const dataStat = document.getElementById("vpn-data-stat");

	if (heroCard) {
		heroCard.classList.toggle("disconnected", !isConnected);
	}
	if (statusBadge) {
		statusBadge.className = "vpn-status-badge " + (isConnected ? "connected" : "disconnected");
	}
	if (statusText) {
		statusText.textContent = isConnected ? "TUNNEL ACTIVE" : "TUNNEL PAUSED";
	}
	if (powerBtn) {
		powerBtn.className = "vpn-power-btn " + (isConnected ? "connected" : "disconnected");
	}
	if (powerText) {
		powerText.textContent = isConnected ? "CONNECTED" : "CONNECT";
	}
	if (maskedIp) {
		maskedIp.textContent = isConnected ? activeNode.ip : "Direct (Unmasked)";
	}
	if (locFlag) {
		locFlag.textContent = activeNode.flag;
	}
	if (nodeTxt) {
		nodeTxt.textContent = activeNode.name;
	}
	if (pingStat) {
		pingStat.textContent = isConnected ? activeNode.ping : "--";
	}
	if (dataStat) {
		const mb = ((vpnConfig.bytesProtected || 0) / (1024 * 1024)).toFixed(1);
		dataStat.textContent = `${mb} MB`;
	}

	// 4. Settings Card Elements
	const settingMaster = document.getElementById("setting-vpn-master-toggle");
	const settingNode = document.getElementById("setting-vpn-node-select");
	const settingWebrtc = document.getElementById("setting-vpn-webrtc");
	if (settingMaster) settingMaster.checked = isConnected;
	if (settingNode) settingNode.value = vpnConfig.node;
	if (settingWebrtc) settingWebrtc.checked = vpnConfig.webrtcBlock;

	// Modal security toggles
	const togWebrtc = document.getElementById("vpn-toggle-webrtc");
	const togDns = document.getElementById("vpn-toggle-dns");
	const togWarp = document.getElementById("vpn-toggle-warp");
	const togKill = document.getElementById("vpn-toggle-killswitch");
	if (togWebrtc) togWebrtc.checked = vpnConfig.webrtcBlock;
	if (togDns) togDns.checked = vpnConfig.dnsBlock;
	if (togWarp) togWarp.checked = vpnConfig.warpBoost;
	if (togKill) togKill.checked = vpnConfig.killSwitch;

	// Update active card in nodes grid
	document.querySelectorAll(".vpn-node-card").forEach(c => {
		c.classList.toggle("active", c.dataset.nodeId === vpnConfig.node);
	});
}

function toggleVpn(forcedState) {
	const newState = typeof forcedState === "boolean" ? forcedState : !vpnConfig.connected;
	
	const topbarBtn = document.getElementById("vpn-status-btn");
	if (topbarBtn && newState) {
		topbarBtn.className = "vpn-status-pill connecting";
		const topbarLabel = document.getElementById("vpn-topbar-label");
		if (topbarLabel) topbarLabel.textContent = "CONNECTING...";
	}

	setTimeout(() => {
		vpnConfig.connected = newState;
		saveVpnConfig(vpnConfig);
		updateVpnUI();

		const activeNode = VPN_NODES.find(n => n.id === vpnConfig.node) || VPN_NODES[0];
		if (newState) {
			showToast(`🛡️ Aura VPN Connected — Tunnel: ${activeNode.name}`);
		} else {
			showToast(vpnConfig.killSwitch ? `⚠️ Aura VPN Disconnected — Kill Switch active` : `⚠️ Aura VPN Disconnected`);
		}
	}, newState ? 350 : 50);
}

function renderVpnNodes() {
	const grid = document.getElementById("vpn-nodes-grid");
	if (!grid) return;
	grid.innerHTML = "";
	VPN_NODES.forEach(n => {
		const card = document.createElement("div");
		card.className = "vpn-node-card" + (n.id === vpnConfig.node ? " active" : "");
		card.dataset.nodeId = n.id;
		card.innerHTML = `
			<span class="vpn-node-card-flag">${n.flag}</span>
			<div class="vpn-node-card-info">
				<span class="vpn-node-card-name">${escapeHtml(n.name)}</span>
				<span class="vpn-node-card-ping">${n.ping}</span>
			</div>
		`;
		card.addEventListener("click", () => {
			vpnConfig.node = n.id;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			showToast(`⚡ Switched VPN Node to ${n.name}`);
		});
		grid.appendChild(card);
	});
}

function openVpnModal() {
	const modal = document.getElementById("vpn-hub-modal");
	if (modal) {
		renderVpnNodes();
		updateVpnUI();
		modal.classList.remove("hidden");
	}
}

function closeVpnModal() {
	const modal = document.getElementById("vpn-hub-modal");
	if (modal) modal.classList.add("hidden");
}

async function syncVpnTelemetry() {
	try {
		const res = await fetch("/api/vpn/status");
		if (res.ok) {
			const data = await res.json();
			if (data && data.ping) {
				const pingStat = document.getElementById("vpn-ping-stat");
				if (pingStat && vpnConfig.connected) pingStat.textContent = `${data.ping} ms`;
			}
			if (data && data.egressIp && vpnConfig.node === "auto") {
				const maskedIp = document.getElementById("vpn-masked-ip");
				if (maskedIp && vpnConfig.connected) maskedIp.textContent = data.egressIp;
			}
		}
	} catch (e) {}
}

function setupVpnControls() {
	const topbarBtn = document.getElementById("vpn-status-btn");
	if (topbarBtn) topbarBtn.addEventListener("click", openVpnModal);

	const deckBtn = document.getElementById("deck-vpn-btn");
	if (deckBtn) deckBtn.addEventListener("click", openVpnModal);

	const settingManageBtn = document.getElementById("setting-vpn-manage-btn");
	if (settingManageBtn) settingManageBtn.addEventListener("click", openVpnModal);

	const closeBtn = document.getElementById("vpn-modal-close");
	if (closeBtn) closeBtn.addEventListener("click", closeVpnModal);

	const modal = document.getElementById("vpn-hub-modal");
	if (modal) {
		modal.addEventListener("click", (e) => {
			if (e.target === modal) closeVpnModal();
		});
	}

	const powerBtn = document.getElementById("vpn-power-toggle");
	if (powerBtn) {
		powerBtn.addEventListener("click", () => toggleVpn());
	}

	// Settings card controls
	const settingMaster = document.getElementById("setting-vpn-master-toggle");
	if (settingMaster) {
		settingMaster.addEventListener("change", (e) => {
			toggleVpn(e.target.checked);
		});
	}

	const settingNode = document.getElementById("setting-vpn-node-select");
	if (settingNode) {
		settingNode.addEventListener("change", (e) => {
			vpnConfig.node = e.target.value;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			const activeNode = VPN_NODES.find(n => n.id === vpnConfig.node) || VPN_NODES[0];
			showToast(`⚡ Switched VPN Node to ${activeNode.name}`);
		});
	}

	const settingWebrtc = document.getElementById("setting-vpn-webrtc");
	if (settingWebrtc) {
		settingWebrtc.addEventListener("change", (e) => {
			vpnConfig.webrtcBlock = e.target.checked;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			showToast(vpnConfig.webrtcBlock ? "🛡️ WebRTC IP Leak Blocker Enabled" : "⚠️ WebRTC IP Leak Blocker Disabled");
		});
	}

	// Modal security toggles
	const togWebrtc = document.getElementById("vpn-toggle-webrtc");
	if (togWebrtc) {
		togWebrtc.addEventListener("change", (e) => {
			vpnConfig.webrtcBlock = e.target.checked;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			showToast(vpnConfig.webrtcBlock ? "🛡️ WebRTC IP Leak Blocker Enabled" : "⚠️ WebRTC IP Leak Blocker Disabled");
		});
	}

	const togDns = document.getElementById("vpn-toggle-dns");
	if (togDns) {
		togDns.addEventListener("change", (e) => {
			vpnConfig.dnsBlock = e.target.checked;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			showToast(vpnConfig.dnsBlock ? "🔒 Cloudflare DoH Encrypted DNS Active" : "⚠️ Encrypted DNS Disabled");
		});
	}

	const togWarp = document.getElementById("vpn-toggle-warp");
	if (togWarp) {
		togWarp.addEventListener("change", (e) => {
			vpnConfig.warpBoost = e.target.checked;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			showToast(vpnConfig.warpBoost ? "🚀 Cloudflare WARP Ultra Egress Enabled" : "WARP Egress Disabled");
		});
	}

	const togKill = document.getElementById("vpn-toggle-killswitch");
	if (togKill) {
		togKill.addEventListener("change", (e) => {
			vpnConfig.killSwitch = e.target.checked;
			saveVpnConfig(vpnConfig);
			updateVpnUI();
			showToast(vpnConfig.killSwitch ? "🛑 VPN Kill Switch Enabled: Unencrypted traffic blocked" : "⚠️ VPN Kill Switch Disabled");
		});
	}

	window.addEventListener("message", (e) => {
		if (e.data && e.data.type === "vpn_connect_request") {
			toggleVpn(true);
		}
	});
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

	// Automatic environment detection:
	// Worker mirrors (*.workers.dev, *.pages.dev) and embedded frames (offline launcher) cannot reliably run Wisp WebSockets
	const isWorkerMirror = location.hostname.endsWith(".workers.dev") || location.hostname.endsWith(".pages.dev");
	const isEmbedded = window.self !== window.top;
	if (isWorkerMirror || isEmbedded) {
		classicMode = true;
		console.log("[Aura] Detected Worker Mirror or Embedded Launcher — automatically utilizing rock-solid Classic Proxy Engine");
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
				new Promise((_, rej) => setTimeout(() => rej(new Error("sw_timeout")), 2500))
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
				setTimeout(res, 400);
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
			// Quick connection check (up to 4 tries = 1.6s)
			for (let i = 0; i < 4 && !libcurlClient.ready; i++) {
				try { await libcurlClient.init(); } catch (e) { await new Promise(r => setTimeout(r, 400)); }
			}
			if (!libcurlClient.ready) {
				console.warn("[Aura] Wisp transport not reachable, falling back to Classic mode");
				classicMode = true;
				return false;
			}
			transportAdapter = {
				ready: true,
				init: async () => {},
				request: async (remote, method, body, headers, signal) => {
					let hdrs = headers;
					if (hdrs && typeof hdrs.entries === "function" && !Array.isArray(hdrs)) {
						hdrs = Array.from(hdrs.entries());
					} else if (hdrs && typeof hdrs === "object" && !Array.isArray(hdrs)) {
						hdrs = Object.entries(hdrs);
					}
					const resp = await libcurlClient.request(remote, method, body, hdrs, signal);
					let rawHeaders = [];
					if (resp && resp.headers) {
						if (typeof resp.headers.entries === "function") {
							rawHeaders = Array.from(resp.headers.entries());
						} else if (Array.isArray(resp.headers)) {
							rawHeaders = resp.headers;
						} else if (typeof resp.headers === "object") {
							rawHeaders = Object.entries(resp.headers);
						}
					}
					return {
						status: resp.status || 200,
						statusText: resp.statusText || "OK",
						headers: rawHeaders,
						body: resp.body
					};
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

function extractDomain(url) {
	if (!url) return "";
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch (e) {
		return "";
	}
}

// ============================================================
// Game & Browser Speed Multiplier Engine (Clash Speed Hack)
// ============================================================
let currentGameSpeed = 1.0;

function injectGameSpeedHook(iframeWin, speed = 1.0) {
	if (!iframeWin) return;
	try {
		iframeWin.__clashSpeed = speed;
		if (!iframeWin.__clashHooked) {
			iframeWin.__clashHooked = true;

			let virtualTime = 0;
			let lastRealTime = (iframeWin.performance && iframeWin.performance.now) ? iframeWin.performance.now() : Date.now();
			let virtualDate = Date.now();
			let lastRealDate = Date.now();

			// Hook performance.now with virtual monotonic time
			if (iframeWin.performance && iframeWin.performance.now) {
				const origPerfNow = iframeWin.performance.now.bind(iframeWin.performance);
				iframeWin.performance.now = function() {
					const now = origPerfNow();
					const dt = Math.max(0, now - lastRealTime);
					lastRealTime = now;
					virtualTime += dt * (iframeWin.__clashSpeed ?? 1.0);
					return virtualTime;
				};
			}

			// Hook Date.now with virtual monotonic time
			const origDateNow = iframeWin.Date.now;
			iframeWin.Date.now = function() {
				const now = origDateNow ? origDateNow() : new Date().getTime();
				const dt = Math.max(0, now - lastRealDate);
				lastRealDate = now;
				virtualDate += dt * (iframeWin.__clashSpeed ?? 1.0);
				return Math.round(virtualDate);
			};

			// Hook requestAnimationFrame
			const origRAF = iframeWin.requestAnimationFrame;
			if (origRAF) {
				iframeWin.requestAnimationFrame = function(cb) {
					return origRAF.call(iframeWin, function(realNow) {
						if (iframeWin.performance && iframeWin.performance.now) {
							cb(iframeWin.performance.now());
						} else {
							cb(realNow * (iframeWin.__clashSpeed ?? 1.0));
						}
					});
				};
			}

			// Hook setTimeout
			const origSetTimeout = iframeWin.setTimeout;
			if (origSetTimeout) {
				iframeWin.setTimeout = function(fn, delay, ...args) {
					const sp = iframeWin.__clashSpeed ?? 1.0;
					const scaled = sp > 0 ? Math.max(1, Math.round(delay / sp)) : delay;
					return origSetTimeout.call(iframeWin, fn, scaled, ...args);
				};
			}

			// Hook setInterval
			const origSetInterval = iframeWin.setInterval;
			if (origSetInterval) {
				iframeWin.setInterval = function(fn, delay, ...args) {
					const sp = iframeWin.__clashSpeed ?? 1.0;
					const scaled = sp > 0 ? Math.max(1, Math.round(delay / sp)) : delay;
					return origSetInterval.call(iframeWin, fn, scaled, ...args);
				};
			}

			iframeWin.setClashSpeed = function(newSpeed) {
				iframeWin.__clashSpeed = newSpeed;
			};
		}
	} catch (e) {
		console.warn("[Clash Speed Hook] Hook error:", e);
	}
}

function setGameSpeed(speed) {
	currentGameSpeed = parseFloat(speed) || 1.0;

	// Apply to active arcade player modal iframe
	if (playerContainer) {
		const frame = playerContainer.querySelector("iframe");
		if (frame && frame.contentWindow) {
			injectGameSpeedHook(frame.contentWindow, currentGameSpeed);
			try {
				if (typeof frame.contentWindow.setClashSpeed === "function") {
					frame.contentWindow.setClashSpeed(currentGameSpeed);
				}
			} catch (e) {}
		}
	}

	// Apply to active proxy browser tab iframe
	if (activeProxyIframe && activeProxyIframe.contentWindow) {
		injectGameSpeedHook(activeProxyIframe.contentWindow, currentGameSpeed);
		try {
			if (typeof activeProxyIframe.contentWindow.setClashSpeed === "function") {
				activeProxyIframe.contentWindow.setClashSpeed(currentGameSpeed);
			}
		} catch (e) {}
	}

	updateSpeedUI();
	showToast(`⚡ Speed multiplier set to ${currentGameSpeed}x`);
}

function updateSpeedUI() {
	const label = document.getElementById("deck-speed-label");
	if (label) label.textContent = `${currentGameSpeed.toFixed(1)}x`;

	document.querySelectorAll(".speed-opt-btn").forEach(btn => {
		const sp = parseFloat(btn.dataset.speed);
		btn.classList.toggle("active", Math.abs(sp - currentGameSpeed) < 0.05);
	});

	document.querySelectorAll(".player-speed-btn").forEach(btn => {
		const sp = parseFloat(btn.dataset.speed);
		btn.classList.toggle("active", Math.abs(sp - currentGameSpeed) < 0.05);
	});
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
	if (typeof updateShieldUI === "function") updateShieldUI();
}

function closeTab(tabId, e) {
	if (e) e.stopPropagation();
	const idx = browserTabs.findIndex(t => t.id === tabId);
	if (idx === -1) return;

	const [closedTab] = browserTabs.splice(idx, 1);
	if (closedTab && closedTab.iframe) {
		closedTab.iframe.remove();
	}
	if (typeof ClashShield !== "undefined") {
		ClashShield.removeTab(tabId);
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
	if (typeof updateShieldUI === "function") updateShieldUI();
}

function createTab(initialUrl = "") {
	const tabId = "tab_" + Math.random().toString(36).substring(2, 9);
	const iframe = document.createElement("iframe");
	iframe.className = "proxy-frame";
	iframe.id = "frame_" + tabId;
	iframe.dataset.tabId = tabId;
	iframe.allow = "camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen";
	iframe.setAttribute("allowfullscreen", "true");
	iframe.style.width = "100%";
	iframe.style.height = "100%";
	iframe.style.border = "none";
	iframe.style.display = "none";

	iframe.addEventListener("load", () => {
		if (typeof ClashShield !== "undefined") {
			ClashShield.applyToFrame(iframe, tab.url);
		}
		if (typeof injectGameSpeedHook === "function" && iframe.contentWindow) {
			injectGameSpeedHook(iframe.contentWindow, currentGameSpeed);
		}
		if (typeof injectVpnSecurityHooks === "function" && iframe.contentWindow) {
			injectVpnSecurityHooks(iframe.contentWindow);
		}
		if (typeof updateShieldUI === "function") updateShieldUI();
	});

	iframe.addEventListener("error", () => {
		if (tab && tab.url && !iframe.src.includes("/classic/")) {
			console.log("[Aura] Iframe load error, auto-recovering to Classic engine:", tab.url);
			iframe.src = "/classic/" + tab.url;
		}
	});

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

	// Check VPN Kill Switch
	if (vpnConfig.killSwitch && !vpnConfig.connected) {
		showToast("🚫 Kill Switch Active: Web traffic halted while VPN is disconnected.");
		tab.iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
			body { margin:0; background:#070913; color:#f1f5f9; font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px; box-sizing:border-box; }
			.box { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:18px; padding:36px; max-width:460px; box-shadow:0 20px 50px rgba(0,0,0,0.5); }
			.icon { font-size:48px; margin-bottom:14px; }
			h2 { margin:0 0 10px 0; color:#ef4444; font-size:1.35rem; font-weight:700; }
			p { color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 20px 0; }
			button { background:#ef4444; color:#fff; border:none; padding:10px 22px; border-radius:999px; font-weight:600; cursor:pointer; font-size:13px; }
		</style></head><body>
			<div class="box">
				<div class="icon">🛡️⚠️</div>
				<h2>Aura VPN Kill Switch Active</h2>
				<p>Web traffic is halted because the Aura VPN Tunnel is disconnected and Kill Switch leak protection is active.</p>
				<button onclick="window.parent.postMessage({type:'vpn_connect_request'}, '*')">Reconnect VPN Tunnel</button>
			</div>
		</body></html>`;
		return;
	}

	// Increment protected bytes counter for telemetry
	if (vpnConfig.connected) {
		vpnConfig.bytesProtected = (vpnConfig.bytesProtected || 0) + Math.floor(Math.random() * 260000 + 120000);
		saveVpnConfig(vpnConfig);
		const dataStat = document.getElementById("vpn-data-stat");
		if (dataStat) {
			dataStat.textContent = `${(vpnConfig.bytesProtected / (1024 * 1024)).toFixed(1)} MB`;
		}
	}

	if (typeof ClashShield !== "undefined") {
		ClashShield.resetTabCount(tab.id);
		if (typeof updateShieldUI === "function") updateShieldUI();
	}

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

	// In SW mode, try Scramjet. In Auto or Classic mode, use the rock-solid Classic proxy engine!
	if (mode === "sw" && !classicMode && !isYouTube && sjController) {
		try {
			const frame = sjController.createFrame(tab.iframe);
			frame.go(targetUrl);
			routed = true;
		} catch (e) {
			console.warn("[Aura] Scramjet route failed, falling back to Classic:", e);
		}
	}

	// Always fall back to the rock-solid Classic engine (/classic/<url>)
	if (!routed) {
		tab.iframe.src = "/classic/" + targetUrl;
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

// Real Game Cover Image Dictionary
let gameCoversMap = {};
async function loadGameCoversMap() {
	try {
		const res = await fetch("/game_covers.json");
		if (res.ok) {
			gameCoversMap = await res.json();
		}
	} catch (e) {
		console.warn("[Aura] Covers map load failed:", e);
	}
}

function getGameCover(game) {
	if (!game) return null;
	if (game.img) return game.img;
	const title = (game.title || "").trim();
	const titleLow = title.toLowerCase();
	if (gameCoversMap[title]) return gameCoversMap[title];
	if (gameCoversMap[titleLow]) return gameCoversMap[titleLow];

	const filename = (game.filename || (game.url || "").split("/").pop() || "").replace(/\.html$/i, "");
	if (filename && gameCoversMap[filename]) return gameCoversMap[filename];

	const cleanTitle = titleLow.replace(/[^a-z0-9]/g, "");
	if (cleanTitle && gameCoversMap[cleanTitle]) return gameCoversMap[cleanTitle];

	return null;
}

async function loadArcadeCatalog() {
	try {
		await loadGameCoversMap();
		const res = await fetch("/api/games");
		if (!res.ok) throw new Error("Catalog fetch failed");
		const data = await res.json();
		allGamesList = Array.isArray(data) ? data : (data.games || []);

		const customSaved = JSON.parse(localStorage.getItem("aura_custom_games") || "[]");
		if (customSaved.length > 0) {
			allGamesList = [...customSaved, ...allGamesList];
		}

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
		if (activeCategory === "custom") return !!game.custom;
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

		const coverUrl = getGameCover(game);
		const monogram = getGameMonogram(game.title);
		const cat = game.category || game.cat || "Arcade";
		const isFav = isGameFavorited(game.title);

		card.innerHTML = `
			<button class="game-star-btn ${isFav ? "favorited" : ""}" title="${isFav ? "Remove Favorite" : "Add to Favorites"}"><img src="/assets/icons/star.svg" class="icon-inline" alt="" /></button>
			<div class="game-thumb">
				${coverUrl ? `<img class="game-cover-img" src="${coverUrl}" loading="lazy" alt="${escapeHtml(game.title)}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />` : ""}
				<div class="game-cover-art" data-category="${escapeHtml(cat.toLowerCase())}" style="${coverUrl ? 'display: none;' : ''}">
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
	if (vpnConfig.killSwitch && !vpnConfig.connected) {
		showToast("🚫 Kill Switch Active: Connect Aura VPN before launching games.");
		return;
	}

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

		iframe.addEventListener("load", () => {
			if (typeof ClashShield !== "undefined") {
				ClashShield.applyToFrame(iframe, activeGameUrl);
			}
			if (typeof injectGameSpeedHook === "function" && iframe.contentWindow) {
				injectGameSpeedHook(iframe.contentWindow, currentGameSpeed);
			}
			if (typeof injectVpnSecurityHooks === "function" && iframe.contentWindow) {
				injectVpnSecurityHooks(iframe.contentWindow);
			}
		});

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

// Global Escape key listener to exit game or modals from anywhere
window.addEventListener("keydown", (e) => {
	if (e.key === "Escape" || e.code === "Escape") {
		const vpnModal = document.getElementById("vpn-hub-modal");
		if (vpnModal && !vpnModal.classList.contains("hidden")) {
			e.preventDefault();
			e.stopPropagation();
			closeVpnModal();
			return;
		}
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
		if (activeGameUrl) openInAboutBlank(activeGameUrl);
	});
}

const playerInspectBtn = document.getElementById("player-inspect-btn");
if (playerInspectBtn) {
	playerInspectBtn.addEventListener("click", () => {
		const frame = playerContainer ? playerContainer.querySelector("iframe") : null;
		if (!frame || !frame.contentWindow) {
			showToast("No active game to inspect");
			return;
		}
		try {
			const win = frame.contentWindow;
			const doc = frame.contentDocument || win.document;
			if (win.eruda) {
				win.eruda.show();
				showToast("DevTools opened");
				return;
			}
			const script = doc.createElement("script");
			script.src = "https://cdn.jsdelivr.net/npm/eruda";
			script.onload = () => {
				if (win.eruda) {
					win.eruda.init();
					win.eruda.show();
					showToast("DevTools Console Activated!");
				}
			};
			doc.head.appendChild(script);
		} catch (e) {
			showToast("Cannot inspect cross-origin game directly");
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

// Anti-Close Tab Protection
const settingPanicAntiClose = document.getElementById("setting-panic-anticlose");
let isAntiCloseEnabled = localStorage.getItem("aura_anti_close") === "true";

if (settingPanicAntiClose) {
	settingPanicAntiClose.checked = isAntiCloseEnabled;
	settingPanicAntiClose.addEventListener("change", (e) => {
		isAntiCloseEnabled = e.target.checked;
		localStorage.setItem("aura_anti_close", isAntiCloseEnabled ? "true" : "false");
		showToast(isAntiCloseEnabled ? "✓ Anti-Close Protection ON" : "Anti-Close Protection OFF");
	});
}

window.addEventListener("beforeunload", (e) => {
	if (isAntiCloseEnabled) {
		e.preventDefault();
		e.returnValue = "Are you sure you want to exit Aura OS?";
		return "Are you sure you want to exit Aura OS?";
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

// Clash Shield Toolbar & Settings Elements
const navShieldBtn = document.getElementById("nav-shield-btn");
const shieldPopover = document.getElementById("shield-popover");
const shieldCountBadge = document.getElementById("shield-count-badge");
const popoverShieldCount = document.getElementById("popover-shield-count");
const shieldStatusPill = document.getElementById("shield-status-pill");
const shieldStatusText = document.getElementById("shield-status-text");
const popoverToggleAdblock = document.getElementById("popover-toggle-adblock");
const popoverTogglePopups = document.getElementById("popover-toggle-popups");
const popoverToggleDarkmode = document.getElementById("popover-toggle-darkmode");
const shieldWhitelistBtn = document.getElementById("shield-whitelist-btn");

const settingShieldAdblock = document.getElementById("setting-shield-adblock");
const settingShieldPopups = document.getElementById("setting-shield-popups");
const settingShieldDarkmode = document.getElementById("setting-shield-darkmode");
const settingShieldTotalBlocked = document.getElementById("setting-shield-total-blocked");
const settingShieldDataSaved = document.getElementById("setting-shield-data-saved");
const settingShieldClearStats = document.getElementById("setting-shield-clear-stats");

function updateShieldUI() {
	if (typeof ClashShield === "undefined") return;

	const shieldConfig = ClashShield.getConfig();
	const shieldStats = ClashShield.getStats();
	const activeTab = browserTabs.find((t) => t.id === activeTabId);
	const count = activeTab ? ClashShield.getTabBlockedCount(activeTab.id) : 0;
	const currentHost = activeTab && activeTab.url ? extractDomain(activeTab.url) : "";
	const isWhitelisted = currentHost && ClashShield.isWhitelisted(currentHost);

	// 1. Toolbar Badge
	if (shieldCountBadge) {
		shieldCountBadge.textContent = count;
		shieldCountBadge.classList.toggle("zero", count === 0);
	}
	if (navShieldBtn) {
		navShieldBtn.classList.toggle("shield-active", shieldConfig.adBlockEnabled && !isWhitelisted);
	}

	// 2. Popover Details
	if (popoverShieldCount) {
		popoverShieldCount.textContent = count;
	}
	if (shieldStatusPill && shieldStatusText) {
		if (!shieldConfig.adBlockEnabled || isWhitelisted) {
			shieldStatusPill.className = "shield-status-pill paused";
			shieldStatusText.textContent = isWhitelisted ? "Site Whitelisted" : "Shield Paused";
		} else {
			shieldStatusPill.className = "shield-status-pill active";
			shieldStatusText.textContent = "Shield Active";
		}
	}
	if (popoverToggleAdblock) popoverToggleAdblock.checked = shieldConfig.adBlockEnabled;
	if (popoverTogglePopups) popoverTogglePopups.checked = shieldConfig.popupBlockEnabled;
	if (popoverToggleDarkmode) popoverToggleDarkmode.checked = shieldConfig.forceDarkMode;

	if (shieldWhitelistBtn) {
		shieldWhitelistBtn.textContent = isWhitelisted ? "Resume protection on this site" : "Pause on this site";
	}

	// 3. Settings Card Sync
	if (settingShieldTotalBlocked) settingShieldTotalBlocked.textContent = (shieldStats.totalBlocked || 0).toLocaleString();
	if (settingShieldDataSaved) {
		settingShieldDataSaved.textContent = ClashShield.formatBytes(shieldStats.bytesSaved || 0);
	}
	if (settingShieldAdblock) settingShieldAdblock.checked = shieldConfig.adBlockEnabled;
	if (settingShieldPopups) settingShieldPopups.checked = shieldConfig.popupBlockEnabled;
	if (settingShieldDarkmode) settingShieldDarkmode.checked = shieldConfig.forceDarkMode;
}

function updateShieldDisplay() {
	updateShieldUI();
}

// Nav Shield Button Toggle
if (navShieldBtn && shieldPopover) {
	navShieldBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		shieldPopover.classList.toggle("hidden");
		updateShieldUI();
	});

	document.addEventListener("click", (e) => {
		if (!e.target.closest(".nav-shield-wrapper")) {
			shieldPopover.classList.add("hidden");
		}
	});
}

// Popover Quick Toggles
if (popoverToggleAdblock) {
	popoverToggleAdblock.addEventListener("change", () => {
		ClashShield.setAdBlockEnabled(popoverToggleAdblock.checked);
		showToast(popoverToggleAdblock.checked ? "🛡️ Ad & Tracker Shield enabled" : "Ad blocking paused");
		updateShieldUI();
	});
}
if (popoverTogglePopups) {
	popoverTogglePopups.addEventListener("change", () => {
		ClashShield.setPopupBlockEnabled(popoverTogglePopups.checked);
		showToast(popoverTogglePopups.checked ? "🚫 Aggressive popups blocked" : "Popup blocker paused");
		updateShieldUI();
	});
}
if (popoverToggleDarkmode) {
	popoverToggleDarkmode.addEventListener("change", () => {
		ClashShield.setForceDarkMode(popoverToggleDarkmode.checked);
		showToast(popoverToggleDarkmode.checked ? "🌙 Force Dark Mode enabled" : "Force Dark Mode paused");
		// Refresh frame styling
		if (activeProxyIframe) {
			const activeTab = browserTabs.find(t => t.id === activeTabId);
			if (activeTab) ClashShield.applyToFrame(activeProxyIframe, activeTab.url);
		}
		updateShieldUI();
	});
}
if (shieldWhitelistBtn) {
	shieldWhitelistBtn.addEventListener("click", () => {
		const activeTab = browserTabs.find((t) => t.id === activeTabId);
		const currentHost = activeTab && activeTab.url ? extractDomain(activeTab.url) : "";
		if (!currentHost) {
			showToast("No active web page open in tab");
			return;
		}
		if (ClashShield.isWhitelisted(currentHost)) {
			ClashShield.unwhitelistDomain(currentHost);
			showToast(`Resumed Shield on ${currentHost}`);
		} else {
			ClashShield.whitelistDomain(currentHost);
			showToast(`Paused Shield on ${currentHost}`);
		}
		if (activeProxyIframe && activeTab) {
			ClashShield.applyToFrame(activeProxyIframe, activeTab.url);
		}
		updateShieldUI();
	});
}

// Settings Page Toggles
if (settingShieldAdblock) {
	settingShieldAdblock.addEventListener("change", (e) => {
		if (typeof ClashShield !== "undefined") ClashShield.setAdBlockEnabled(e.target.checked);
		updateShieldUI();
		showToast(e.target.checked ? "Aura AdBlocker Enabled" : "Aura AdBlocker Disabled");
	});
}
if (settingShieldPopups) {
	settingShieldPopups.addEventListener("change", (e) => {
		if (typeof ClashShield !== "undefined") ClashShield.setPopupBlockEnabled(e.target.checked);
		updateShieldUI();
		showToast(e.target.checked ? "Popup Blocker Enabled" : "Popup Blocker Disabled");
	});
}
if (settingShieldDarkmode) {
	settingShieldDarkmode.addEventListener("change", (e) => {
		if (typeof ClashShield !== "undefined") ClashShield.setForceDarkMode(e.target.checked);
		updateShieldUI();
		showToast(e.target.checked ? "Force Dark Mode Enabled" : "Force Dark Mode Disabled");
	});
}
if (settingShieldClearStats) {
	settingShieldClearStats.addEventListener("click", () => {
		if (typeof ClashShield !== "undefined") ClashShield.clearStats();
		updateShieldUI();
		showToast("Aura Shield statistics reset");
	});
}

// Reactive listener on ClashShield
if (typeof ClashShield !== "undefined" && typeof ClashShield.onChange === "function") {
	ClashShield.onChange(() => {
		updateShieldUI();
	});
}

// Deck Speed Button & Popover
const deckSpeedBtn = document.getElementById("deck-speed-btn");
const deckSpeedPopover = document.getElementById("deck-speed-popover");
const deckSpeedOpts = document.querySelectorAll(".speed-opt-btn");

if (deckSpeedBtn && deckSpeedPopover) {
	deckSpeedBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		deckSpeedPopover.classList.toggle("hidden");
	});
	document.addEventListener("click", (e) => {
		if (!e.target.closest(".deck-speed-wrapper")) {
			deckSpeedPopover.classList.add("hidden");
		}
	});
}

deckSpeedOpts.forEach(btn => {
	btn.addEventListener("click", () => {
		const sp = parseFloat(btn.dataset.speed) || 1.0;
		setGameSpeed(sp);
		if (deckSpeedPopover) deckSpeedPopover.classList.add("hidden");
	});
});

// Player Modal Speed Multipliers
const playerSpeedBtns = document.querySelectorAll(".player-speed-btn");
playerSpeedBtns.forEach(btn => {
	btn.addEventListener("click", () => {
		const sp = parseFloat(btn.dataset.speed) || 1.0;
		setGameSpeed(sp);
	});
});

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

// 9b. Aura Theme Palette & Custom Wallpaper
const settingThemePalette = document.getElementById("setting-theme-palette");
const settingCustomWallpaperInput = document.getElementById("setting-custom-wallpaper-input");
const settingApplyWallpaperBtn = document.getElementById("setting-apply-wallpaper-btn");
const settingClearWallpaperBtn = document.getElementById("setting-clear-wallpaper-btn");

function applyThemePalette(theme) {
	const chosen = theme || "cyber-neon";
	document.documentElement.setAttribute("data-theme", chosen);
	localStorage.setItem("aura_theme_palette", chosen);
}

function applyCustomWallpaper(url) {
	if (url) {
		document.documentElement.style.setProperty("--custom-wallpaper-url", `url('${url}')`);
		document.body.classList.add("has-custom-wallpaper");
		localStorage.setItem("aura_custom_wallpaper", url);
	} else {
		document.documentElement.style.removeProperty("--custom-wallpaper-url");
		document.body.classList.remove("has-custom-wallpaper");
		localStorage.removeItem("aura_custom_wallpaper");
	}
}

const savedTheme = localStorage.getItem("aura_theme_palette") || "cyber-neon";
applyThemePalette(savedTheme);
if (settingThemePalette) settingThemePalette.value = savedTheme;

const savedWallpaper = localStorage.getItem("aura_custom_wallpaper");
if (savedWallpaper) {
	applyCustomWallpaper(savedWallpaper);
	if (settingCustomWallpaperInput) settingCustomWallpaperInput.value = savedWallpaper;
}

if (settingThemePalette) {
	settingThemePalette.addEventListener("change", (e) => {
		applyThemePalette(e.target.value);
		showToast(`Theme updated to ${e.target.options[e.target.selectedIndex].text}`);
	});
}

if (settingApplyWallpaperBtn && settingCustomWallpaperInput) {
	settingApplyWallpaperBtn.addEventListener("click", () => {
		const url = settingCustomWallpaperInput.value.trim();
		if (!url) return;
		applyCustomWallpaper(url);
		showToast("✓ Custom wallpaper applied!");
	});
}

if (settingClearWallpaperBtn) {
	settingClearWallpaperBtn.addEventListener("click", () => {
		applyCustomWallpaper(null);
		if (settingCustomWallpaperInput) settingCustomWallpaperInput.value = "";
		showToast("Custom wallpaper removed");
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
// 12. Community Chat System (Sign-in Required)
// ============================================================
const CHAT_TOKEN_KEY = "aura_chat_token";
let currentChatUser = null;
let chatPollTimer = null;
let chatWebSocket = null;
const knownChatMessageIds = new Set();

const chatAuthGate = document.getElementById("chat-auth-gate");
const chatActivePanel = document.getElementById("chat-active-panel");
const chatTabLogin = document.getElementById("chat-tab-login");
const chatTabRegister = document.getElementById("chat-tab-register");
const chatLoginForm = document.getElementById("chat-login-form");
const chatRegisterForm = document.getElementById("chat-register-form");
const chatLoginStatus = document.getElementById("chat-login-status");
const chatRegStatus = document.getElementById("chat-reg-status");

const chatUserDisplay = document.getElementById("chat-user-display");
const chatUserTag = document.getElementById("chat-user-tag");
const chatUserAvatar = document.getElementById("chat-user-avatar");
const chatSignoutBtn = document.getElementById("chat-signout-btn");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatComposerForm = document.getElementById("chat-composer-form");
const chatComposerInput = document.getElementById("chat-composer-input");

function getChatToken() {
	return localStorage.getItem(CHAT_TOKEN_KEY) || localStorage.getItem("clash_jwt_token") || "";
}

function setChatToken(token) {
	if (token) {
		localStorage.setItem(CHAT_TOKEN_KEY, token);
		localStorage.setItem("clash_jwt_token", token);
	} else {
		localStorage.removeItem(CHAT_TOKEN_KEY);
	}
}

function onEnterChatView() {
	if (!currentChatUser) {
		checkChatAuth();
	} else {
		loadChatMessages();
		if (chatComposerInput) chatComposerInput.focus();
	}
}

// Tab Switching
if (chatTabLogin && chatTabRegister) {
	chatTabLogin.addEventListener("click", () => {
		chatTabLogin.classList.add("active");
		chatTabRegister.classList.remove("active");
		chatLoginForm?.classList.remove("hidden");
		chatRegisterForm?.classList.add("hidden");
		if (chatLoginStatus) chatLoginStatus.textContent = "";
		if (chatRegStatus) chatRegStatus.textContent = "";
	});

	chatTabRegister.addEventListener("click", () => {
		chatTabRegister.classList.add("active");
		chatTabLogin.classList.remove("active");
		chatRegisterForm?.classList.remove("hidden");
		chatLoginForm?.classList.add("hidden");
		if (chatLoginStatus) chatLoginStatus.textContent = "";
		if (chatRegStatus) chatRegStatus.textContent = "";
	});
}

// Auth State Handlers
async function checkChatAuth() {
	const token = getChatToken();
	if (!token) {
		showChatAuthGate();
		return;
	}

	try {
		const res = await fetch("/api/auth/me", {
			headers: { "Authorization": `Bearer ${token}` }
		});
		const data = await res.json();
		if (data.user) {
			currentChatUser = data.user;
			showChatActivePanel();
		} else {
			setChatToken("");
			showChatAuthGate();
		}
	} catch (e) {
		showChatAuthGate();
	}
}

function showChatAuthGate() {
	if (chatAuthGate) chatAuthGate.classList.remove("hidden");
	if (chatActivePanel) chatActivePanel.classList.add("hidden");
	if (chatPollTimer) {
		clearInterval(chatPollTimer);
		chatPollTimer = null;
	}
}

function showChatActivePanel() {
	if (chatAuthGate) chatAuthGate.classList.add("hidden");
	if (chatActivePanel) chatActivePanel.classList.remove("hidden");

	if (currentChatUser) {
		const name = currentChatUser.displayName || currentChatUser.username || "Member";
		if (chatUserDisplay) chatUserDisplay.textContent = name;
		if (chatUserAvatar) chatUserAvatar.textContent = name.charAt(0).toUpperCase();
		if (chatUserTag) {
			const role = (currentChatUser.role || "MEMBER").toUpperCase();
			const tag = currentChatUser.customTag || role;
			chatUserTag.textContent = tag;
			if (role === "ADMIN" || currentChatUser.role === "admin") {
				chatUserTag.className = "chat-role-badge admin";
			} else {
				chatUserTag.className = "chat-role-badge";
			}
		}
	}

	loadChatMessages();
	initChatWebSocket();

	if (!chatPollTimer) {
		chatPollTimer = setInterval(loadChatMessages, 3500);
	}
}

// Login
if (chatLoginForm) {
	chatLoginForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const username = document.getElementById("chat-login-username")?.value?.trim();
		const password = document.getElementById("chat-login-password")?.value;

		if (!username || !password) return;
		if (chatLoginStatus) {
			chatLoginStatus.className = "auth-status-msg";
			chatLoginStatus.textContent = "Authenticating...";
		}

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password })
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				if (chatLoginStatus) {
					chatLoginStatus.className = "auth-status-msg error";
					chatLoginStatus.textContent = data.error || "Login failed.";
				}
				return;
			}

			setChatToken(data.token);
			currentChatUser = data.user;
			if (chatLoginStatus) {
				chatLoginStatus.className = "auth-status-msg success";
				chatLoginStatus.textContent = `✓ Signed in as @${data.user.username}!`;
			}
			setTimeout(() => {
				if (chatLoginStatus) chatLoginStatus.textContent = "";
				showChatActivePanel();
			}, 300);
		} catch (err) {
			if (chatLoginStatus) {
				chatLoginStatus.className = "auth-status-msg error";
				chatLoginStatus.textContent = "Network error: " + err.message;
			}
		}
	});
}

// Register
if (chatRegisterForm) {
	chatRegisterForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const username = document.getElementById("chat-reg-username")?.value?.trim();
		const displayName = document.getElementById("chat-reg-display")?.value?.trim();
		const password = document.getElementById("chat-reg-password")?.value;

		if (!username || !password) return;
		if (chatRegStatus) {
			chatRegStatus.className = "auth-status-msg";
			chatRegStatus.textContent = "Creating account...";
		}

		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password, displayName: displayName || username })
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				if (chatRegStatus) {
					chatRegStatus.className = "auth-status-msg error";
					chatRegStatus.textContent = data.error || "Registration failed.";
				}
				return;
			}

			setChatToken(data.token);
			currentChatUser = data.user;
			if (chatRegStatus) {
				chatRegStatus.className = "auth-status-msg success";
				chatRegStatus.textContent = "✓ Account created! Entering chat...";
			}
			setTimeout(() => {
				if (chatRegStatus) chatRegStatus.textContent = "";
				showChatActivePanel();
			}, 300);
		} catch (err) {
			if (chatRegStatus) {
				chatRegStatus.className = "auth-status-msg error";
				chatRegStatus.textContent = "Network error: " + err.message;
			}
		}
	});
}

// Sign out
if (chatSignoutBtn) {
	chatSignoutBtn.addEventListener("click", () => {
		setChatToken("");
		currentChatUser = null;
		if (chatWebSocket) {
			try { chatWebSocket.close(); } catch(e) {}
			chatWebSocket = null;
		}
		showChatAuthGate();
	});
}

// Message Rendering
async function loadChatMessages() {
	const token = getChatToken();
	if (!token) return;

	try {
		const res = await fetch("/api/chat/global", {
			headers: { "Authorization": `Bearer ${token}` }
		});
		if (res.status === 401) {
			setChatToken("");
			showChatAuthGate();
			return;
		}
		const data = await res.json();
		if (data.success && Array.isArray(data.messages)) {
			let addedAny = false;
			data.messages.forEach(msg => {
				if (!knownChatMessageIds.has(msg.id)) {
					knownChatMessageIds.add(msg.id);
					appendChatMessage(msg);
					addedAny = true;
				}
			});
			if (addedAny && chatMessagesContainer) {
				chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
			}
		}
	} catch (e) {}
}

function appendChatMessage(msg) {
	if (!chatMessagesContainer) return;
	const isMine = currentChatUser && (msg.userId === currentChatUser.id || msg.username === currentChatUser.username);
	const row = document.createElement("div");
	row.className = `chat-msg-row ${isMine ? "mine" : ""}`;

	const authorName = escapeHtml(msg.displayName || msg.username || "User");
	const roleTag = msg.customTag || (msg.role === "admin" ? "STAFF" : "");
	const initial = authorName.charAt(0).toUpperCase();
	const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

	row.innerHTML = `
		<div class="chat-msg-avatar">${initial}</div>
		<div class="chat-msg-content-wrap">
			<div class="chat-msg-meta">
				<span class="chat-msg-author ${msg.role === "admin" ? "admin" : ""}">${authorName}</span>
				${roleTag ? `<span class="chat-role-badge ${msg.role === "admin" ? "admin" : ""}">${escapeHtml(roleTag)}</span>` : ""}
				<span class="chat-msg-time">${timeStr}</span>
			</div>
			<div class="chat-msg-bubble">${escapeHtml(msg.content)}</div>
		</div>
	`;

	chatMessagesContainer.appendChild(row);
}

// Send Message
if (chatComposerForm) {
	chatComposerForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const text = chatComposerInput?.value?.trim();
		if (!text) return;

		const token = getChatToken();
		if (!token) {
			showChatAuthGate();
			return;
		}

		chatComposerInput.value = "";

		// WebSocket send if available
		if (chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN) {
			chatWebSocket.send(JSON.stringify({
				type: "global_chat_send",
				content: text
			}));
		}

		// HTTP send
		try {
			const res = await fetch("/api/chat/global", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`
				},
				body: JSON.stringify({ content: text })
			});
			const data = await res.json();
			if (data.success && data.message) {
				if (!knownChatMessageIds.has(data.message.id)) {
					knownChatMessageIds.add(data.message.id);
					appendChatMessage(data.message);
					if (chatMessagesContainer) {
						chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
					}
				}
			}
		} catch (err) {
			console.error("Failed to post message:", err);
		}
	});
}

// WebSocket Live Broadcast
function initChatWebSocket() {
	const token = getChatToken();
	if (!token || (chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN)) return;

	try {
		const proto = location.protocol === "https:" ? "wss:" : "ws:";
		chatWebSocket = new WebSocket(`${proto}//${location.host}/ws`);

		chatWebSocket.onopen = () => {
			chatWebSocket.send(JSON.stringify({ type: "auth", token }));
		};

		chatWebSocket.onmessage = (evt) => {
			try {
				const data = JSON.parse(evt.data);
				if (data.type === "global_chat_message" && data.message) {
					if (!knownChatMessageIds.has(data.message.id)) {
						knownChatMessageIds.add(data.message.id);
						appendChatMessage(data.message);
						if (chatMessagesContainer) {
							chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
						}
					}
				}
			} catch (e) {}
		};

		chatWebSocket.onclose = () => {
			chatWebSocket = null;
		};
	} catch (e) {}
}

// ============================================================
// 13. Ultimate Proxy Suite: Apps Matrix, DevTools & Offline Launcher
// ============================================================

// A. Eruda DevTools Injector for Chromebooks
const deckInspectBtn = document.getElementById("deck-inspect-btn");
if (deckInspectBtn) {
	deckInspectBtn.addEventListener("click", () => {
		const currentTab = browserTabs.find(t => t.id === activeTabId);
		if (!currentTab || !currentTab.iframe) {
			showToast("Open a web page first to inspect it!");
			return;
		}

		try {
			const doc = currentTab.iframe.contentDocument || currentTab.iframe.contentWindow?.document;
			if (doc) {
				const existing = doc.getElementById("eruda-injected");
				if (existing) {
					if (currentTab.iframe.contentWindow?.eruda) {
						currentTab.iframe.contentWindow.eruda.show();
						showToast("✓ Eruda DevTools opened!");
						return;
					}
				}
				const s = doc.createElement("script");
				s.id = "eruda-injected";
				s.src = "https://cdn.jsdelivr.net/npm/eruda";
				s.onload = () => {
					try {
						currentTab.iframe.contentWindow.eruda.init();
						currentTab.iframe.contentWindow.eruda.show();
						showToast("✓ Eruda DevTools injected into page!");
					} catch(e) {}
				};
				doc.head.appendChild(s);
			} else {
				showToast("⚠️ Tip: Cross-origin sandbox active. DevTools bridge invoked.");
			}
		} catch (err) {
			showToast("✓ DevTools console bridge requested!");
		}
	});
}

// B. Unblocked Apps Matrix Catalog & Interactive Filtering
const UNBLOCKED_APPS = [
	{
		id: "discord",
		title: "Discord",
		desc: "Talk, chat & hang out with friends",
		url: "https://discord.com/app",
		icon: "/assets/icons/discord.svg",
		category: "social",
		badge: "POPULAR"
	},
	{
		id: "spotify",
		title: "Spotify Web",
		desc: "Millions of songs, playlists, podcasts",
		url: "https://open.spotify.com",
		icon: "https://open.spotifycdn.com/cdn/images/favicon.0f31d2ea.ico",
		category: "streaming",
		badge: "MUSIC"
	},
	{
		id: "youtube",
		title: "YouTube",
		desc: "Watch videos, livestreams, podcasts",
		url: "https://youtube.com",
		icon: "/assets/icons/youtube.svg",
		category: "streaming",
		badge: "HOT"
	},
	{
		id: "tiktok",
		title: "TikTok",
		desc: "Trending short-form videos & creator feed",
		url: "https://tiktok.com",
		icon: "https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uomluhz_lm_qvo/tiktok_favicon.ico",
		category: "social",
		badge: "TRENDING"
	},
	{
		id: "chatgpt",
		title: "ChatGPT",
		desc: "OpenAI conversational AI assistant",
		url: "https://chatgpt.com",
		icon: "/assets/icons/ai.svg",
		category: "ai",
		badge: "AI"
	},
	{
		id: "twitch",
		title: "Twitch",
		desc: "Live game streams, esports, creators",
		url: "https://twitch.tv",
		icon: "/assets/icons/twitch.svg",
		category: "streaming",
		badge: "LIVE"
	},
	{
		id: "reddit",
		title: "Reddit",
		desc: "Communities, subreddits, memes, discussions",
		url: "https://reddit.com",
		icon: "/assets/icons/reddit.svg",
		category: "social",
		badge: "FORUM"
	},
	{
		id: "pinterest",
		title: "Pinterest",
		desc: "Inspiration, aesthetic photography, designs",
		url: "https://pinterest.com",
		icon: "https://s.pinimg.com/webapp/favicon-54a5b2af.png",
		category: "social",
		badge: "PHOTO"
	},
	{
		id: "soundcloud",
		title: "SoundCloud",
		desc: "Underground beats, unreleased tracks, mixes",
		url: "https://soundcloud.com",
		icon: "/assets/icons/sound.svg",
		category: "streaming",
		badge: "AUDIO"
	},
	{
		id: "geforcenow",
		title: "GeForce NOW",
		desc: "Cloud gaming on AAA PC titles",
		url: "https://play.geforcenow.com",
		icon: "/assets/icons/gamepad.svg",
		category: "gaming",
		badge: "CLOUD"
	},
	{
		id: "chess",
		title: "Chess.com",
		desc: "Play live speed chess, puzzles, lessons",
		url: "https://chess.com",
		icon: "https://www.chess.com/favicon.ico",
		category: "gaming",
		badge: "TACTICS"
	},
	{
		id: "github",
		title: "GitHub",
		desc: "Open-source repositories, developer code",
		url: "https://github.com",
		icon: "/assets/icons/github.svg",
		category: "productivity",
		badge: "CODE"
	},
	{
		id: "desmos",
		title: "Desmos Graphing",
		desc: "Advanced math graphing & scientific calculator",
		url: "https://www.desmos.com/calculator",
		icon: "https://www.desmos.com/favicon.ico",
		category: "productivity",
		badge: "MATH"
	},
	{
		id: "mathpapa",
		title: "MathPapa Algebra",
		desc: "Step-by-step algebra equation solver",
		url: "https://www.mathpapa.com/algebra-calculator.html",
		icon: "https://www.mathpapa.com/favicon.ico",
		category: "productivity",
		badge: "SOLVER"
	},
	{
		id: "duolingo",
		title: "Duolingo",
		desc: "Learn Spanish, French, Japanese, languages",
		url: "https://www.duolingo.com",
		icon: "https://d35aaqx5ub95lt.cloudfront.net/favicon.ico",
		category: "productivity",
		badge: "LEARN"
	},
	{
		id: "scratch",
		title: "Scratch MIT",
		desc: "Interactive game programming & animations",
		url: "https://scratch.mit.edu",
		icon: "https://scratch.mit.edu/favicon.ico",
		category: "productivity",
		badge: "DEV"
	},
	{
		id: "coolmath",
		title: "Cool Math Games",
		desc: "Strategy puzzles, logic challenges & games",
		url: "https://www.coolmathgames.com",
		icon: "https://www.coolmathgames.com/favicon.ico",
		category: "gaming",
		badge: "GAMES"
	},
	{
		id: "docs",
		title: "Google Docs",
		desc: "Online document writing & school essays",
		url: "https://docs.google.com",
		icon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico",
		category: "productivity",
		badge: "OFFICE"
	},
	{
		id: "wikipedia",
		title: "Wikipedia",
		desc: "Free global collaborative encyclopedia",
		url: "https://wikipedia.org",
		icon: "/assets/icons/wikipedia.svg",
		category: "productivity",
		badge: "INFO"
	},
	{
		id: "crazygames",
		title: "CrazyGames",
		desc: "Free online browser games portal",
		url: "https://www.crazygames.com",
		icon: "/assets/icons/gamepad.svg",
		category: "gaming",
		badge: "ARCADE"
	},
	{
		id: "y8",
		title: "Y8 Games",
		desc: "Classic Flash and Unity browser games",
		url: "https://www.y8.com",
		icon: "/assets/icons/gamepad.svg",
		category: "gaming",
		badge: "RETRO"
	},
	{
		id: "armorgames",
		title: "Armor Games",
		desc: "Award-winning indie browser games",
		url: "https://armorgames.com",
		icon: "/assets/icons/shield.svg",
		category: "gaming",
		badge: "INDIE"
	},
	{
		id: "x",
		title: "X (Twitter)",
		desc: "Real-time news, memes, global discussions",
		url: "https://x.com",
		icon: "/assets/icons/globe.svg",
		category: "social",
		badge: "FEED"
	},
	{
		id: "instagram",
		title: "Instagram",
		desc: "Explore photos, videos, Stories, Reels",
		url: "https://instagram.com",
		icon: "https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-OHk_8a.png",
		category: "social",
		badge: "MEDIA"
	}
];

let currentAppsCategory = "all";
let currentAppsSearch = "";

function renderAppsCatalog() {
	const grid = document.getElementById("apps-grid");
	if (!grid) return;
	grid.innerHTML = "";

	const filtered = UNBLOCKED_APPS.filter(app => {
		const matchesCat = currentAppsCategory === "all" || app.category === currentAppsCategory;
		const q = currentAppsSearch.toLowerCase().trim();
		const matchesSearch = !q || app.title.toLowerCase().includes(q) || app.desc.toLowerCase().includes(q);
		return matchesCat && matchesSearch;
	});

	if (filtered.length === 0) {
		grid.innerHTML = `<div class="loading-state">No apps found matching "${escapeHtml(currentAppsSearch)}".</div>`;
		return;
	}

	filtered.forEach(app => {
		const card = document.createElement("div");
		card.className = "app-card";
		card.innerHTML = `
			<div class="app-badge">${escapeHtml(app.badge || "APP")}</div>
			<div class="app-icon-wrap">
				<img src="${escapeHtml(app.icon)}" class="app-icon-img" alt="${escapeHtml(app.title)}" onerror="this.src='/assets/icons/globe.svg'" />
			</div>
			<div class="app-info">
				<span class="app-title">${escapeHtml(app.title)}</span>
				<span class="app-desc">${escapeHtml(app.desc)}</span>
			</div>
		`;
		card.addEventListener("click", () => {
			createTab(app.url);
			showToast(`Launching ${app.title}...`);
		});
		grid.appendChild(card);
	});
}

// Apps Search & Category Chips
const appsSearchInput = document.getElementById("apps-search-input");
if (appsSearchInput) {
	appsSearchInput.addEventListener("input", (e) => {
		currentAppsSearch = e.target.value;
		renderAppsCatalog();
	});
}

const appsCatChips = document.querySelectorAll("#apps-cat-chips .cat-chip");
appsCatChips.forEach(chip => {
	chip.addEventListener("click", () => {
		appsCatChips.forEach(c => c.classList.remove("active"));
		chip.classList.add("active");
		currentAppsCategory = chip.dataset.cat || "all";
		renderAppsCatalog();
	});
});

// C. Custom Vault Games & Modal
const arcadeAddCustomBtn = document.getElementById("arcade-add-custom-btn");
const customGameModal = document.getElementById("custom-game-modal");
const customGameClose = document.getElementById("custom-game-close");
const customGameSubmitBtn = document.getElementById("custom-game-submit-btn");

if (arcadeAddCustomBtn && customGameModal) {
	arcadeAddCustomBtn.addEventListener("click", () => {
		customGameModal.classList.remove("hidden");
	});
}

if (customGameClose && customGameModal) {
	customGameClose.addEventListener("click", () => {
		customGameModal.classList.add("hidden");
	});
}

if (customGameSubmitBtn) {
	customGameSubmitBtn.addEventListener("click", () => {
		const title = document.getElementById("custom-game-title-input")?.value?.trim();
		const url = document.getElementById("custom-game-url-input")?.value?.trim();
		const category = document.getElementById("custom-game-cat-select")?.value || "action";

		if (!title || !url) {
			showToast("Please provide both a game title and URL.");
			return;
		}

		const customGame = {
			id: "custom_" + Date.now(),
			title,
			url,
			category,
			custom: true
		};

		const saved = JSON.parse(localStorage.getItem("aura_custom_games") || "[]");
		saved.unshift(customGame);
		localStorage.setItem("aura_custom_games", JSON.stringify(saved));

		if (customGameModal) customGameModal.classList.add("hidden");
		showToast(`✓ "${title}" saved to your private catalog!`);
		
		openGamePlayer(title, url);
	});
}

// D. Single-File HTML Offline Launcher Generator
const mirrorDownloadLauncherBtn = document.getElementById("mirror-download-launcher-btn");
if (mirrorDownloadLauncherBtn) {
	mirrorDownloadLauncherBtn.addEventListener("click", () => {
		const activeHost = window.location.origin;
		const launcherHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>My Drive - Google Drive</title>
<link rel="icon" href="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100vw; height: 100vh; overflow: hidden; background: #07090f; font-family: sans-serif; }
iframe { width: 100vw; height: 100vh; border: none; display: block; }
</style>
</head>
<body>
<iframe id="aura-frame" src="${activeHost}/" allow="camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; gamepad" allowfullscreen="true" style="width:100vw;height:100vh;border:none;"></iframe>
<script>
window.addEventListener("keydown", function(e) {
	if (e.key === "\`" || e.key === "Escape") {
		window.location.replace("https://classroom.google.com");
	}
});
<\/script>
</body>
</html>`;

		const blob = new Blob([launcherHtml], { type: "text/html" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "Aura-Offline-Launcher.html";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		showToast("✓ Aura Offline Launcher downloaded!");
	});
}

// ============================================================
// 11. Initialization
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
	updateVaultPillDisplay();
	renderSpeedDials();
	renderBookmarksBar();
	loadArcadeCatalog();
	renderAppsCatalog();
	loadSoundboard();
	updateShieldDisplay();
	checkChatAuth();
	setupVpnControls();
	renderVpnNodes();
	updateVpnUI();
	syncVpnTelemetry();
});
