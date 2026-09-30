"use strict";

/**
 * Clash Proxy v3.0 — Main Application Logic
 *
 * Manages Scramjet V2 proxy engine, Arcade Games library,
 * user authentication, profiles, friend networks, real-time presence,
 * XP/Level gamification, and UI pages.
 */

// Remote logging
window.addEventListener("error", (e) => {
	fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "error", message: e.message, filename: e.filename, lineno: e.lineno }) }).catch(()=>{});
});
window.addEventListener("unhandledrejection", (e) => {
	fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "unhandledrejection", reason: e.reason ? e.reason.toString() : "Unknown", stack: e.reason && e.reason.stack }) }).catch(()=>{});
});

// ============================================================
// DOM Elements
// ============================================================

// Landing page / Proxy Form
const mainContent = document.getElementById("main-content");
const proxyForm = document.getElementById("proxy-form");
const proxyInput = document.getElementById("proxy-input");
const proxyError = document.getElementById("proxy-error");
const proxyErrorMessage = document.getElementById("proxy-error-message");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

// Browser Chrome
const browserChrome = document.getElementById("browser-chrome");
const tabList = document.getElementById("tab-list");
const newTabBtn = document.getElementById("new-tab-btn");
const framesContainer = document.getElementById("frames-container");

// Nav buttons
const navBackBtn = document.getElementById("nav-back-btn");
const navForwardBtn = document.getElementById("nav-forward-btn");
const navRefreshBtn = document.getElementById("nav-refresh-btn");
const navHomeBtn = document.getElementById("nav-home-btn");
const navFullscreenBtn = document.getElementById("nav-fullscreen-btn");
const fullscreenIconEnter = document.getElementById("fullscreen-icon-enter");
const fullscreenIconExit = document.getElementById("fullscreen-icon-exit");
const navUrlInput = document.getElementById("nav-url-input");
const navAboutblankBtn = document.getElementById("nav-aboutblank-btn");
const navSidebarBtn = document.getElementById("nav-sidebar-btn");

// Floating Game Controls
const gameControlsBar = document.getElementById("game-controls-bar");
const gameCtrlBack = document.getElementById("game-ctrl-back");
const gameCtrlFullscreen = document.getElementById("game-ctrl-fullscreen");
const gameCtrlAboutblank = document.getElementById("game-ctrl-aboutblank");

// Sidebar & Navigation
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const sidebarLinks = document.querySelectorAll(".sidebar-link");
const pages = document.querySelectorAll(".page");
const userHeaderWidget = document.getElementById("user-header-widget");
const friendsBadge = document.getElementById("friends-badge");

// Games Section
const gamesGrid = document.getElementById("games-grid");
const gamesSearchInput = document.getElementById("games-search-input");
const gamesCountBadge = document.getElementById("games-count-badge");

// Profile Section Elements
const profileAvatarDisplay = document.getElementById("profile-avatar-display");
const changeAvatarBtn = document.getElementById("change-avatar-btn");
const profileDisplayName = document.getElementById("profile-display-name");
const profileLevelBadge = document.getElementById("profile-level-badge");
const profileRankTitle = document.getElementById("profile-rank-title");
const profileUsernameTag = document.getElementById("profile-username-tag");
const profileBio = document.getElementById("profile-bio");
const editProfileBtn = document.getElementById("edit-profile-btn");
const logoutBtn = document.getElementById("logout-btn");
const profileLoginBtn = document.getElementById("profile-login-btn");
const xpCurrentDisplay = document.getElementById("xp-current-display");
const xpNextDisplay = document.getElementById("xp-next-display");
const xpBarFill = document.getElementById("xp-bar-fill");
const statGamesPlayed = document.getElementById("stat-games-played");
const statSitesVisited = document.getElementById("stat-sites-visited");
const statLoginStreak = document.getElementById("stat-login-streak");
const statBadgesUnlocked = document.getElementById("stat-badges-unlocked");
const badgesGrid = document.getElementById("badges-grid");

// Friends Section Elements
const addFriendForm = document.getElementById("add-friend-form");
const friendUsernameInput = document.getElementById("friend-username-input");
const pendingRequestsSection = document.getElementById("pending-requests-section");
const pendingCount = document.getElementById("pending-count");
const pendingRequestsList = document.getElementById("pending-requests-list");
const onlineFriendsCount = document.getElementById("online-friends-count");
const onlineFriendsList = document.getElementById("online-friends-list");
const offlineFriendsCount = document.getElementById("offline-friends-count");
const offlineFriendsList = document.getElementById("offline-friends-list");

// Leaderboard Section Elements
const leaderboardList = document.getElementById("leaderboard-list");

// Settings Section Elements
const settingGhostMode = document.getElementById("setting-ghost-mode");
const cloakBtns = document.querySelectorAll(".cloak-btn");
const themeBtns = document.querySelectorAll(".theme-btn");

// Chromebook Optimizer Elements
const settingPerfStaticBg = document.getElementById("setting-perf-staticbg");
const settingPerfLightUi = document.getElementById("setting-perf-lightui");
const settingPerfFrameBoost = document.getElementById("setting-perf-frameboost");
const settingPerfResolution = document.getElementById("setting-perf-resolution");

// Clash Shield Elements
const navShieldBtn = document.getElementById("nav-shield-btn");
const shieldPopover = document.getElementById("shield-popover");
const shieldCountBadge = document.getElementById("shield-count-badge");
const popoverShieldCount = document.getElementById("popover-shield-count");
const shieldStatusPill = document.getElementById("shield-status-pill");
const shieldStatusText = document.getElementById("shield-status-text");
const popoverToggleAdBlock = document.getElementById("popover-toggle-adblock");
const popoverTogglePopups = document.getElementById("popover-toggle-popups");
const popoverToggleDarkMode = document.getElementById("popover-toggle-darkmode");
const shieldWhitelistBtn = document.getElementById("shield-whitelist-btn");
const settingShieldAdBlock = document.getElementById("setting-shield-adblock");
const settingShieldPopups = document.getElementById("setting-shield-popups");
const settingShieldDarkMode = document.getElementById("setting-shield-darkmode");
const settingShieldTotalBlocked = document.getElementById("setting-shield-total-blocked");
const settingShieldDataSaved = document.getElementById("setting-shield-data-saved");
const settingShieldClearStats = document.getElementById("setting-shield-clear-stats");

// Bookmarks & Speed Dial Elements
const navBookmarkBtn = document.getElementById("nav-bookmark-btn");
const speedDialGrid = document.getElementById("speed-dial-grid");
const addShortcutBtn = document.getElementById("add-shortcut-btn");
const shortcutModal = document.getElementById("shortcut-modal");
const shortcutModalClose = document.getElementById("shortcut-modal-close");
const shortcutForm = document.getElementById("shortcut-form");
const shortcutTitle = document.getElementById("shortcut-title");
const shortcutUrl = document.getElementById("shortcut-url");
const shortcutIcon = document.getElementById("shortcut-icon");

// Floating Chat Drawer Elements
const chatDrawer = document.getElementById("chat-drawer");
const chatMinimizeBtn = document.getElementById("chat-minimize-btn");
const chatCloseBtn = document.getElementById("chat-close-btn");
const chatFriendAvatar = document.getElementById("chat-friend-avatar");
const chatFriendName = document.getElementById("chat-friend-name");
const chatFriendStatus = document.getElementById("chat-friend-status");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatShareGameBtn = document.getElementById("chat-share-game-btn");
const chatShareTabBtn = document.getElementById("chat-share-tab-btn");
const chatInputForm = document.getElementById("chat-input-form");
const chatMessageInput = document.getElementById("chat-message-input");

// Dedicated Chat Page Elements
const pageChat = document.getElementById("page-chat");
const navChat = document.getElementById("nav-chat");
const chatNavUnreadBadge = document.getElementById("chat-nav-unread-badge");
const chatPageOnlineCount = document.getElementById("chat-page-online-count");
const chatSearchInput = document.getElementById("chat-search-input");
const chatConversationsList = document.getElementById("chat-conversations-list");
const chatEmptySelection = document.getElementById("chat-empty-selection");
const chatActiveFeedWrap = document.getElementById("chat-active-feed-wrap");
const chatActiveAvatar = document.getElementById("chat-active-avatar");
const chatActiveStatusDot = document.getElementById("chat-active-status-dot");
const chatActiveName = document.getElementById("chat-active-name");
const chatActiveUsername = document.getElementById("chat-active-username");
const chatActivePresence = document.getElementById("chat-active-presence");
const chatHeaderInviteBtn = document.getElementById("chat-header-invite-btn");
const chatHeaderProfileBtn = document.getElementById("chat-header-profile-btn");
const chatPageMessages = document.getElementById("chat-page-messages");
const chatPageTyping = document.getElementById("chat-page-typing");
const chatPageTypingText = document.getElementById("chat-page-typing-text");
const chatPageForm = document.getElementById("chat-page-form");
const chatPageInput = document.getElementById("chat-page-input");
const chatPageSendBtn = document.getElementById("chat-page-send-btn");
const chatPageShareGameBtn = document.getElementById("chat-page-share-game-btn");
const chatPageShareTabBtn = document.getElementById("chat-page-share-tab-btn");

// Modals
const authModal = document.getElementById("auth-modal");
const authModalClose = document.getElementById("auth-modal-close");
const tabLoginBtn = document.getElementById("tab-login-btn");
const tabRegisterBtn = document.getElementById("tab-register-btn");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const regUsernameInput = document.getElementById("reg-username");
const regDisplayNameInput = document.getElementById("reg-displayname");
const regPasswordInput = document.getElementById("reg-password");
const loginErrorMsg = document.getElementById("login-error");
const registerErrorMsg = document.getElementById("register-error");

const profileModal = document.getElementById("profile-modal");
const profileModalClose = document.getElementById("profile-modal-close");
const editProfileForm = document.getElementById("edit-profile-form");
const editDisplayNameInput = document.getElementById("edit-display-name");
const editBioInput = document.getElementById("edit-bio");
const avatarOptions = document.querySelectorAll(".avatar-option");

// Toast Container
const toastContainer = document.getElementById("toast-container");

// Owner Panel sidebar link (leads to the separate owner panel on localhost:8081)
const navOwnerPanel = document.getElementById("nav-owner-panel");


// Clash Lounge Elements
const navLounge = document.getElementById("nav-lounge");
const pageLounge = document.getElementById("page-lounge");
const loungeOpenCreateBtn = document.getElementById("lounge-open-create-btn");
const loungeJoinCodeInput = document.getElementById("lounge-join-code-input");
const loungeJoinCodeBtn = document.getElementById("lounge-join-code-btn");
const loungeCreateDrawer = document.getElementById("lounge-create-drawer");
const loungeCreateClose = document.getElementById("lounge-create-close");
const loungeCreateForm = document.getElementById("lounge-create-form");
const loungeInputName = document.getElementById("lounge-input-name");
const loungeSelectGame = document.getElementById("lounge-select-game");
const loungeSelectMax = document.getElementById("lounge-select-max");
const loungeCreateCancel = document.getElementById("lounge-create-cancel");
const loungeLobbyView = document.getElementById("lounge-lobby-view");
const loungeActiveRoomView = document.getElementById("lounge-active-room-view");
const loungeRoomsGrid = document.getElementById("lounge-rooms-grid");
const loungeActiveCount = document.getElementById("lounge-active-count");
const loungeRefreshRoomsBtn = document.getElementById("lounge-refresh-rooms-btn");
const loungeRoomTitle = document.getElementById("lounge-room-title");
const loungeRoomCodeBadge = document.getElementById("lounge-room-code-badge");
const loungeFeaturedGamePill = document.getElementById("lounge-featured-game-pill");
const loungeLaunchGameBtn = document.getElementById("lounge-launch-game-btn");
const loungeLeaveRoomBtn = document.getElementById("lounge-leave-room-btn");
const loungeMembersList = document.getElementById("lounge-members-list");
const loungeMembersCount = document.getElementById("lounge-members-count");
const loungeChatMessages = document.getElementById("lounge-chat-messages");
const loungeChatForm = document.getElementById("lounge-chat-form");
const loungeChatInput = document.getElementById("lounge-chat-input");

// About:Blank Cloaking Elements
const settingAboutBlankAuto = document.getElementById("setting-aboutblank-autocloak");
const settingAboutBlankDecoyUrl = document.getElementById("setting-aboutblank-decoy-url");
const settingAboutBlankLaunchBtn = document.getElementById("setting-aboutblank-launch-btn");
const aboutBlankPresetBtns = document.querySelectorAll(".aboutblank-preset-btn");
const navAboutBlankBtn = document.getElementById("nav-aboutblank-btn");

// Game Controls Modal Elements
const navToolkitBtn = document.getElementById("nav-toolkit-btn");
const gameToolkitModal = document.getElementById("game-toolkit-modal");
const gameToolkitModalClose = document.getElementById("game-toolkit-modal-close");
const toolkitActiveGamePill = document.getElementById("toolkit-active-game-pill");
const speedButtons = document.querySelectorAll(".speed-btn");
const tweakToggleDarkmode = document.getElementById("tweak-toggle-darkmode");
const tweakToggleFps = document.getElementById("tweak-toggle-fps");
const tweakToggleAutoclick = document.getElementById("tweak-toggle-autoclick");

// Tilted Crown SVG
const TILTED_CROWN_SVG = `
	<span class="ted-tilted-crown" title="Founder & Dev Crown">
		<svg viewBox="0 0 24 24" width="24" height="24">
			<defs>
				<linearGradient id="gold-crown-grad" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#fff275" />
					<stop offset="50%" stop-color="#ffd700" />
					<stop offset="100%" stop-color="#e67e22" />
				</linearGradient>
			</defs>
			<path d="M2 19h20v2H2v-2zm1.5-3L6 8l5 5 7-9 2.5 12H3.5z" fill="url(#gold-crown-grad)"/>
			<circle cx="6" cy="8" r="1.3" fill="#ffffff" />
			<circle cx="11" cy="13" r="1.3" fill="#ffffff" />
			<circle cx="18" cy="5" r="1.3" fill="#ffffff" />
		</svg>
	</span>
`;

function isUserTed(username) {
	const u = (username || "").toLowerCase();
	return u === "ted" || u === "nils";
}

// ============================================================
// Scramjet V2 Setup
// ============================================================

let sjController = null;
let connection = null;

const initSWPromise = (async function initSW() {
	try {
		const registration = typeof registerSW === "function" ? await registerSW() : null;

		if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
			await new Promise((res) => {
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
			const ensureTransport = async () => {
				for (let i = 0; i < 40 && !libcurlClient.ready; i++) {
					try { await libcurlClient.init(); } catch (e) { await new Promise((r) => setTimeout(r, 400)); }
				}
			};
			await ensureTransport();
			transportAdapter = {
				ready: true,
				init: async () => {},
				request: async (remote, method, body, headers, signal) => {
					if (!libcurlClient.ready) await ensureTransport();
					// 🛡️ Clash Shield Check
					if (typeof ClashShield !== "undefined") {
						const activeTab = tabs.find((t) => t.id === activeTabId);
						const currentHost = activeTab && activeTab.url ? activeTab.url : "";
						if (ClashShield.shouldBlock(remote, currentHost)) {
							ClashShield.recordBlock(remote, activeTabId);
							return {
								body: new ReadableStream({ start(c) { c.close(); } }),
								status: 204,
								statusText: "Blocked by Clash Shield",
								headers: [["Content-Type", "text/plain"], ["X-Clash-Shield", "Blocked"]]
							};
						}
					}

				let hdrs = headers;
				if (hdrs && typeof hdrs.entries === "function" && !Array.isArray(hdrs)) hdrs = Array.from(hdrs.entries());
				if (Array.isArray(hdrs) && method === "GET" && /^https:\/\/www\.youtube\.com\/(watch|results|shorts|feed|@|@)/.test(String(remote))) {
					const destEntry = hdrs.find((h) => String(h[0]).toLowerCase() === "sec-fetch-dest");
					if (!destEntry || String(destEntry[1]) !== "document") {
						const keep = new Set(["cookie", "user-agent", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-ch-ua-arch", "sec-ch-ua-bitness", "sec-ch-ua-full-version", "sec-ch-ua-full-version-list", "sec-ch-ua-model", "sec-ch-ua-platform-version", "sec-ch-ua-wow64", "sec-ch-ua-form-factors", "referer", "viewport-width", "dpr", "device-memory"]);
						hdrs = hdrs.filter((h) => keep.has(String(h[0]).toLowerCase()));
						hdrs.push(["accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"]);
						hdrs.push(["accept-language", "en-GB,en;q=0.9"]);
						hdrs.push(["sec-fetch-dest", "document"]);
						hdrs.push(["sec-fetch-mode", "navigate"]);
						hdrs.push(["sec-fetch-site", "none"]);
						hdrs.push(["sec-fetch-user", "?1"]);
						hdrs.push(["upgrade-insecure-requests", "1"]);
					}
				}
				try {
					if (/youtube\.com\/watch/.test(String(remote))) {
						const g = (k) => { const e = (hdrs || []).find((h) => String(h[0]).toLowerCase() === k); return e ? String(e[1]).slice(0, 40) : "-"; };
						fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "yt_fix", dest: g("sec-fetch-dest"), mode: g("sec-fetch-mode"), accept: g("accept") }) }).catch(() => {});
					}
				} catch (e) {}
				try {
					const rh = new URL(String(remote));
					const SFX = [".youtube.com", ".googlevideo.com", ".ytimg.com", ".ggpht.com", ".googleapis.com", ".gstatic.com", ".google.com", ".google.co.uk", ".googleusercontent.com", ".googleadservices.com", ".googlesyndication.com", ".google-analytics.com", ".gvt1.com", ".doubleclick.net"];
					const hn = rh.hostname.toLowerCase();
					const matched = SFX.some((s) => hn === s.slice(1) || hn.endsWith(s));
					const CANON_SOCS = "SOCS=CAISFggDEgk5ODk5ODk1NzQaBWVuLUdCIAEaBgiAovHVBg";
					if (matched) {
						const ci = hdrs.findIndex((h) => String(h[0]).toLowerCase() === "cookie");
						if (ci >= 0) {
							const parts = String(hdrs[ci][1]).split(";").map((s) => s.trim()).filter((s) => s && !/^SOCS=/i.test(s));
							parts.push(CANON_SOCS);
							hdrs[ci] = [hdrs[ci][0], parts.join("; ")];
						} else {
							hdrs.push(["cookie", CANON_SOCS]);
						}
					}
					if (hn === "www.youtube.com" || hn === "youtube.com" || hn === "consent.youtube.com") {
						fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "yt_force", host: hn, matched, n: hdrs.length, ct: method }) }).catch(() => {});
					}
				} catch (e) {
					fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "yt_force_err", err: String(e).slice(0, 150) }) }).catch(() => {});
				}
					const resp = await libcurlClient.request(remote, method, body, hdrs, signal);
					try {
						const ru = String(remote);
						if (/consent|set_consent|\/watch|youtube\.com\/(\?|$)|themeRefresh|upgrade_visitor|youtube\.com\/t/.test(ru)) {
							const g = (k) => { const e = (hdrs || []).find((h) => String(h[0]).toLowerCase() === k); return e ? String(e[1]).slice(0, 90) : "-"; };
							const ck = (hdrs || []).find((h) => String(h[0]).toLowerCase() === "cookie");
							const ckv = ck ? String(ck[1]) : "";
							let hd = "";
							try { hd = JSON.stringify((hdrs || []).map((h) => [String(h[0]).toLowerCase(), String(h[1]).slice(0, 80)])).slice(0, 1400); } catch (e) {}
							fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "yt_ck_req", url: ru.slice(0, 130), hasSocs: /(^|;\s*)SOCS=/.test(ckv), socsPos: ckv.indexOf("SOCS="), cklen: ckv.length, ckfull: ckv, ua: g("user-agent"), ref: g("referer"), org: g("origin"), ct: g("content-type") }) }).catch(() => {});
						}
						if (/youtube|consent/.test(ru)) {
							const sc = [];
							let loc = "";
							for (const [k, vals] of Object.entries(resp.headers || {})) {
								if (String(k).toLowerCase() === "set-cookie") {
									for (const v of (Array.isArray(vals) ? vals : [vals])) sc.push(String(v).slice(0, 130));
								}
								if (String(k).toLowerCase() === "location") loc = String(Array.isArray(vals) ? vals[0] : vals).slice(0, 120);
							}
							if (sc.length || (resp.status >= 300 && resp.status < 400)) {
								fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "yt_ck_resp", url: ru.slice(0, 100), status: resp.status, loc, sc }) }).catch(() => {});
							}
						}
					} catch (e) {}
					try {
						if (/^https:\/\/(www\.)?youtube\.com\/(\?|$)|themeRefresh/.test(String(remote)) && resp.status === 200 && resp.body && typeof resp.body.getReader === "function") {
							const reader = resp.body.getReader();
							const dec = new TextDecoder();
							let scanBuf = "";
							let decided = false;
							let scanned = 0;
							const post = (type, extra) => {
								const base = {
									type,
									url: String(remote).slice(0, 110),
									homePos: scanBuf.indexOf("ytInitialData"),
									histPos: scanBuf.indexOf("Your YouTube History is off"),
									beforePos: scanBuf.indexOf("Before you continue to YouTube"),
									rejPos: scanBuf.indexOf("Reject all"),
									scanned
								};
								fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, ...extra }) }).catch(() => {});
							};
							const decide = (tag) => {
								if (decided) return;
								decided = true;
								post("yt_page_kind", { kind: tag });
							};
							resp.body = new ReadableStream({
								start(controller) {
									let ended = false;
									const finish = (tag) => {
										if (ended) return;
										ended = true;
										if (tag && !decided) decide(tag);
										post("yt_page_final", { kind: decided ? "decided" : "none" });
										try { controller.close(); } catch (_) {
											try { controller.error(new Error("closed")); } catch (_) {}
										}
									};
									const pump = () => {
										if (ended) return;
										const timer = setTimeout(() => finish("idle-timeout"), 25000);
										reader.read().then((r) => {
											clearTimeout(timer);
											if (ended) return;
											if (r.done) {
												finish("unknown-end");
												return;
											}
											if (r.value) {
												controller.enqueue(r.value);
												scanned += r.value.length;
												scanBuf += dec.decode(r.value, { stream: true });
												if (scanBuf.length > 2500000) scanBuf = scanBuf.slice(-1500000);
												if (!decided) {
													if (/ytInitialData/.test(scanBuf)) decide("home");
													else if (/cbrd|Reject all|Before you continue|consent\.youtube\.com/.test(scanBuf)) decide("consent");
												}
											}
											pump();
										}).catch((e) => {
											clearTimeout(timer);
											const msg = e ? (e.message || e.name || String(e)) : "?";
											finish("stream-error:" + msg.slice(0, 80));
										});
									};
									pump();
								}
							});
						}
					} catch (e) {}
					const rawPairs = [];
					for (const [k, vals] of Object.entries(resp.headers || {})) {
						if (Array.isArray(vals)) { for (const v of vals) rawPairs.push([k, v]); }
						else rawPairs.push([k, vals]);
					}
					return { body: resp.body, status: resp.status, statusText: resp.statusText, headers: rawPairs };
				},
				connect: (...args) => libcurlClient.connect(...args),
			};
		} catch (e) {
			console.error("[Clash Proxy] libcurl transport init failed:", e);
			fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "transport_error", message: e.message }) }).catch(() => {});
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

				if (typeof sjController.init === "function") {
					await sjController.init();
				}
				console.log("[Clash Proxy] Scramjet Controller active with prefix:", sjController.prefix);
			}
		}

		setStatus("ready", "Ready — Enter a URL or search query");
		return true;
	} catch (err) {
		console.error("[Clash Proxy] Initialization error:", err);
		fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "initSW_error", message: err.message, stack: err.stack }) }).catch(()=>{});
		setStatus("ready", "Ready — Enter a URL or search query");
		return false;
	}
})();

function resolveSearchUrl(input) {
	if (!input) return "";
	const trimmed = input.trim();
	if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("http://localhost") || trimmed.startsWith("http://127.0.0.1")) {
		return trimmed;
	}
	const template = (typeof _CONFIG !== "undefined" && _CONFIG.searchEngine) ? _CONFIG.searchEngine : "https://duckduckgo.com/?q=%s";
	try {
		return new URL(trimmed).toString();
	} catch (e) {}
	try {
		const urlWithProtocol = new URL(`https://${trimmed}`);
		if (urlWithProtocol.hostname.includes(".")) {
			return urlWithProtocol.toString();
		}
	} catch (e) {}
	return template.replace("%s", encodeURIComponent(trimmed));
}

// ============================================================
// Tab Management System
// ============================================================

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let newTabPending = null;

async function createTab(rawInput, isGame = false) {
	tabCounter++;
	const tabId = `tab-${tabCounter}`;

	const tab = {
		id: tabId,
		title: "New Tab",
		url: "",
		favicon: "",
		loading: true,
		iframe: null,
		isNewTab: !rawInput,
		isGame: !!isGame,
	};

	tabs.push(tab);
	activeTabId = tabId;

	if (rawInput) {
		await navigateTab(tabId, rawInput, isGame);
	} else {
		newTabPending = tabId;
		showNewTabPage();
	}

	renderTabs();
	return tab;
}

async function navigateTab(tabId, rawInput, isGame = false) {
	const tab = tabs.find((t) => t.id === tabId);
	if (!tab) return;

	tab.loading = true;
	tab.isNewTab = false;
	newTabPending = null;

	let targetUrl = resolveSearchUrl(rawInput);
	tab.url = targetUrl;
	tab.isGame = !!isGame || targetUrl.includes("/games/") || targetUrl.endsWith(".html");
	tab.title = tab.isGame ? "Playing Game" : (extractDomain(targetUrl) || "Loading...");
	renderTabs();

	if (typeof ClashShield !== "undefined") {
		ClashShield.resetTabCount(tabId);
		updateShieldUI();
	}

	if (tab.iframe) {
		tab.iframe.remove();
		tab.iframe = null;
	}

	const isLocalGame = targetUrl.startsWith("/games/") || 
		(targetUrl.startsWith(location.origin + "/games/")) ||
		(!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://") && targetUrl.includes("game"));

	try {
		const iframe = document.createElement("iframe");
		iframe.className = "proxy-frame";
		iframe.dataset.tabId = tabId;
		iframe.setAttribute("allow", "autoplay; fullscreen; microphone; camera; display-capture; clipboard-read; clipboard-write; encrypted-media; picture-in-picture");

		tab.iframe = iframe;
		framesContainer.appendChild(iframe);
		try { if (typeof injectConsentDismisser === "function") injectConsentDismisser(iframe); } catch (e) {}

		iframe.onload = () => {
			tab.loading = false;
			renderTabs();
			if (typeof ClashShield !== "undefined") {
				ClashShield.applyToFrame(iframe, tab.url);
			}
			if (typeof injectGameSpeedHook === "function") {
				injectGameSpeedHook(iframe.contentWindow, typeof currentGameSpeed !== "undefined" ? currentGameSpeed : 1.0);
			}
			if (typeof injectConsentDismisser === "function") {
				injectConsentDismisser(iframe);
				setTimeout(() => {
					try { injectConsentDismisser(iframe); } catch (e) {}
				}, 1500);
			}
			if (typeof injectActiveUserscripts === "function") {
				injectActiveUserscripts(iframe, tab.url, tab.title);
				// Second-pass injection for Emscripten / WebAssembly loaders
				setTimeout(() => {
					if (iframe && iframe.contentWindow) {
						injectActiveUserscripts(iframe, tab.url, tab.title);
					}
				}, 1000);
			}
		};

		if (isLocalGame) {
			const normalizedGameUrl = targetUrl.startsWith("/") ? targetUrl : "/" + targetUrl.replace(/^https?:\/\/[^\/]+\//, "");
			iframe.src = normalizedGameUrl;
			tab.loading = false;
			tab.title = targetUrl.split("/").pop().replace(".html", "").replace(/cl/g, "");
			renderTabs();

			// Award gameplay XP & update presence
			awardXp("game_play", { gameTitle: tab.title });
			broadcastActivity("playing", `Playing ${tab.title}`);
		} else {
			await initSWPromise;

			let routed = false;
			if (sjController) {
				try {
					const frame = sjController.createFrame(iframe);
					frame.go(targetUrl);
					routed = true;
				} catch (err) {
					console.warn("[Clash Proxy] createFrame initial attempt:", err);
					try {
						if (typeof sjController.wait === "function") await sjController.wait();
						const frame = sjController.createFrame(iframe);
						frame.go(targetUrl);
						routed = true;
					} catch (e2) {
						console.error("[Clash Proxy] createFrame retry failed:", e2);
					}
				}
			}

			if (!routed) {
				iframe.src = "/scram/service/" + encodeURIComponent(targetUrl);
			}

			tab.loading = false;
			tab.title = extractDomain(targetUrl);
			renderTabs();

			// Award browse XP & update presence
			awardXp("browse", { domain: extractDomain(targetUrl) });
			broadcastActivity("browsing", `Browsing ${extractDomain(targetUrl)}`);
		}

		renderTabs();
		updateNavUrl(rawInput);
		showBrowserView();
		showActiveFrame();
		updateShieldUI();
		updateBookmarkStarForActiveTab();

	} catch (err) {
		console.error("[Clash Proxy] Navigation error:", err);
		tab.loading = false;
		tab.title = extractDomain(targetUrl) || "Web Page";
		renderTabs();
		updateShieldUI();
		updateBookmarkStarForActiveTab();
	}
}

function switchToTab(tabId) {
	activeTabId = tabId;
	const tab = tabs.find((t) => t.id === tabId);
	renderTabs();
	updateShieldUI();
	updateBookmarkStarForActiveTab();

	if (tab && tab.isNewTab) {
		newTabPending = tabId;
		showNewTabPage();
	} else if (tab && tab.url) {
		newTabPending = null;
		showBrowserView();
		showActiveFrame();
		updateNavUrl(tab.url);

		if (tab.isGame) {
			broadcastActivity("playing", `Playing ${tab.title}`);
		} else {
			broadcastActivity("browsing", `Browsing ${extractDomain(tab.url)}`);
		}
	}
}

function closeTab(tabId) {
	const idx = tabs.findIndex((t) => t.id === tabId);
	if (idx === -1) return;

	const tab = tabs[idx];
	if (tab.iframe) {
		silenceFrame(tab.iframe);
		tab.iframe.remove();
	}
	tabs.splice(idx, 1);

	if (typeof ClashShield !== "undefined") {
		ClashShield.removeTab(tabId);
	}
	updateShieldUI();
	updateBookmarkStarForActiveTab();

	if (tabs.length === 0) {
		showLandingPage();
		broadcastActivity("online", "In Lobby");
	} else {
		if (activeTabId === tabId) {
			const nextTab = tabs[Math.min(idx, tabs.length - 1)];
			switchToTab(nextTab.id);
		} else {
			renderTabs();
		}
	}
}

function renderTabs() {
	tabList.innerHTML = "";
	tabs.forEach((tab) => {
		const tabEl = document.createElement("div");
		tabEl.className = `tab ${tab.id === activeTabId ? "active" : ""}`;
		tabEl.dataset.tabId = tab.id;

		tabEl.innerHTML = `
			<div class="tab-favicon">
				${tab.loading ? `<div class="tab-spinner"></div>` : `<span class="tab-icon">${tab.isGame ? "🕹️" : "🌐"}</span>`}
			</div>
			<span class="tab-title">${escapeHtml(tab.title || "New Tab")}</span>
			<button class="tab-close" aria-label="Close tab" title="Close">&times;</button>
		`;

		tabEl.addEventListener("click", (e) => {
			if (e.target.closest(".tab-close")) {
				e.stopPropagation();
				closeTab(tab.id);
			} else {
				switchToTab(tab.id);
			}
		});

		tabList.appendChild(tabEl);
	});
}

const silencedMedia = new WeakMap();
let mediaGuardStarted = false;

function silenceFrame(f) {
	try {
		const doc = f && f.contentDocument;
		if (!doc) return;
		doc.querySelectorAll("video,audio").forEach((m) => {
			if (!silencedMedia.has(m)) silencedMedia.set(m, m.muted);
			try { m.muted = true; } catch (e) {}
			try { m.pause(); } catch (e) {}
		});
	} catch (e) {}
}

function unsilenceFrame(f) {
	try {
		const doc = f && f.contentDocument;
		if (!doc) return;
		doc.querySelectorAll("video,audio").forEach((m) => {
			if (silencedMedia.has(m)) {
				try { m.muted = silencedMedia.get(m); } catch (e) {}
				silencedMedia.delete(m);
			}
		});
	} catch (e) {}
}

function startMediaGuard() {
	if (mediaGuardStarted) return;
	mediaGuardStarted = true;
	setInterval(() => {
		try {
			if (!framesContainer || !framesContainer.querySelectorAll) return;
			const containerHidden = framesContainer.classList.contains("hidden");
			const active = containerHidden ? null : framesContainer.querySelector("iframe.active");
			framesContainer.querySelectorAll("iframe").forEach((f) => {
				if (f === active) return;
				silenceFrame(f);
			});
		} catch (e) {}
	}, 1000);
}

function showActiveFrame() {
	const iframes = framesContainer.querySelectorAll("iframe");
	iframes.forEach((f) => {
		const isActive = f.dataset.tabId === activeTabId;
		f.classList.toggle("active", isActive);
		if (isActive) unsilenceFrame(f);
	});
	startMediaGuard();

	const activeTab = tabs.find(t => t.id === activeTabId);
	if (gameControlsBar) {
		const isGameTab = activeTab && (activeTab.url?.includes("/games/") || activeTab.url?.endsWith(".html") || activeTab.isGame);
		gameControlsBar.classList.toggle("hidden", !isGameTab);
	}
}

function showBrowserView() {
	mainContent.classList.add("hidden");
	browserChrome.classList.remove("hidden");
	framesContainer.classList.remove("hidden");
}

function showNewTabPage() {
	browserChrome.classList.remove("hidden");
	framesContainer.classList.remove("hidden");
	mainContent.classList.remove("hidden");
	mainContent.classList.add("new-tab-mode");

	const iframes = framesContainer.querySelectorAll("iframe");
	iframes.forEach((f) => {
		f.classList.remove("active");
		silenceFrame(f);
	});
	startMediaGuard();

	if (gameControlsBar) gameControlsBar.classList.add("hidden");

	navUrlInput.value = "";
	setTimeout(() => proxyInput.focus(), 50);
}

function showLandingPage() {
	mainContent.classList.remove("hidden");
	mainContent.classList.remove("new-tab-mode");
	browserChrome.classList.add("hidden");
	framesContainer.classList.add("hidden");
	if (gameControlsBar) gameControlsBar.classList.add("hidden");
	proxyInput.value = "";
	activeTabId = null;
	newTabPending = null;
	tabs = [];
	framesContainer.querySelectorAll("iframe").forEach(silenceFrame);
	renderTabs();
	setTimeout(() => proxyInput.focus(), 50);
}

// ============================================================
// About:Blank Cloaking & Game Controls
// ============================================================

function openAboutBlank(urlToOpen) {
	try {
		const win = window.open("about:blank", "_blank");
		if (!win || win.closed) {
			showToast({ icon: "⚠️", title: "Pop-up Blocked", message: "Please allow pop-ups for this site to open in about:blank." });
			return;
		}

		win.document.title = "Google Drive";
		const doc = win.document;
		doc.body.style.margin = "0";
		doc.body.style.padding = "0";
		doc.body.style.height = "100vh";
		doc.body.style.overflow = "hidden";
		doc.body.style.background = "#000";

		const iframe = doc.createElement("iframe");
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		iframe.style.border = "none";
		iframe.style.outline = "none";
		// Apply the Chromebook Optimizer resolution inside about:blank popups too
		// (they have no proxy stylesheet, so do the low-res box + upscale inline).
		try {
			const perfRes = parseFloat(JSON.parse(localStorage.getItem("clash_perf") || "{}").resolution) || 1;
			if (perfRes < 1) {
				iframe.style.width = 100 * perfRes + "%";
				iframe.style.height = 100 * perfRes + "%";
				iframe.style.transform = "scale(" + 1 / perfRes + ")";
				iframe.style.transformOrigin = "0 0";
			}
		} catch (e) {}
		iframe.setAttribute("allow", "autoplay; fullscreen; microphone; camera; display-capture; clipboard-read; clipboard-write; encrypted-media; picture-in-picture");

		let target = urlToOpen || location.href;
		if (target.startsWith("/")) {
			target = location.origin + target;
		} else if (!target.includes("://")) {
			target = location.origin + "/" + target;
		}

		iframe.src = target;
		doc.body.appendChild(iframe);
	} catch (err) {
		console.error("Failed to open about:blank:", err);
	}
}

// Nav bar controls
if (navAboutblankBtn) {
	navAboutblankBtn.addEventListener("click", () => {
		const activeTab = tabs.find(t => t.id === activeTabId);
		const targetUrl = (activeTab ? activeTab.url : null) || navUrlInput.value;
		if (targetUrl) openAboutBlank(targetUrl);
	});
}

if (gameCtrlBack) {
	gameCtrlBack.addEventListener("click", () => {
		if (activeTabId) closeTab(activeTabId);
		showLandingPage();
		const gamesLink = document.getElementById("nav-games");
		if (gamesLink) gamesLink.click();
	});
}

if (gameCtrlFullscreen) {
	gameCtrlFullscreen.addEventListener("click", () => {
		const activeTab = tabs.find(t => t.id === activeTabId);
		if (activeTab && activeTab.iframe) {
			if (activeTab.iframe.requestFullscreen) {
				activeTab.iframe.requestFullscreen().catch(() => toggleFullscreen());
			} else {
				toggleFullscreen();
			}
		} else {
			toggleFullscreen();
		}
	});
}

if (gameCtrlAboutblank) {
	gameCtrlAboutblank.addEventListener("click", () => {
		const activeTab = tabs.find(t => t.id === activeTabId);
		if (activeTab && activeTab.url) openAboutBlank(activeTab.url);
	});
}

if (navBackBtn) {
	navBackBtn.addEventListener("click", () => {
		const tab = tabs.find((t) => t.id === activeTabId);
		if (tab && tab.iframe && tab.iframe.contentWindow) {
			try { tab.iframe.contentWindow.history.back(); } catch (e) {}
		}
	});
}

if (navForwardBtn) {
	navForwardBtn.addEventListener("click", () => {
		const tab = tabs.find((t) => t.id === activeTabId);
		if (tab && tab.iframe && tab.iframe.contentWindow) {
			try { tab.iframe.contentWindow.history.forward(); } catch (e) {}
		}
	});
}

if (navRefreshBtn) {
	navRefreshBtn.addEventListener("click", () => {
		const tab = tabs.find((t) => t.id === activeTabId);
		if (tab && tab.iframe && tab.iframe.contentWindow) {
			try { tab.iframe.contentWindow.location.reload(); } catch (e) {}
		}
	});
}

if (navHomeBtn) {
	navHomeBtn.addEventListener("click", showLandingPage);
}

if (navUrlInput) {
	navUrlInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const input = navUrlInput.value.trim();
			if (!input) return;
			if (activeTabId) navigateTab(activeTabId, input);
			else createTab(input);
		}
	});
}

if (newTabBtn) newTabBtn.addEventListener("click", () => createTab());
if (navSidebarBtn) navSidebarBtn.addEventListener("click", openSidebar);

function updateNavUrl(url) {
	try {
		const parsed = new URL(url);
		navUrlInput.value = parsed.hostname + parsed.pathname + parsed.search;
	} catch {
		navUrlInput.value = url;
	}
}

// Fullscreen
if (navFullscreenBtn) navFullscreenBtn.addEventListener("click", toggleFullscreen);

function toggleFullscreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().catch(() => {});
	} else {
		document.exitFullscreen().catch(() => {});
	}
}

document.addEventListener("fullscreenchange", () => {
	const isFullscreen = !!document.fullscreenElement;
	fullscreenIconEnter.style.display = isFullscreen ? "none" : "";
	fullscreenIconExit.style.display = isFullscreen ? "" : "none";
});

// Proxy form submit
if (proxyInput) {
	proxyInput.addEventListener("keydown", async (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			hideError();
			const input = proxyInput.value.trim();
			if (!input) return;

			try {
				if (newTabPending) {
					await navigateTab(newTabPending, input);
					mainContent.classList.remove("new-tab-mode");
				} else {
					await createTab(input);
				}
			} catch (err) {
				console.error("[Clash Proxy] Error:", err);
				showError(err.message || "Failed to load. Please try again.");
			}
		}
	});
}

if (proxyForm) {
	proxyForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		hideError();
		const input = proxyInput ? proxyInput.value.trim() : "";
		if (!input) return;

		try {
			if (newTabPending) {
				await navigateTab(newTabPending, input);
				mainContent.classList.remove("new-tab-mode");
			} else {
				await createTab(input);
			}
		} catch (err) {
			console.error("[Clash Proxy] Error:", err);
			showError(err.message || "Failed to load. Please try again.");
		}
	});

	const submitBtn = document.getElementById("proxy-submit-btn");
	if (submitBtn) {
		submitBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			hideError();
			const input = proxyInput ? proxyInput.value.trim() : "";
			if (!input) return;
			try {
				if (newTabPending) {
					await navigateTab(newTabPending, input);
					mainContent.classList.remove("new-tab-mode");
				} else {
					await createTab(input);
				}
			} catch (err) {
				console.error("[Clash Proxy] Error:", err);
				showError(err.message || "Failed to load. Please try again.");
			}
		});
	}
}

// ============================================================
// User Authentication & Session System
// ============================================================

let currentUser = null;
let authToken = localStorage.getItem("clash_jwt_token") || null;

async function initAuth() {
	if (!authToken) {
		renderGuestHeader();
		renderProfilePage();
		return;
	}

	try {
		const res = await fetch("/api/auth/me", {
			headers: { Authorization: `Bearer ${authToken}` }
		});
		const data = await res.json();
		if (res.ok && data.success) {
			currentUser = data.user;
	window.__myRankCache = null;
			renderUserHeader();
			renderProfilePage();
			connectPresenceSocket();
			applyUserSettings(currentUser.settings);
			loadBookmarks();
			loadUnreadCounts();
			if (typeof loadCustomScripts === "function") loadCustomScripts();
		} else {
			logout();
		}
	} catch (err) {
		console.error("Auth init error:", err);
		renderGuestHeader();
		renderProfilePage();
	}
}

function renderUserHeader() {
	if (!userHeaderWidget) return;
	if (!currentUser) {
		renderGuestHeader();
		return;
	}

	const isTed = isUserTed(currentUser.username);
	const frameClass = (currentUser.equippedFrame && currentUser.equippedFrame !== "none")
		? currentUser.equippedFrame
		: (isTed ? "frame-sovereign-gold" : "");
	const nameThemeClass = (currentUser.equippedNameTheme && currentUser.equippedNameTheme !== "none")
		? currentUser.equippedNameTheme
		: (isTed ? "ted-vip-name" : "");

	userHeaderWidget.innerHTML = `
		<div id="user-header-pill" class="user-pill ${isTed ? 'ted-user-pill' : ''}" title="View Profile">
			<div class="avatar-frame-container ${frameClass}">
				<div class="ted-avatar-wrap">
					<div class="user-pill-avatar ${escapeHtml(currentUser.avatar_url || currentUser.avatarUrl || 'avatar-1')}"></div>
					${isTed ? TILTED_CROWN_SVG : ''}
				</div>
			</div>
			<div class="user-pill-info">
				<span class="user-pill-name ${nameThemeClass}">${escapeHtml(currentUser.display_name || currentUser.displayName || currentUser.username)}</span>
				<div class="user-pill-sub">
					<span class="user-pill-badge ${isTed ? 'admin-root-badge' : ''}">${isTed ? 'DEV' : 'Lv. ' + (currentUser.level || 1)}</span>
					<span>${(currentUser.xp || 0).toLocaleString()} XP</span>
				</div>
			</div>
		</div>
	`;

	// Reveal Owner Panel sidebar link (separate localhost:8081 server, owner PC only) for privileged users
	if (navOwnerPanel) {
		navOwnerPanel.style.display = (isTed || currentUser.role === "admin") ? "" : "none";
	}

	// Rank chip → opens YOUR panel (Owner → control panel, Game Tester → testing panel)
	const rankChip = userHeaderWidget.querySelector(".user-pill-badge");
	if (rankChip) {
		rankChip.style.cursor = "pointer";
		rankChip.title = "Open your panel";
		const applyRankName = (d) => { if (d && d.rankName) rankChip.textContent = d.rankName; };
		applyRankName(window.__myRankCache);
		if (authToken) {
			// Always revalidate: role/rank may have changed since the last render
			// (promotion, demotion, Owner Mode, database reset).
			fetch("/api/me/ranks", { headers: { Authorization: "Bearer " + authToken } })
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => { if (d) { window.__myRankCache = d; applyRankName(d); } })
				.catch(() => {});
		}
		if (!rankChip.dataset.bound) {
			rankChip.dataset.bound = "1";
			rankChip.addEventListener("click", async (e) => {
				e.stopPropagation();
				const tokenQ = "?token=" + encodeURIComponent(authToken || "");
				if (isTed || currentUser.role === "admin") { location.href = "/panel/" + tokenQ; return; }
				let d = null;
				try {
					const r = await fetch("/api/me/ranks", { headers: { Authorization: "Bearer " + authToken } });
					if (r.ok) { d = await r.json(); window.__myRankCache = d; applyRankName(d); }
				} catch {}
				d = d || window.__myRankCache;
				if (d && (d.privileges || []).includes("game-testing")) { location.href = "/panel/testing/" + tokenQ; return; }
				document.getElementById("nav-profile")?.click();
			});
		}
	}

	const pill = document.getElementById("user-header-pill");
	if (pill) {
		pill.addEventListener("click", () => {
			const profileNav = document.getElementById("nav-profile");
			if (profileNav) profileNav.click();
		});
	}
}

function renderGuestHeader() {
	if (!userHeaderWidget) return;
	userHeaderWidget.innerHTML = `
		<button id="header-auth-btn" class="header-login-btn">Sign In / Register</button>
	`;
	const navOwnerPanelEl = document.getElementById("nav-owner-panel");
	if (navOwnerPanelEl) navOwnerPanelEl.style.display = "none";
	const btn = document.getElementById("header-auth-btn");
	if (btn) btn.addEventListener("click", () => openAuthModal("login"));
}

async function loginUser(username, password) {
	try {
		if (loginErrorMsg) loginErrorMsg.classList.add("hidden");
		const cleanUser = String(username || "").trim();
		const cleanPass = String(password || "");
		if (!cleanUser || !cleanPass) {
			throw new Error("Please enter both username and password.");
		}

		const res = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: cleanUser, password: cleanPass })
		});
		const data = await res.json();
		if (!res.ok) {
			throw new Error(data.error || "Login failed");
		}

		authToken = data.token;
		localStorage.setItem("clash_jwt_token", authToken);
		currentUser = data.user;
	window.__myRankCache = null;

		closeAuthModal();
		renderUserHeader();
		renderProfilePage();
		connectPresenceSocket();
		applyUserSettings(currentUser.settings);
		loadBookmarks();
		loadUnreadCounts();
		if (typeof loadCustomScripts === "function") loadCustomScripts();
		showToast({ icon: "👋", title: "Welcome back!", message: `Logged in as ${currentUser.display_name || currentUser.displayName || currentUser.username}` });
	} catch (err) {
		if (loginErrorMsg) {
			loginErrorMsg.textContent = err.message;
			loginErrorMsg.classList.remove("hidden");
		}
		showToast({ icon: "⚠️", title: "Sign In Error", message: err.message });
	}
}

async function registerUser(username, password, displayName) {
	try {
		if (registerErrorMsg) registerErrorMsg.classList.add("hidden");
		const cleanUser = String(username || "").trim();
		const cleanPass = String(password || "");
		const cleanDisplay = String(displayName || "").trim();
		if (!cleanUser || !cleanPass) {
			throw new Error("Username and password are required.");
		}

		const res = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: cleanUser, password: cleanPass, displayName: cleanDisplay, ownerKey: (document.getElementById("reg-ownerkey")?.value || "").trim() })
		});
		const data = await res.json();
		if (!res.ok) {
			throw new Error(data.error || "Registration failed");
		}

		authToken = data.token;
		localStorage.setItem("clash_jwt_token", authToken);
		currentUser = data.user;
	window.__myRankCache = null;

		closeAuthModal();
		renderUserHeader();
		renderProfilePage();
		connectPresenceSocket();
		applyUserSettings(currentUser.settings);
		loadBookmarks();
		loadUnreadCounts();
		if (typeof loadCustomScripts === "function") loadCustomScripts();
		showToast({ icon: "🎉", title: "Welcome to Clash Proxy!", message: `Account ready for ${currentUser.display_name || currentUser.displayName || currentUser.username}` });
	} catch (err) {
		if (registerErrorMsg) {
			registerErrorMsg.textContent = err.message;
			registerErrorMsg.classList.remove("hidden");
		}
		showToast({ icon: "⚠️", title: "Account Error", message: err.message });
	}
}

function logout() {
	authToken = null;
	currentUser = null;
	window.__myRankCache = null;
	localStorage.removeItem("clash_jwt_token");
	if (presenceWs) {
		presenceWs.close();
		presenceWs = null;
	}
	closeChatDrawer();
	renderGuestHeader();
	renderProfilePage();
	loadBookmarks();
	showToast({ icon: "🚪", title: "Logged out", message: "You are now in guest browsing mode." });
}

// ============================================================
// Real-Time Presence WebSocket Engine
// ============================================================

let presenceWs = null;
let pingInterval = null;
let friendPresenceMap = new Map();

function connectPresenceSocket() {
	if (!authToken || presenceWs) return;

	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	const wsUrl = `${protocol}//${location.host}/ws/presence`;

	try {
		presenceWs = new WebSocket(wsUrl);

		presenceWs.onopen = () => {
			presenceWs.send(JSON.stringify({ type: "auth", token: authToken }));
			if (pingInterval) clearInterval(pingInterval);
			pingInterval = setInterval(() => {
				if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
					presenceWs.send(JSON.stringify({ type: "ping" }));
				}
			}, 30000);
		};

		presenceWs.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data);
				handlePresenceMessage(data);
			} catch (err) {
				console.error("WS message parse error:", err);
			}
		};

		presenceWs.onclose = () => {
			presenceWs = null;
			if (pingInterval) clearInterval(pingInterval);
			if (authToken) setTimeout(connectPresenceSocket, 5000);
		};
	} catch (err) {
		console.error("Presence WS connection failed:", err);
	}
}

function handlePresenceMessage(data) {
	if (data.type === "friend_presence") {
		const { presence } = data;
		friendPresenceMap.set(presence.userId, presence);
		renderFriendsLists();
		updateChatPagePresenceUI();
	} else if (data.type === "friends_presence_batch") {
		for (const [id, p] of Object.entries(data.statuses)) {
			friendPresenceMap.set(Number(id), p);
		}
		renderFriendsLists();
		updateChatPagePresenceUI();
	} else if (data.type === "friend_request") {
		showToast({
			icon: "👋",
			title: "New Friend Request",
			message: `@${data.from.username} sent you a friend request!`,
			actionText: "View",
			onAction: () => {
				const fNav = document.getElementById("nav-friends");
				if (fNav) fNav.click();
			}
		});
		loadFriends();
	} else if (data.type === "friend_accepted") {
		showToast({
			icon: "🤝",
			title: "Friend Request Accepted",
			message: `@${data.user.username} is now your friend!`,
			type: "xp-gain"
		});
		loadFriends();
	} else if (data.type === "game_invite") {
		showToast({
			icon: "🎮",
			title: "Game Invitation!",
			message: `${data.from.displayName} invited you to play ${data.gameTitle}!`,
			actionText: "Play Now",
			onAction: () => {
				if (data.gameUrl) createTab(data.gameUrl, true);
			}
		});
	} else if (data.type === "chat_message") {
		const msg = data.message;
		// If currently viewing active conversation on Chat Page
		if (activeChatPageFriend && activeChatPageFriend.id === msg.sender_id) {
			renderChatPageMessageItem(msg, false, activeChatPageFriend);
			sendWsChatRead(msg.sender_id);
			fetch(`/api/chat/${msg.sender_id}/read`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } }).catch(() => {});
		} else if (activeChatFriend && activeChatFriend.id === msg.sender_id) {
			appendChatMessage(msg, false);
			sendWsChatRead(msg.sender_id);
		} else {
			unreadChatCounts[msg.sender_id] = (unreadChatCounts[msg.sender_id] || 0) + 1;
			renderFriendsLists();
			showToast({
				icon: "💬",
				title: `Message from ${msg.sender?.displayName || msg.sender?.username || 'Friend'}`,
				message: msg.content.length > 45 ? msg.content.slice(0, 45) + "..." : msg.content,
				actionText: "Reply",
				onAction: () => {
					navigateToChatPage(msg.sender_id);
				}
			});
		}
		updateConversationsSnippet(msg);
		loadUnreadCounts();
	} else if (data.type === "chat_sent") {
		const msg = data.message;
		if (activeChatPageFriend && activeChatPageFriend.id === msg.receiver_id) {
			renderChatPageMessageItem(msg, true, activeChatPageFriend);
		}
		if (activeChatFriend && activeChatFriend.id === msg.receiver_id) {
			appendChatMessage(msg, true);
		}
		updateConversationsSnippet(msg);
	} else if (data.type === "chat_read_receipt") {
		if (activeChatPageFriend && activeChatPageFriend.id === data.readBy) {
			document.querySelectorAll("#chat-page-messages .chat-read-receipt").forEach((el) => {
				el.textContent = "✓✓";
				el.style.color = "#00f0ff";
			});
		}
	} else if (data.type === "chat_typing") {
		if (activeChatPageFriend && activeChatPageFriend.id === data.senderId) {
			if (data.isTyping) {
				if (chatPageTypingText) chatPageTypingText.textContent = `${activeChatPageFriend.displayName || activeChatPageFriend.username} is typing...`;
				if (chatPageTyping) chatPageTyping.classList.remove("hidden");
				if (chatPageMessages) chatPageMessages.scrollTop = chatPageMessages.scrollHeight;
			} else {
				if (chatPageTyping) chatPageTyping.classList.add("hidden");
			}
		}
	} else if (data.type === "lounge_room_update") {
		handleLoungeRoomUpdate(data.room);
	} else if (data.type === "lounge_user_joined") {
		handleLoungeUserJoined(data);
	} else if (data.type === "lounge_user_left") {
		handleLoungeUserLeft(data);
	} else if (data.type === "lounge_message") {
		appendLoungeChatMessage(data.message);
	} else if (data.type === "lounge_game_changed") {
		handleLoungeGameChanged(data);
	} else if (data.type === "lounge_left") {
		resetLoungeToLobby();
	} else if (data.type === "lounge_rooms_list") {
		renderLoungeRoomsGrid(data.rooms);
	} else if (data.type === "system_announcement") {
		showToast({
			icon: "👑",
			title: `SERVER BROADCAST — @${data.sender || 'TED'}`,
			message: data.message,
			type: "system-announcement-banner",
			duration: 10000
		});
	}
}

function broadcastActivity(status, activity) {
	if (!presenceWs || presenceWs.readyState !== WebSocket.OPEN) return;
	if (currentUser && currentUser.settings && currentUser.settings.ghostMode) return;
	presenceWs.send(JSON.stringify({ type: "activity", status, activity }));
}

function sendGameInvite(targetUserId, gameUrl, gameTitle) {
	if (!presenceWs || presenceWs.readyState !== WebSocket.OPEN) {
		showToast({ icon: "⚠️", title: "Offline", message: "Must be connected to invite friends." });
		return;
	}
	presenceWs.send(JSON.stringify({ type: "invite", targetUserId, gameUrl, gameTitle }));
	showToast({ icon: "🚀", title: "Invite Sent", message: `Game invite sent to friend!` });
}

// ============================================================
// Gamification & XP System
// ============================================================

async function awardXp(type, details) {
	if (!authToken || (currentUser && currentUser.settings?.ghostMode)) return;

	try {
		const res = await fetch("/api/levels/xp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${authToken}`
			},
			body: JSON.stringify({ type, details })
		});
		const data = await res.json();

		if (res.ok && data.success) {
			currentUser.xp = data.xp;
			currentUser.level = data.level;
			renderUserHeader();
			renderProfilePage();

			if (data.leveledUp) {
				showToast({
					icon: "👑",
					title: "LEVEL UP!",
					message: `Congratulations! You reached Level ${data.level}!`,
					type: "level-up"
				});
			} else if (data.earned) {
				showToast({
					icon: "✨",
					title: `+${data.earned} XP`,
					message: data.reason,
					type: "xp-gain",
					duration: 3000
				});
			}
		}
	} catch (err) {
		console.error("Award XP error:", err);
	}
}

// Periodic XP grant for active gameplay
setInterval(() => {
	const activeTab = tabs.find(t => t.id === activeTabId);
	if (activeTab && activeTab.isGame && !document.hidden) {
		awardXp("game_play", { gameTitle: activeTab.title });
	}
}, 120000);

// ============================================================
// Profile View Controller
// ============================================================

function getRankTitle(level) {
	if (level >= 10) return "Proxy Master 👑";
	if (level >= 7) return "Shadow Runner ⚡";
	if (level >= 5) return "Cyber Vanguard 🛡️";
	if (level >= 3) return "Arcade Scout 🕹️";
	return "Novice Navigator 🌐";
}

async function renderProfilePage() {
	if (!profileDisplayName) return;

	if (!currentUser) {
		profileAvatarDisplay.className = "profile-avatar avatar-1";
		profileDisplayName.textContent = "Guest User";
		profileLevelBadge.textContent = "Lv. 1";
		profileRankTitle.textContent = "Novice Navigator";
		profileUsernameTag.textContent = "@guest";
		profileBio.textContent = "Sign in to save your progression, connect with friends, and unlock achievements.";
		
		if (editProfileBtn) editProfileBtn.classList.add("hidden");
		if (logoutBtn) logoutBtn.classList.add("hidden");
		if (profileLoginBtn) profileLoginBtn.classList.remove("hidden");

		xpCurrentDisplay.textContent = "0";
		xpNextDisplay.textContent = "100";
		xpBarFill.style.width = "0%";
		
		statGamesPlayed.textContent = "0";
		statSitesVisited.textContent = "0";
		statLoginStreak.textContent = "1";
		statBadgesUnlocked.textContent = "0 / 8";

		loadBadges();
		return;
	}

	const isTed = isUserTed(currentUser.username);
	const frameClass = (currentUser.equippedFrame && currentUser.equippedFrame !== "none")
		? currentUser.equippedFrame
		: (isTed ? "frame-sovereign-gold" : "");
	const nameThemeClass = (currentUser.equippedNameTheme && currentUser.equippedNameTheme !== "none")
		? currentUser.equippedNameTheme
		: (isTed ? "ted-vip-name" : "");

	profileAvatarDisplay.className = `profile-avatar ${escapeHtml(currentUser.avatar_url || currentUser.avatarUrl || 'avatar-1')}`;

	// Add or remove tilted crown in profile avatar wrapper
	const avatarWrapper = profileAvatarDisplay.closest(".profile-avatar-wrapper");
	if (avatarWrapper) {
		avatarWrapper.className = `profile-avatar-wrapper avatar-frame-container ${frameClass}`;
		const existingCrown = avatarWrapper.querySelector(".ted-tilted-crown");
		if (isTed) {
			if (!existingCrown) avatarWrapper.insertAdjacentHTML("beforeend", TILTED_CROWN_SVG);
		} else if (existingCrown) {
			existingCrown.remove();
		}
	}

	profileDisplayName.textContent = currentUser.display_name || currentUser.displayName || currentUser.username;
	profileDisplayName.className = `profile-display-name ${nameThemeClass}`;
	if (isTed) {
		profileLevelBadge.className = "level-badge admin-root-badge";
		profileLevelBadge.textContent = "DEV";
		profileRankTitle.innerHTML = currentUser.custom_tag ? `<span class="ted-crown-tag">${escapeHtml(currentUser.custom_tag)}</span>` : "👑 FOUNDER";
	} else {
		profileDisplayName.classList.remove("ted-vip-name");
		profileLevelBadge.className = "level-badge";
		profileLevelBadge.textContent = `Lv. ${currentUser.level || 1}`;
		profileRankTitle.innerHTML = currentUser.custom_tag ? `<span class="ted-crown-tag">${escapeHtml(currentUser.custom_tag)}</span>` : escapeHtml(getRankTitle(currentUser.level || 1));
	}

	profileUsernameTag.textContent = `@${currentUser.username}`;
	profileBio.textContent = currentUser.bio || "Cruising the web with Clash Proxy.";

	if (editProfileBtn) editProfileBtn.classList.remove("hidden");
	if (logoutBtn) logoutBtn.classList.remove("hidden");
	if (profileLoginBtn) profileLoginBtn.classList.add("hidden");

	// XP calculations
	const currentLevelBase = Math.floor(100 * Math.pow((currentUser.level || 1) - 1, 1.5));
	const nextLevelTarget = Math.floor(100 * Math.pow(currentUser.level || 1, 1.5));
	const xpInLevel = (currentUser.xp || 0) - currentLevelBase;
	const xpNeededInLevel = nextLevelTarget - currentLevelBase;
	const percentage = Math.min(100, Math.max(0, (xpInLevel / xpNeededInLevel) * 100));

	xpCurrentDisplay.textContent = currentUser.xp || 0;
	xpNextDisplay.textContent = nextLevelTarget;
	xpBarFill.style.width = `${percentage}%`;

	// Fetch Stats
	try {
		const res = await fetch("/api/profile/stats", {
			headers: { Authorization: `Bearer ${authToken}` }
		});
		const data = await res.json();
		if (res.ok && data.success) {
			statGamesPlayed.textContent = data.stats.gamesPlayed;
			statSitesVisited.textContent = data.stats.sitesVisited;
			statLoginStreak.textContent = currentUser.streak_days || 1;
			statBadgesUnlocked.textContent = `${data.stats.achievementsCount} / ${data.stats.totalBadgesAvailable}`;
		}
	} catch (e) {}

	loadBadges();
}

async function loadBadges() {
	if (!badgesGrid) return;
	try {
		const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
		const res = await fetch("/api/levels/badges", { headers });
		const data = await res.json();
		if (res.ok && data.success) {
			badgesGrid.innerHTML = "";
			data.badges.forEach(b => {
				const badgeEl = document.createElement("div");
				badgeEl.className = `badge-item ${b.unlocked ? "unlocked" : "locked"}`;
				badgeEl.innerHTML = `
					<div class="badge-icon">${b.icon}</div>
					<div class="badge-info">
						<span class="badge-name">${escapeHtml(b.name)}</span>
						<span class="badge-desc">${escapeHtml(b.description)}</span>
					</div>
				`;
				badgesGrid.appendChild(badgeEl);
			});
		}
	} catch (e) {}
}

if (editProfileBtn) editProfileBtn.addEventListener("click", openProfileModal);
if (changeAvatarBtn) changeAvatarBtn.addEventListener("click", openProfileModal);
if (profileLoginBtn) profileLoginBtn.addEventListener("click", () => openAuthModal("login"));
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// ============================================================
// Friends Management Controller
// ============================================================

let currentFriendsData = { friends: [], incoming: [], outgoing: [] };

async function loadFriends() {
	if (!authToken) {
		renderFriendsLoggedOut();
		return;
	}

	try {
		const res = await fetch("/api/friends", {
			headers: { Authorization: `Bearer ${authToken}` }
		});
		const data = await res.json();
		if (res.ok && data.success) {
			currentFriendsData = data;
			renderFriendsLists();

			// Update badge
			if (friendsBadge) {
				const pendingLen = data.incoming.length;
				if (pendingLen > 0) {
					friendsBadge.textContent = pendingLen;
					friendsBadge.classList.remove("hidden");
				} else {
					friendsBadge.classList.add("hidden");
				}
			}
		}
	} catch (err) {
		console.error("Load friends error:", err);
	}
}

function renderFriendsLoggedOut() {
	if (onlineFriendsList) {
		onlineFriendsList.innerHTML = `<div class="friends-empty-msg">Please <a href="#" id="friends-login-link" style="color:var(--accent-primary)">sign in</a> to add friends and see live presence.</div>`;
		const link = document.getElementById("friends-login-link");
		if (link) link.addEventListener("click", (e) => { e.preventDefault(); openAuthModal("login"); });
	}
	if (offlineFriendsList) offlineFriendsList.innerHTML = "";
	if (pendingRequestsSection) pendingRequestsSection.classList.add("hidden");
}

function renderFriendsLists() {
	if (!authToken) return;

	// 1. Pending Requests
	if (pendingRequestsSection && pendingRequestsList) {
		if (currentFriendsData.incoming.length > 0) {
			pendingRequestsSection.classList.remove("hidden");
			pendingCount.textContent = currentFriendsData.incoming.length;
			pendingRequestsList.innerHTML = "";
			currentFriendsData.incoming.forEach(req => {
				const card = document.createElement("div");
				card.className = "friend-req-card";
				card.innerHTML = `
					<div class="friend-info">
						<span class="friend-display-name">${escapeHtml(req.display_name || req.username)}</span>
						<span class="friend-activity">@${escapeHtml(req.username)} • Lv. ${req.level || 1}</span>
					</div>
					<div class="friend-actions">
						<button class="friend-btn btn-success" data-action="accept" data-id="${req.friendship_id}">Accept</button>
						<button class="friend-btn btn-danger" data-action="decline" data-id="${req.friendship_id}">Decline</button>
					</div>
				`;
				card.querySelectorAll("button").forEach(btn => {
					btn.addEventListener("click", () => {
						respondFriendRequest(btn.dataset.id, btn.dataset.action);
					});
				});
				pendingRequestsList.appendChild(card);
			});
		} else {
			pendingRequestsSection.classList.add("hidden");
		}
	}

	// 2. Separate Online vs Offline
	const online = [];
	const offline = [];

	currentFriendsData.friends.forEach(f => {
		const presence = friendPresenceMap.get(f.id) || { status: "offline", activity: null };
		if (presence.status === "online" || presence.status === "playing" || presence.status === "browsing") {
			online.push({ ...f, presence });
		} else {
			offline.push({ ...f, presence });
		}
	});

	if (onlineFriendsCount) onlineFriendsCount.textContent = online.length;
	if (offlineFriendsCount) offlineFriendsCount.textContent = offline.length;

	// Render Online
	if (onlineFriendsList) {
		onlineFriendsList.innerHTML = "";
		if (online.length === 0) {
			onlineFriendsList.innerHTML = `<div class="friends-empty-msg">No friends online right now.</div>`;
		} else {
			online.forEach(f => {
				const isTed = isUserTed(f.username);
				const isPlaying = f.presence.status === "playing";
				const card = document.createElement("div");
				card.className = `friend-card ${isTed ? 'ted-friend-card' : ''}`;
				card.innerHTML = `
					<div class="friend-avatar-wrap">
						<div class="friend-avatar ${escapeHtml(f.avatar_url || 'avatar-1')}"></div>
						${isTed ? TILTED_CROWN_SVG : ''}
						<span class="presence-dot ${isPlaying ? 'playing' : 'online'}"></span>
					</div>
					<div class="friend-info">
						<div class="friend-name-row">
							<span class="friend-display-name ${isTed ? 'ted-vip-name' : ''}">
								${escapeHtml(f.display_name || f.username)}
								${f.custom_tag ? `<span class="ted-crown-tag">${escapeHtml(f.custom_tag)}</span>` : ''}
							</span>
							<span class="friend-level ${isTed ? 'admin-root-badge' : ''}">${isTed ? 'DEV' : 'Lv.' + (f.level || 1)}</span>
						</div>
						<div class="friend-activity ${isPlaying ? 'active-game' : ''}">${escapeHtml(f.presence.activity || 'Online')}</div>
					</div>
					<div class="friend-actions">
						<button class="friend-btn btn-primary invite-btn" title="Invite to active game">🎮 Invite</button>
						<button class="friend-chat-btn chat-btn" title="Direct Message">💬 Chat${unreadChatCounts[f.id] ? `<span class="friend-unread-dot"></span>` : ''}</button>
						<button class="friend-btn btn-danger remove-btn" title="Remove Friend">&times;</button>
					</div>
				`;
				card.querySelector(".invite-btn").addEventListener("click", () => {
					const activeTab = tabs.find(t => t.id === activeTabId);
					if (activeTab && activeTab.isGame) {
						sendGameInvite(f.id, activeTab.url, activeTab.title);
					} else {
						showToast({ icon: "ℹ️", title: "Game Invite", message: "Launch an arcade game first to invite friends!" });
					}
				});
				card.querySelector(".chat-btn").addEventListener("click", () => {
					navigateToChatPage(f.id);
				});
				card.querySelector(".remove-btn").addEventListener("click", () => {
					if (confirm(`Remove @${f.username} from friends?`)) removeFriend(f.friendship_id);
				});
				onlineFriendsList.appendChild(card);
			});
		}
	}

	// Render Offline
	if (offlineFriendsList) {
		offlineFriendsList.innerHTML = "";
		offline.forEach(f => {
			const isTed = isUserTed(f.username);
			const card = document.createElement("div");
			card.className = `friend-card ${isTed ? 'ted-friend-card' : ''}`;
			card.innerHTML = `
				<div class="friend-avatar-wrap">
					<div class="friend-avatar ${escapeHtml(f.avatar_url || 'avatar-1')}"></div>
					${isTed ? TILTED_CROWN_SVG : ''}
					<span class="presence-dot offline"></span>
				</div>
				<div class="friend-info">
					<div class="friend-name-row">
						<span class="friend-display-name ${isTed ? 'ted-vip-name' : ''}">
							${escapeHtml(f.display_name || f.username)}
							${f.custom_tag ? `<span class="ted-crown-tag">${escapeHtml(f.custom_tag)}</span>` : ''}
						</span>
						<span class="friend-level ${isTed ? 'admin-root-badge' : ''}">${isTed ? 'DEV' : 'Lv.' + (f.level || 1)}</span>
					</div>
					<div class="friend-activity">Offline</div>
				</div>
				<div class="friend-actions">
					<button class="friend-chat-btn chat-btn" title="Direct Message">💬 Chat${unreadChatCounts[f.id] ? `<span class="friend-unread-dot"></span>` : ''}</button>
					<button class="friend-btn btn-danger remove-btn" title="Remove Friend">&times;</button>
				</div>
			`;
			card.querySelector(".chat-btn").addEventListener("click", () => {
				navigateToChatPage(f.id);
			});
			card.querySelector(".remove-btn").addEventListener("click", () => {
				if (confirm(`Remove @${f.username} from friends?`)) removeFriend(f.friendship_id);
			});
			offlineFriendsList.appendChild(card);
		});
	}
}

if (addFriendForm) {
	addFriendForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!authToken) {
			openAuthModal("login");
			return;
		}

		const input = friendUsernameInput.value.trim().replace(/^@/, "");
		if (!input) return;

		try {
			const res = await fetch("/api/friends/request", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({ username: input })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to send request");

			friendUsernameInput.value = "";
			showToast({ icon: "📨", title: "Friend Request Sent", message: data.message });
			loadFriends();
		} catch (err) {
			showToast({ icon: "⚠️", title: "Error", message: err.message });
		}
	});
}

async function respondFriendRequest(friendshipId, action) {
	try {
		const res = await fetch("/api/friends/respond", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${authToken}`
			},
			body: JSON.stringify({ friendshipId, action })
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Error responding");
		showToast({ icon: "✨", title: "Friend Network", message: data.message });
		loadFriends();
	} catch (err) {
		showToast({ icon: "⚠️", title: "Error", message: err.message });
	}
}

async function removeFriend(friendshipId) {
	try {
		const res = await fetch(`/api/friends/${friendshipId}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` }
		});
		if (res.ok) {
			showToast({ icon: "🗑️", title: "Removed", message: "Friend removed." });
			loadFriends();
		}
	} catch (err) {}
}

// ============================================================
// Leaderboard Controller
// ============================================================

async function loadLeaderboard() {
	if (!leaderboardList) return;
	try {
		const res = await fetch("/api/levels/leaderboard");
		const data = await res.json();
		if (res.ok && data.success) {
			leaderboardList.innerHTML = "";
			data.leaderboard.forEach(u => {
				const row = document.createElement("div");
				row.className = "leaderboard-row";

				let rankDisplay = `#${u.rank}`;
				if (u.rank === 1) rankDisplay = "🥇";
				else if (u.rank === 2) rankDisplay = "🥈";
				else if (u.rank === 3) rankDisplay = "🥉";

				const isTed = isUserTed(u.username);
				row.innerHTML = `
					<span class="col-rank rank-${u.rank}">${rankDisplay}</span>
					<div class="col-user">
						<div class="ted-avatar-wrap">
							<div class="leaderboard-user-avatar ${escapeHtml(u.avatar_url || 'avatar-1')}"></div>
							${isTed ? TILTED_CROWN_SVG : ''}
						</div>
						<div>
							<div class="leaderboard-user-name ${isTed ? 'ted-vip-name' : ''}">
								${escapeHtml(u.display_name || u.username)}
								${u.custom_tag ? `<span class="ted-crown-tag">${escapeHtml(u.custom_tag)}</span>` : ''}
							</div>
							<div class="leaderboard-user-tag">@${escapeHtml(u.username)}</div>
						</div>
					</div>
					<span class="col-level">${isTed ? '<span class="admin-root-badge">DEV</span>' : 'Lv. ' + (u.level || 1)}</span>
					<span class="col-xp">${(u.xp || 0).toLocaleString()} XP</span>
				`;
				leaderboardList.appendChild(row);
			});
		}
	} catch (err) {
		leaderboardList.innerHTML = `<div class="leaderboard-loading">Failed to load leaderboard.</div>`;
	}
}

// ============================================================
// Settings & Cloaking Controller
// ============================================================

function applyUserSettings(settings) {
	if (!settings) return;

	if (settingGhostMode) settingGhostMode.checked = !!settings.ghostMode;

	if (settings.theme) {
		document.body.className = "";
		if (settings.theme !== "neon-purple") {
			document.body.classList.add(`theme-${settings.theme}`);
		}
		themeBtns.forEach(btn => {
			btn.classList.toggle("active", btn.dataset.theme === settings.theme);
		});
	}

	if (settings.cloak) {
		applyCloak(settings.cloak);
	}
}

if (settingGhostMode) {
	settingGhostMode.addEventListener("change", async () => {
		if (!authToken) return;
		const isGhost = settingGhostMode.checked;
		try {
			await fetch("/api/profile", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({ settings: { ghostMode: isGhost } })
			});
			if (currentUser) {
				currentUser.settings = currentUser.settings || {};
				currentUser.settings.ghostMode = isGhost;
			}
			broadcastActivity(isGhost ? "offline" : "online", isGhost ? null : "Browsing");
			showToast({
				icon: isGhost ? "👻" : "👁️",
				title: isGhost ? "Ghost Mode Active" : "Ghost Mode Disabled",
				message: isGhost ? "Your presence and XP logging are completely paused." : "Activity and XP tracking resumed."
			});
		} catch (e) {}
	});
}

// ============================================================
// Clash Shield UI Controller & Listeners
// ============================================================

function updateShieldUI() {
	if (typeof ClashShield === "undefined") return;

	const shieldConfig = ClashShield.getConfig();
	const shieldStats = ClashShield.getStats();
	const activeTab = tabs.find((t) => t.id === activeTabId);
	const count = activeTab ? ClashShield.getTabBlockedCount(activeTab.id) : 0;
	const currentHost = activeTab && activeTab.url ? extractDomain(activeTab.url) : "";
	const isWhitelisted = currentHost && ClashShield.isWhitelisted(currentHost);

	// 1. Update Navigation Bar Badge & Active State
	if (shieldCountBadge) {
		shieldCountBadge.textContent = count;
		shieldCountBadge.classList.toggle("zero", count === 0);
	}
	if (navShieldBtn) {
		navShieldBtn.classList.toggle("shield-active", shieldConfig.adBlockEnabled && !isWhitelisted);
	}

	// 2. Update Quick-Settings Popover
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

	if (popoverToggleAdBlock) popoverToggleAdBlock.checked = shieldConfig.adBlockEnabled;
	if (popoverTogglePopups) popoverTogglePopups.checked = shieldConfig.popupBlockEnabled;
	if (popoverToggleDarkMode) popoverToggleDarkMode.checked = shieldConfig.forceDarkMode;

	if (shieldWhitelistBtn) {
		if (!currentHost || currentHost === "localhost" || (typeof location !== "undefined" && currentHost === location.hostname)) {
			shieldWhitelistBtn.textContent = "No active website";
			shieldWhitelistBtn.disabled = true;
			shieldWhitelistBtn.classList.remove("whitelisted");
		} else if (isWhitelisted) {
			shieldWhitelistBtn.textContent = `Resume Shield on ${currentHost}`;
			shieldWhitelistBtn.disabled = false;
			shieldWhitelistBtn.classList.add("whitelisted");
		} else {
			shieldWhitelistBtn.textContent = `Pause on ${currentHost}`;
			shieldWhitelistBtn.disabled = false;
			shieldWhitelistBtn.classList.remove("whitelisted");
		}
	}

	// 3. Update Settings Card Controls & Lifetime Stats
	if (settingShieldAdBlock) settingShieldAdBlock.checked = shieldConfig.adBlockEnabled;
	if (settingShieldPopups) settingShieldPopups.checked = shieldConfig.popupBlockEnabled;
	if (settingShieldDarkMode) settingShieldDarkMode.checked = shieldConfig.forceDarkMode;
	if (settingShieldTotalBlocked) settingShieldTotalBlocked.textContent = shieldStats.totalBlocked.toLocaleString();
	if (settingShieldDataSaved) settingShieldDataSaved.textContent = ClashShield.formatBytes(shieldStats.bytesSaved);
}

// Reactive hook: update UI whenever Shield blocks a request or changes state
if (typeof ClashShield !== "undefined") {
	ClashShield.onChange(() => {
		updateShieldUI();
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (activeTab && activeTab.iframe) {
			ClashShield.applyToFrame(activeTab.iframe, activeTab.url);
		}
	});
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
if (popoverToggleAdBlock) {
	popoverToggleAdBlock.addEventListener("change", () => {
		ClashShield.setAdBlockEnabled(popoverToggleAdBlock.checked);
		showToast({
			icon: popoverToggleAdBlock.checked ? "🛡️" : "⏸️",
			title: "Ad & Tracker Shield",
			message: popoverToggleAdBlock.checked ? "Ad & Tracker blocking enabled." : "Ad blocking paused."
		});
	});
}

if (popoverTogglePopups) {
	popoverTogglePopups.addEventListener("change", () => {
		ClashShield.setPopupBlockEnabled(popoverTogglePopups.checked);
		showToast({
			icon: popoverTogglePopups.checked ? "🚫" : "⚠️",
			title: "Popup Blocker",
			message: popoverTogglePopups.checked ? "Aggressive popups blocked." : "Popup blocker paused."
		});
	});
}

if (popoverToggleDarkMode) {
	popoverToggleDarkMode.addEventListener("change", () => {
		ClashShield.setForceDarkMode(popoverToggleDarkMode.checked);
		showToast({
			icon: popoverToggleDarkMode.checked ? "🌙" : "☀️",
			title: "Force Dark Mode",
			message: popoverToggleDarkMode.checked ? "Smart dark mode enabled on web tabs." : "Smart dark mode disabled."
		});
	});
}

if (shieldWhitelistBtn) {
	shieldWhitelistBtn.addEventListener("click", () => {
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (activeTab && activeTab.url) {
			const host = extractDomain(activeTab.url);
			if (host) {
				const nowWhitelisted = ClashShield.toggleWhitelist(host);
				updateShieldUI();
				if (activeTab.iframe) {
					ClashShield.applyToFrame(activeTab.iframe, activeTab.url);
				}
				showToast({
					icon: nowWhitelisted ? "⏸️" : "🛡️",
					title: "Clash Shield",
					message: nowWhitelisted ? `Shield paused for ${host}` : `Shield active for ${host}`
				});
			}
		}
	});
}

// Settings Card Listeners
if (settingShieldAdBlock) {
	settingShieldAdBlock.addEventListener("change", () => {
		ClashShield.setAdBlockEnabled(settingShieldAdBlock.checked);
	});
}

if (settingShieldPopups) {
	settingShieldPopups.addEventListener("change", () => {
		ClashShield.setPopupBlockEnabled(settingShieldPopups.checked);
	});
}

if (settingShieldDarkMode) {
	settingShieldDarkMode.addEventListener("change", () => {
		ClashShield.setForceDarkMode(settingShieldDarkMode.checked);
	});
}

if (settingShieldClearStats) {
	settingShieldClearStats.addEventListener("click", () => {
		ClashShield.clearStats();
		showToast({
			icon: "🧹",
			title: "Shield Stats Reset",
			message: "Adblock counters have been cleared."
		});
	});
}

// ============================================================
// Chromebook Optimizer (Settings)
// ============================================================

let perfSettings = { staticBg: false, lightUi: false, frameBoost: false, resolution: 1 };

function loadPerfSettings() {
	try {
		const stored = JSON.parse(localStorage.getItem("clash_perf"));
		if (stored && typeof stored === "object") perfSettings = { ...perfSettings, ...stored };
	} catch (e) {}
}

function savePerfSettings() {
	try {
		localStorage.setItem("clash_perf", JSON.stringify(perfSettings));
	} catch (e) {}
}

function applyPerfSettings() {
	const root = document.documentElement;
	root.classList.toggle("static-bg", !!perfSettings.staticBg);
	root.classList.toggle("light-ui", !!perfSettings.lightUi);

	const scale = parseFloat(perfSettings.resolution);
	const safeScale = scale > 0 && scale <= 1 ? scale : 1;
	root.style.setProperty("--game-scale", safeScale);

	if (typeof window.clashSetStaticBg === "function") {
		window.clashSetStaticBg(!!perfSettings.staticBg);
	}

	if (settingPerfStaticBg) settingPerfStaticBg.checked = !!perfSettings.staticBg;
	if (settingPerfLightUi) settingPerfLightUi.checked = !!perfSettings.lightUi;
	if (settingPerfFrameBoost) settingPerfFrameBoost.checked = !!perfSettings.frameBoost;
	if (settingPerfResolution) settingPerfResolution.value = String(safeScale);
}

function initPerfSettings() {
	loadPerfSettings();
	applyPerfSettings();

	const toggles = [
		[settingPerfStaticBg, "staticBg", "Background frozen to a static version."],
		[settingPerfLightUi, "lightUi", "Blur, shadows and transitions disabled."],
		[settingPerfFrameBoost, "frameBoost", "Games will launch in high-performance mode."]
	];

	toggles.forEach(([el, key, msg]) => {
		if (!el) return;
		el.addEventListener("change", () => {
			perfSettings[key] = el.checked;
			savePerfSettings();
			applyPerfSettings();
			showToast({ icon: "🖥️", title: "Optimizer Updated", message: el.checked ? msg : "Setting disabled." });
		});
	});

	if (settingPerfResolution) {
		settingPerfResolution.addEventListener("change", () => {
			perfSettings.resolution = parseFloat(settingPerfResolution.value) || 1;
			savePerfSettings();
			applyPerfSettings();
			showToast({
				icon: "🖥️",
				title: "Resolution Updated",
				message: `Games now render at ${Math.round((parseFloat(perfSettings.resolution) || 1) * 100)}% resolution.`
			});
		});
	}

	// Fullscreen handling for the optimizer:
	// - Only strip the resolution upscale when the frame itself is fullscreened
	//   (whole-page fullscreen keeps the scaled frame so the game still fills the screen).
	// - Tell the frame it's fullscreened so the in-game bootstrap drops devicePixelRatio
	//   by the resolution factor — the only lever that works while the UA forces the
	//   fullscreen element to viewport size.
	document.addEventListener("fullscreenchange", () => {
		const fsEl = document.fullscreenElement;
		const frameFs = !!(fsEl && fsEl.classList && fsEl.classList.contains("proxy-frame"));
		document.documentElement.classList.toggle("in-frame-fullscreen", frameFs);
		document.querySelectorAll("iframe.proxy-frame").forEach((f) => {
			try {
				f.contentWindow.__clashPerfFs = frameFs && f === fsEl;
			} catch (e) {}
		});
	});
}

initPerfSettings();

// ============================================================
// Bookmarks & Speed Dial Manager
// ============================================================

const GUEST_DEFAULT_BOOKMARKS = [
	{ id: "g1", title: "Google", url: "https://www.google.com", icon: "🌐", is_game: 0 },
	{ id: "g2", title: "YouTube", url: "https://www.youtube.com", icon: "▶️", is_game: 0 },
	{ id: "g3", title: "Discord", url: "https://discord.com", icon: "💬", is_game: 0 },
	{ id: "g4", title: "Wikipedia", url: "https://www.wikipedia.org", icon: "📚", is_game: 0 },
	{ id: "g5", title: "Drive Mad", url: "/games/cldrivemady.html", icon: "🚗", is_game: 1 },
	{ id: "g6", title: "Retro Bowl", url: "/games/clretrobowl.html", icon: "🏈", is_game: 1 },
	{ id: "g7", title: "1v1.LOL", url: "/games/cl1v1lol.html", icon: "🎯", is_game: 1 },
	{ id: "g8", title: "Slope", url: "/games/clslope.html", icon: "⚡", is_game: 1 }
];

let userBookmarks = [];

async function loadBookmarks() {
	if (authToken) {
		try {
			const res = await fetch("/api/bookmarks", {
				headers: { Authorization: `Bearer ${authToken}` }
			});
			const data = await res.json();
			if (data.bookmarks) {
				userBookmarks = data.bookmarks;
				renderSpeedDial();
				updateBookmarkStarForActiveTab();
				return;
			}
		} catch (e) {
			console.warn("Failed to load cloud bookmarks:", e);
		}
	}

	// Fallback to local guest storage
	try {
		const stored = localStorage.getItem("clash_guest_bookmarks");
		if (stored) {
			userBookmarks = JSON.parse(stored);
		} else {
			userBookmarks = [...GUEST_DEFAULT_BOOKMARKS];
			localStorage.setItem("clash_guest_bookmarks", JSON.stringify(userBookmarks));
		}
	} catch (e) {
		userBookmarks = [...GUEST_DEFAULT_BOOKMARKS];
	}

	renderSpeedDial();
	updateBookmarkStarForActiveTab();
}

function saveGuestBookmarks() {
	try {
		localStorage.setItem("clash_guest_bookmarks", JSON.stringify(userBookmarks));
	} catch (e) {}
}

function renderSpeedDial() {
	if (!speedDialGrid) return;
	speedDialGrid.innerHTML = "";

	if (!userBookmarks || userBookmarks.length === 0) {
		speedDialGrid.innerHTML = `<div class="speed-dial-empty" style="grid-column: 1/-1; text-align:center; color:var(--text-muted); font-size:0.8rem; padding: 12px;">No shortcuts yet. Click "+ Add Shortcut" or star pages!</div>`;
		return;
	}

	userBookmarks.forEach((bm) => {
		const tile = document.createElement("div");
		tile.className = "speed-dial-tile";
		tile.title = `${bm.title}\n${bm.url}`;
		tile.innerHTML = `
			<div class="speed-dial-icon">${escapeHtml(bm.icon || (bm.is_game ? "🎮" : "🌐"))}</div>
			<span class="speed-dial-title">${escapeHtml(bm.title)}</span>
			<button class="speed-dial-delete-btn" title="Remove bookmark">&times;</button>
		`;

		tile.addEventListener("click", (e) => {
			if (e.target.closest(".speed-dial-delete-btn")) return;
			const activeTab = tabs.find((t) => t.id === activeTabId);
			if (activeTab && activeTab.isNewTab) {
				navigateTab(activeTab.id, bm.url, !!bm.is_game);
			} else {
				createTab(bm.url, !!bm.is_game);
			}
		});

		tile.querySelector(".speed-dial-delete-btn").addEventListener("click", (e) => {
			e.stopPropagation();
			deleteBookmark(bm.id, bm.url);
		});

		speedDialGrid.appendChild(tile);
	});
}

async function addBookmark(title, url, icon, isGame = false) {
	const cleanTitle = (title || url).slice(0, 50);
	const cleanUrl = url.trim();
	const cleanIcon = icon || (isGame ? "🎮" : "🌐");

	if (authToken) {
		try {
			const res = await fetch("/api/bookmarks", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({
					title: cleanTitle,
					url: cleanUrl,
					icon: cleanIcon,
					is_game: isGame ? 1 : 0
				})
			});
			const data = await res.json();
			if (data.bookmark) {
				userBookmarks.push(data.bookmark);
				renderSpeedDial();
				updateBookmarkStarForActiveTab();
				showToast({ icon: "⭐", title: "Bookmark Added", message: `Saved "${cleanTitle}" to your Speed Dial!` });
				return true;
			}
		} catch (e) {
			console.error("Cloud bookmark add error:", e);
		}
	}

	// Guest mode addition
	const newBm = {
		id: "g_" + Date.now(),
		title: cleanTitle,
		url: cleanUrl,
		icon: cleanIcon,
		is_game: isGame ? 1 : 0
	};
	userBookmarks.push(newBm);
	saveGuestBookmarks();
	renderSpeedDial();
	updateBookmarkStarForActiveTab();
	showToast({ icon: "⭐", title: "Bookmark Added", message: `Saved "${cleanTitle}" to your Speed Dial!` });
	return true;
}

async function deleteBookmark(bookmarkId, bookmarkUrl) {
	if (authToken && typeof bookmarkId === "number") {
		try {
			await fetch(`/api/bookmarks/${bookmarkId}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` }
			});
		} catch (e) {
			console.warn("Error deleting cloud bookmark:", e);
		}
	}

	userBookmarks = userBookmarks.filter((b) => b.id !== bookmarkId && b.url !== bookmarkUrl);
	if (!authToken) saveGuestBookmarks();
	renderSpeedDial();
	updateBookmarkStarForActiveTab();
	showToast({ icon: "🗑️", title: "Bookmark Removed", message: "Shortcut removed from Speed Dial." });
}

function updateBookmarkStarForActiveTab() {
	if (!navBookmarkBtn) return;
	const activeTab = tabs.find((t) => t.id === activeTabId);
	if (!activeTab || !activeTab.url || activeTab.isNewTab) {
		navBookmarkBtn.classList.remove("bookmarked");
		return;
	}

	const isBookmarked = userBookmarks.some((b) => b.url === activeTab.url || (b.url.startsWith("/") && activeTab.url.endsWith(b.url)));
	navBookmarkBtn.classList.toggle("bookmarked", isBookmarked);
}

// Nav Bookmark Star Button Click
if (navBookmarkBtn) {
	navBookmarkBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (!activeTab || !activeTab.url || activeTab.isNewTab) {
			showToast({ icon: "ℹ️", title: "Bookmark", message: "Open a website or game first to bookmark it!" });
			return;
		}

		const existing = userBookmarks.find((b) => b.url === activeTab.url || (b.url.startsWith("/") && activeTab.url.endsWith(b.url)));
		if (existing) {
			deleteBookmark(existing.id, existing.url);
		} else {
			addBookmark(activeTab.title || extractDomain(activeTab.url), activeTab.url, activeTab.isGame ? "🎮" : "🌐", activeTab.isGame);
		}
	});
}

// Add Shortcut Modal Listeners
if (addShortcutBtn && shortcutModal) {
	addShortcutBtn.addEventListener("click", () => {
		if (shortcutForm) shortcutForm.reset();
		shortcutModal.classList.remove("hidden");
	});
}

if (shortcutModalClose && shortcutModal) {
	shortcutModalClose.addEventListener("click", () => {
		shortcutModal.classList.add("hidden");
	});
	shortcutModal.addEventListener("click", (e) => {
		if (e.target === shortcutModal) shortcutModal.classList.add("hidden");
	});
}

if (shortcutForm) {
	shortcutForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const title = shortcutTitle.value.trim();
		const url = shortcutUrl.value.trim();
		const icon = shortcutIcon ? shortcutIcon.value.trim() : "";
		if (!title || !url) return;

		await addBookmark(title, url, icon);
		if (shortcutModal) shortcutModal.classList.add("hidden");
	});
}

// ============================================================
// Direct Messaging & Floating Chat Drawer Manager
// ============================================================

let activeChatFriend = null;
let unreadChatCounts = {};

async function loadUnreadCounts() {
	if (!authToken) {
		if (chatNavUnreadBadge) chatNavUnreadBadge.classList.add("hidden");
		return;
	}
	try {
		const res = await fetch("/api/chat/unread", {
			headers: { Authorization: `Bearer ${authToken}` }
		});
		const data = await res.json();
		if (data.unreadBySender) {
			unreadChatCounts = data.unreadBySender;
			renderFriendsLists();
		}
		if (chatNavUnreadBadge) {
			const total = data.totalUnread || 0;
			if (total > 0) {
				chatNavUnreadBadge.textContent = total > 99 ? "99+" : total;
				chatNavUnreadBadge.classList.remove("hidden");
			} else {
				chatNavUnreadBadge.classList.add("hidden");
			}
		}
	} catch (e) {}
}

async function openChatDrawer(friend) {
	if (!chatDrawer) return;
	activeChatFriend = friend;
	unreadChatCounts[friend.id] = 0;
	renderFriendsLists();

	// Update Header
	const isTed = isUserTed(friend.username);
	if (chatFriendAvatar) {
		chatFriendAvatar.className = `chat-avatar ${isTed ? 'ted-avatar-wrap' : ''} ${friend.avatar_url || 'avatar-1'}`;
		chatFriendAvatar.innerHTML = isTed ? TILTED_CROWN_SVG : "";
	}
	if (chatFriendName) {
		chatFriendName.textContent = friend.display_name || friend.username;
		if (isTed) {
			chatFriendName.className = "chat-friend-name ted-vip-name";
		} else {
			chatFriendName.className = "chat-friend-name";
		}
	}
	if (chatFriendStatus) {
		const pres = friendPresenceMap.get(friend.id);
		const isOnline = pres && (pres.status === "online" || pres.status === "playing" || pres.status === "browsing");
		chatFriendStatus.textContent = isOnline ? (pres.activity || "Online") : "Offline";
		chatFriendStatus.className = `chat-friend-status ${isOnline ? '' : 'offline'}`;
	}

	chatDrawer.classList.remove("hidden", "minimized");

	// Load Message History
	if (chatMessagesContainer) {
		chatMessagesContainer.innerHTML = `<div class="chat-empty-state">Loading messages...</div>`;
		try {
			const res = await fetch(`/api/chat/${friend.id}`, {
				headers: { Authorization: `Bearer ${authToken}` }
			});
			const data = await res.json();
			chatMessagesContainer.innerHTML = "";
			if (!data.messages || data.messages.length === 0) {
				chatMessagesContainer.innerHTML = `<div class="chat-empty-state">No messages yet. Say hello! 👋</div>`;
			} else {
				data.messages.forEach((msg) => {
					appendChatMessage(msg, msg.sender_id === (currentUser ? currentUser.id : null));
				});
			}
		} catch (err) {
			chatMessagesContainer.innerHTML = `<div class="chat-empty-state">Failed to load messages.</div>`;
		}
	}

	sendWsChatRead(friend.id);
	if (chatMessageInput) chatMessageInput.focus();
}

function closeChatDrawer() {
	if (!chatDrawer) return;
	chatDrawer.classList.add("hidden");
	activeChatFriend = null;
}

function sendWsChatRead(friendId) {
	if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
		presenceWs.send(JSON.stringify({ type: "chat_read", friendId }));
	}
}

function appendChatMessage(msg, isMine) {
	if (!chatMessagesContainer) return;

	const emptyState = chatMessagesContainer.querySelector(".chat-empty-state");
	if (emptyState) emptyState.remove();

	const row = document.createElement("div");
	row.className = `chat-message-row ${isMine ? "mine" : "theirs"}`;

	let meta = null;
	if (msg.meta_json) {
		try {
			meta = typeof msg.meta_json === "string" ? JSON.parse(msg.meta_json) : msg.meta_json;
		} catch (e) {}
	}

	let bubbleContent = escapeHtml(msg.content);
	let extraHtml = "";

	if (msg.type === "game_share" && meta) {
		extraHtml = `
			<div class="chat-share-card">
				<span class="chat-share-title">🎮 ${escapeHtml(meta.title || "Arcade Game")}</span>
				<button class="chat-share-btn-action play-shared-game-btn" data-url="${escapeHtml(meta.url)}">Play Game</button>
			</div>
		`;
	} else if (msg.type === "url_share" && meta) {
		extraHtml = `
			<div class="chat-share-card">
				<span class="chat-share-title">🌐 ${escapeHtml(meta.title || meta.url)}</span>
				<button class="chat-share-btn-action open-shared-tab-btn" data-url="${escapeHtml(meta.url)}">Open Tab</button>
			</div>
		`;
	}

	const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

	row.innerHTML = `
		<div class="chat-bubble">
			${bubbleContent}
			${extraHtml}
		</div>
		<span class="chat-time">${timeStr}</span>
	`;

	const playBtn = row.querySelector(".play-shared-game-btn");
	if (playBtn) {
		playBtn.addEventListener("click", () => {
			createTab(playBtn.dataset.url, true);
		});
	}

	const openTabBtn = row.querySelector(".open-shared-tab-btn");
	if (openTabBtn) {
		openTabBtn.addEventListener("click", () => {
			createTab(openTabBtn.dataset.url, false);
		});
	}

	chatMessagesContainer.appendChild(row);
	chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Chat Form Submit
if (chatInputForm && chatMessageInput) {
	chatInputForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const text = chatMessageInput.value.trim();
		if (!text || !activeChatFriend) return;

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "chat_send",
				receiverId: activeChatFriend.id,
				content: text,
				messageType: "text"
			}));
		} else {
			showToast({ icon: "⚠️", title: "Offline", message: "Connecting to chat network..." });
		}

		chatMessageInput.value = "";
	});
}

// Quick Share Game & Tab in Chat
if (chatShareGameBtn) {
	chatShareGameBtn.addEventListener("click", () => {
		if (!activeChatFriend) return;
		const activeTab = tabs.find((t) => t.id === activeTabId);
		let gameTitle = "Drive Mad";
		let gameUrl = "/games/cldrivemady.html";
		if (activeTab && activeTab.isGame) {
			gameTitle = activeTab.title;
			gameUrl = activeTab.url;
		}

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "chat_send",
				receiverId: activeChatFriend.id,
				content: `Check out this game: ${gameTitle}!`,
				messageType: "game_share",
				meta: { title: gameTitle, url: gameUrl }
			}));
		}
	});
}

if (chatShareTabBtn) {
	chatShareTabBtn.addEventListener("click", () => {
		if (!activeChatFriend) return;
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (!activeTab || !activeTab.url || activeTab.isNewTab) {
			showToast({ icon: "ℹ️", title: "Share Tab", message: "Open a website tab to share it!" });
			return;
		}

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "chat_send",
				receiverId: activeChatFriend.id,
				content: `Check out this page: ${activeTab.title || extractDomain(activeTab.url)}`,
				messageType: "url_share",
				meta: { title: activeTab.title, url: activeTab.url }
			}));
		}
	});
}

if (chatCloseBtn) {
	chatCloseBtn.addEventListener("click", () => {
		closeChatDrawer();
	});
}

if (chatMinimizeBtn) {
	chatMinimizeBtn.addEventListener("click", () => {
		if (chatDrawer) chatDrawer.classList.toggle("minimized");
	});
}

// ============================================================
// 💬 Dedicated Chat Page Messenger Controller
// ============================================================

let chatConversationsData = [];
let activeChatPageFriend = null;
let chatIsTyping = false;
let chatTypingTimer = null;

function formatChatTime(dateStr) {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatConvTime(dateStr) {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	const now = new Date();
	if (d.toDateString() === now.toDateString()) {
		return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	}
	const y = new Date();
	y.setDate(now.getDate() - 1);
	if (d.toDateString() === y.toDateString()) {
		return "Yesterday";
	}
	return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function loadChatConversations() {
	if (!chatConversationsList) return;

	if (!authToken) {
		chatConversationsList.innerHTML = `
			<div class="chat-sidebar-loading" style="padding: 30px 16px;">
				<div style="font-size: 2rem; margin-bottom: 10px;">🔒</div>
				<p style="margin-bottom: 14px; color: #a0aec0;">Sign in to access your messages and chat with friends.</p>
				<button type="button" class="btn btn-primary btn-sm chat-login-btn">Sign In</button>
			</div>
		`;
		const btn = chatConversationsList.querySelector(".chat-login-btn");
		if (btn) btn.addEventListener("click", () => openAuthModal("login"));

		if (chatEmptySelection) {
			chatEmptySelection.classList.remove("hidden");
			chatEmptySelection.innerHTML = `
				<div class="chat-empty-icon-wrap"><span class="chat-empty-icon">💬</span></div>
				<h3 class="chat-empty-title">Clash Messenger</h3>
				<p class="chat-empty-desc">Sign in to start direct messaging your friends, sharing games, and sending web pages.</p>
			`;
		}
		if (chatActiveFeedWrap) chatActiveFeedWrap.classList.add("hidden");
		return;
	}

	try {
		chatConversationsList.innerHTML = `<div class="chat-sidebar-loading">Loading conversations...</div>`;
		const res = await fetch("/api/chat/conversations", {
			headers: { Authorization: `Bearer ${authToken}` }
		});
		const data = await res.json();
		chatConversationsData = data.conversations || [];
		renderConversationsListUI();
		updateChatPagePresenceUI();
	} catch (err) {
		chatConversationsList.innerHTML = `<div class="chat-sidebar-loading" style="color: #ff4757;">Failed to load conversations.</div>`;
	}
}

function renderConversationsListUI() {
	if (!chatConversationsList) return;
	chatConversationsList.innerHTML = "";

	if (chatConversationsData.length === 0) {
		chatConversationsList.innerHTML = `
			<div class="chat-sidebar-loading" style="padding: 30px 16px;">
				<div style="font-size: 1.8rem; margin-bottom: 8px;">👥</div>
				<p style="margin-bottom: 12px; color: #a0aec0;">No friends found yet.</p>
				<button type="button" class="btn btn-secondary btn-sm chat-go-friends-btn">Find Friends</button>
			</div>
		`;
		const btn = chatConversationsList.querySelector(".chat-go-friends-btn");
		if (btn) btn.addEventListener("click", () => {
			const fNav = document.getElementById("nav-friends");
			if (fNav) fNav.click();
		});
		return;
	}

	const searchFilter = (chatSearchInput ? chatSearchInput.value : "").trim().toLowerCase();

	const filtered = chatConversationsData.filter((conv) => {
		if (!searchFilter) return true;
		const name = (conv.friend.displayName || "").toLowerCase();
		const handle = (conv.friend.username || "").toLowerCase();
		return name.includes(searchFilter) || handle.includes(searchFilter);
	});

	if (filtered.length === 0) {
		chatConversationsList.innerHTML = `<div class="chat-sidebar-loading">No matching friends found.</div>`;
		return;
	}

	filtered.forEach((conv) => {
		const isTed = isUserTed(conv.friend.username);
		const pres = friendPresenceMap.get(conv.friend.id);
		const isOnline = pres && (pres.status === "online" || pres.status === "playing" || pres.status === "browsing");
		const isActive = activeChatPageFriend && activeChatPageFriend.id === conv.friend.id;

		const item = document.createElement("div");
		item.className = `chat-conversation-item ${isActive ? "active" : ""}`;
		item.dataset.friendId = conv.friend.id;

		let snippet = "No messages yet";
		let timeStr = "";
		if (conv.lastMessage) {
			timeStr = formatConvTime(conv.lastMessage.createdAt);
			if (conv.lastMessage.type === "game_share") {
				snippet = "🎮 Shared an arcade game";
			} else if (conv.lastMessage.type === "url_share") {
				snippet = "🌐 Shared a link";
			} else {
				snippet = conv.lastMessage.content;
			}
		}

		item.innerHTML = `
			<div class="chat-conv-avatar-wrap">
				<div class="chat-conv-avatar ${isTed ? 'ted-avatar-wrap' : ''} ${conv.friend.avatarUrl || 'avatar-1'}">
					${isTed ? TILTED_CROWN_SVG : ''}
				</div>
				<span class="chat-status-dot ${isOnline ? 'online' : 'offline'}"></span>
			</div>
			<div class="chat-conv-info">
				<div class="chat-conv-top">
					<span class="chat-conv-name ${isTed ? 'ted-vip-name' : ''}">${escapeHtml(conv.friend.displayName || conv.friend.username)}</span>
					<span class="chat-conv-time">${timeStr}</span>
				</div>
				<div class="chat-conv-bottom">
					<span class="chat-conv-snippet">${escapeHtml(snippet)}</span>
					${conv.unreadCount > 0 ? `<span class="chat-conv-unread">${conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>` : ''}
				</div>
			</div>
		`;

		item.addEventListener("click", () => {
			selectChatPageConversation(conv.friend);
		});

		chatConversationsList.appendChild(item);
	});
}

function updateChatPagePresenceUI() {
	let onlineCount = 0;
	chatConversationsData.forEach((c) => {
		const p = friendPresenceMap.get(c.friend.id);
		if (p && (p.status === "online" || p.status === "playing" || p.status === "browsing")) {
			onlineCount++;
		}
	});

	if (chatPageOnlineCount) {
		chatPageOnlineCount.textContent = `${onlineCount} Online`;
	}

	if (chatConversationsList) {
		document.querySelectorAll(".chat-conversation-item").forEach((item) => {
			const fid = parseInt(item.dataset.friendId, 10);
			const dot = item.querySelector(".chat-status-dot");
			if (dot && fid) {
				const p = friendPresenceMap.get(fid);
				const isOnline = p && (p.status === "online" || p.status === "playing" || p.status === "browsing");
				dot.className = `chat-status-dot ${isOnline ? "online" : "offline"}`;
			}
		});
	}

	if (activeChatPageFriend && chatActivePresence && chatActiveStatusDot) {
		const p = friendPresenceMap.get(activeChatPageFriend.id);
		const isOnline = p && (p.status === "online" || p.status === "playing" || p.status === "browsing");
		chatActiveStatusDot.className = `chat-status-dot ${isOnline ? "online" : "offline"}`;
		chatActivePresence.textContent = isOnline ? (p.activity || "Online") : "Offline";
		chatActivePresence.style.color = isOnline ? "#00ff88" : "#a0aec0";
	}
}

function updateConversationsSnippet(msg) {
	const currentUid = currentUser ? currentUser.id : null;
	const otherId = msg.sender_id === currentUid ? msg.receiver_id : msg.sender_id;

	const conv = chatConversationsData.find((c) => c.friend.id === otherId);
	if (conv) {
		conv.lastMessage = {
			id: msg.id,
			senderId: msg.sender_id,
			content: msg.content,
			type: msg.type,
			createdAt: msg.created_at || new Date().toISOString()
		};
		if (msg.sender_id !== currentUid) {
			if (!activeChatPageFriend || activeChatPageFriend.id !== otherId) {
				conv.unreadCount = (conv.unreadCount || 0) + 1;
			}
		}
		chatConversationsData.sort((a, b) => {
			const tA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
			const tB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
			return tB - tA;
		});
		renderConversationsListUI();
	} else {
		loadChatConversations();
	}
}

async function selectChatPageConversation(friend) {
	activeChatPageFriend = friend;

	// Highlight item in sidebar
	document.querySelectorAll(".chat-conversation-item").forEach((item) => {
		item.classList.toggle("active", parseInt(item.dataset.friendId, 10) === friend.id);
	});

	// Reset unread count locally
	const conv = chatConversationsData.find((c) => c.friend.id === friend.id);
	if (conv) conv.unreadCount = 0;
	if (unreadChatCounts[friend.id]) unreadChatCounts[friend.id] = 0;
	renderConversationsListUI();
	loadUnreadCounts();

	// Switch panes
	if (chatEmptySelection) chatEmptySelection.classList.add("hidden");
	if (chatActiveFeedWrap) chatActiveFeedWrap.classList.remove("hidden");

	// Update Header
	const isTed = isUserTed(friend.username);
	if (chatActiveAvatar) {
		chatActiveAvatar.className = `chat-avatar ${isTed ? 'ted-avatar-wrap' : ''} ${friend.avatarUrl || 'avatar-1'}`;
		chatActiveAvatar.innerHTML = isTed ? TILTED_CROWN_SVG : "";
	}
	if (chatActiveName) {
		chatActiveName.textContent = friend.displayName || friend.username;
		chatActiveName.className = `chat-active-name ${isTed ? 'ted-vip-name' : ''}`;
	}
	if (chatActiveUsername) {
		chatActiveUsername.textContent = `@${friend.username}`;
	}

	const pres = friendPresenceMap.get(friend.id);
	const isOnline = pres && (pres.status === "online" || pres.status === "playing" || pres.status === "browsing");
	if (chatActiveStatusDot) {
		chatActiveStatusDot.className = `chat-status-dot ${isOnline ? 'online' : 'offline'}`;
	}
	if (chatActivePresence) {
		chatActivePresence.textContent = isOnline ? (pres.activity || "Online") : "Offline";
		chatActivePresence.style.color = isOnline ? "#00ff88" : "#a0aec0";
	}

	if (chatPageInput) {
		chatPageInput.placeholder = `Message @${friend.username}... (Press Enter to send)`;
	}

	// Load Message History
	if (chatPageMessages) {
		chatPageMessages.innerHTML = `<div class="chat-sidebar-loading">Loading message history...</div>`;
		try {
			const res = await fetch(`/api/chat/${friend.id}`, {
				headers: { Authorization: `Bearer ${authToken}` }
			});
			const data = await res.json();
			chatPageMessages.innerHTML = "";
			if (!data.messages || data.messages.length === 0) {
				chatPageMessages.innerHTML = `
					<div class="chat-sidebar-loading" style="padding: 40px 16px;">
						<div style="font-size: 2.2rem; margin-bottom: 8px;">👋</div>
						<div style="color: #fff; font-weight: 700; margin-bottom: 4px;">Start of your conversation</div>
						<div style="color: #a0aec0; font-size: 0.85rem;">Say hello to @${escapeHtml(friend.username)} or share an arcade game!</div>
					</div>
				`;
			} else {
				const currentUid = currentUser ? currentUser.id : null;
				data.messages.forEach((msg) => {
					renderChatPageMessageItem(msg, msg.sender_id === currentUid, friend);
				});
			}
			chatPageMessages.scrollTop = chatPageMessages.scrollHeight;
		} catch (err) {
			chatPageMessages.innerHTML = `<div class="chat-sidebar-loading" style="color: #ff4757;">Failed to load messages.</div>`;
		}
	}

	// Send read receipt
	sendWsChatRead(friend.id);
	fetch(`/api/chat/${friend.id}/read`, {
		method: "POST",
		headers: { Authorization: `Bearer ${authToken}` }
	}).catch(() => {});

	if (chatPageInput) chatPageInput.focus();
}

function renderChatPageMessageItem(msg, isMine, friend) {
	if (!chatPageMessages) return;

	const emptyState = chatPageMessages.querySelector(".chat-sidebar-loading");
	if (emptyState) emptyState.remove();

	const row = document.createElement("div");
	row.className = `chat-bubble-row ${isMine ? "mine" : "theirs"}`;
	row.dataset.msgId = msg.id;

	let meta = null;
	if (msg.meta_json) {
		try {
			meta = typeof msg.meta_json === "string" ? JSON.parse(msg.meta_json) : msg.meta_json;
		} catch (e) {}
	}

	let extraHtml = "";
	if (msg.type === "game_share" && meta) {
		extraHtml = `
			<div class="chat-rich-card">
				<div class="chat-rich-card-title">🎮 ${escapeHtml(meta.title || "Arcade Game")}</div>
				<button type="button" class="chat-rich-card-btn play-shared-game-btn" data-url="${escapeHtml(meta.url)}">▶ Play Game</button>
			</div>
		`;
	} else if (msg.type === "url_share" && meta) {
		extraHtml = `
			<div class="chat-rich-card">
				<div class="chat-rich-card-title">🌐 ${escapeHtml(meta.title || meta.url)}</div>
				<button type="button" class="chat-rich-card-btn open-shared-tab-btn" data-url="${escapeHtml(meta.url)}">🌐 Open Tab</button>
			</div>
		`;
	}

	const timeStr = formatChatTime(msg.created_at || msg.createdAt);
	const readReceipt = isMine ? `<span class="chat-read-receipt" style="color: ${msg.is_read ? '#00f0ff' : 'rgba(255,255,255,0.4)'}">${msg.is_read ? '✓✓' : '✓'}</span>` : "";

	const avatarClass = friend?.avatarUrl || "avatar-1";

	row.innerHTML = `
		${!isMine ? `<div class="chat-msg-avatar ${avatarClass}"></div>` : ''}
		<div class="chat-bubble-content">
			<div class="chat-bubble">
				<span>${escapeHtml(msg.content)}</span>
				${extraHtml}
			</div>
			<div class="chat-bubble-meta">
				<span>${timeStr}</span>
				${readReceipt}
			</div>
		</div>
	`;

	const playBtn = row.querySelector(".play-shared-game-btn");
	if (playBtn) {
		playBtn.addEventListener("click", () => {
			createTab(playBtn.dataset.url, true);
		});
	}

	const openTabBtn = row.querySelector(".open-shared-tab-btn");
	if (openTabBtn) {
		openTabBtn.addEventListener("click", () => {
			createTab(openTabBtn.dataset.url, false);
		});
	}

	chatPageMessages.appendChild(row);
	chatPageMessages.scrollTop = chatPageMessages.scrollHeight;
}

async function navigateToChatPage(friendId = null) {
	closeChatDrawer();
	const link = document.querySelector('.sidebar-link[data-page="chat"]');
	if (link) {
		link.click();
	} else {
		pages.forEach((p) => p.classList.remove("active"));
		if (pageChat) pageChat.classList.add("active");
		framesContainer.classList.add("hidden");
		browserChrome.classList.add("hidden");
		mainContent.classList.remove("hidden");
		mainContent.classList.remove("new-tab-mode");
		await loadChatConversations();
	}

	if (friendId) {
		const fid = parseInt(friendId, 10);
		const conv = chatConversationsData.find((c) => c.friend.id === fid);
		if (conv) {
			selectChatPageConversation(conv.friend);
		} else {
			const fr = (currentFriendsData.friends || []).find((f) => f.id === fid);
			if (fr) {
				selectChatPageConversation({
					id: fr.id,
					username: fr.username,
					displayName: fr.display_name || fr.username,
					avatarUrl: fr.avatar_url || "avatar-1",
					role: fr.role,
					customTag: fr.custom_tag
				});
			}
		}
	}
}

// Search Filter Input Listener
if (chatSearchInput) {
	chatSearchInput.addEventListener("input", () => {
		renderConversationsListUI();
	});
}

// Chat Page Form Submission
if (chatPageForm && chatPageInput) {
	chatPageForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const text = chatPageInput.value.trim();
		if (!text || !activeChatPageFriend) return;

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "chat_send",
				receiverId: activeChatPageFriend.id,
				content: text,
				messageType: "text"
			}));

			// Stop typing indicator
			presenceWs.send(JSON.stringify({
				type: "chat_typing",
				receiverId: activeChatPageFriend.id,
				isTyping: false
			}));
		} else {
			showToast({ icon: "⚠️", title: "Offline", message: "Connecting to chat network..." });
		}

		chatPageInput.value = "";
		chatIsTyping = false;
	});

	// Typing indicator trigger
	chatPageInput.addEventListener("input", () => {
		if (!activeChatPageFriend || !presenceWs || presenceWs.readyState !== WebSocket.OPEN) return;
		if (!chatIsTyping) {
			chatIsTyping = true;
			presenceWs.send(JSON.stringify({
				type: "chat_typing",
				receiverId: activeChatPageFriend.id,
				isTyping: true
			}));
		}
		clearTimeout(chatTypingTimer);
		chatTypingTimer = setTimeout(() => {
			chatIsTyping = false;
			if (presenceWs && presenceWs.readyState === WebSocket.OPEN && activeChatPageFriend) {
				presenceWs.send(JSON.stringify({
					type: "chat_typing",
					receiverId: activeChatPageFriend.id,
					isTyping: false
				}));
			}
		}, 1500);
	});
}

// Quick Reaction Emojis
document.querySelectorAll(".quick-emoji-btn").forEach((btn) => {
	btn.addEventListener("click", () => {
		const emoji = btn.dataset.emoji;
		if (chatPageInput) {
			chatPageInput.value += emoji;
			chatPageInput.focus();
		}
	});
});

// Share Game & Tab in Chat Page
if (chatPageShareGameBtn) {
	chatPageShareGameBtn.addEventListener("click", () => {
		if (!activeChatPageFriend) {
			showToast({ icon: "ℹ️", title: "Select Friend", message: "Select a conversation first to share games!" });
			return;
		}
		const activeTab = tabs.find((t) => t.id === activeTabId);
		let gameTitle = "Drive Mad";
		let gameUrl = "/games/cldrivemady.html";
		if (activeTab && activeTab.isGame) {
			gameTitle = activeTab.title;
			gameUrl = activeTab.url;
		}

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "chat_send",
				receiverId: activeChatPageFriend.id,
				content: `Check out this arcade game: ${gameTitle}! 🎮`,
				messageType: "game_share",
				meta: { title: gameTitle, url: gameUrl }
			}));
		}
	});
}

if (chatPageShareTabBtn) {
	chatPageShareTabBtn.addEventListener("click", () => {
		if (!activeChatPageFriend) {
			showToast({ icon: "ℹ️", title: "Select Friend", message: "Select a conversation first to share pages!" });
			return;
		}
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (!activeTab || !activeTab.url || activeTab.isNewTab) {
			showToast({ icon: "ℹ️", title: "Share Page", message: "Open a website tab first to share it!" });
			return;
		}

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "chat_send",
				receiverId: activeChatPageFriend.id,
				content: `Check out this web page: ${activeTab.title || extractDomain(activeTab.url)} 🌐`,
				messageType: "url_share",
				meta: { title: activeTab.title || extractDomain(activeTab.url), url: activeTab.url }
			}));
		}
	});
}

// Active Friend Header Buttons
if (chatHeaderInviteBtn) {
	chatHeaderInviteBtn.addEventListener("click", () => {
		if (!activeChatPageFriend) return;
		const activeTab = tabs.find((t) => t.id === activeTabId);
		let gameTitle = "Drive Mad";
		let gameUrl = "/games/cldrivemady.html";
		if (activeTab && activeTab.isGame) {
			gameTitle = activeTab.title;
			gameUrl = activeTab.url;
		}
		sendGameInvite(activeChatPageFriend.id, gameUrl, gameTitle);
		showToast({
			icon: "🎮",
			title: "Invite Sent!",
			message: `Invited @${activeChatPageFriend.username} to play ${gameTitle}`
		});
	});
}

if (chatHeaderProfileBtn) {
	chatHeaderProfileBtn.addEventListener("click", () => {
		if (!activeChatPageFriend) return;
		showToast({
			icon: "👤",
			title: `${activeChatPageFriend.displayName || activeChatPageFriend.username}`,
			message: `@${activeChatPageFriend.username} • Role: ${activeChatPageFriend.role || 'Member'}`
		});
	});
}

// ============================================================
// ============================================================
// 🎮 Clash Lounge Controller (Multiplayer Party Rooms)
// ============================================================

let currentLoungeRoom = null;
let loungePublicRooms = [];

async function loadLoungeRooms() {
	if (!loungeRoomsGrid) return;
	if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
		presenceWs.send(JSON.stringify({ type: "lounge_get_rooms" }));
	}

	try {
		const res = await fetch("/api/lounge/rooms");
		if (res.ok) {
			const data = await res.json();
			if (data && data.rooms) {
				renderLoungeRoomsGrid(data.rooms);
			}
		}
	} catch (e) {}
}

function renderLoungeRoomsGrid(rooms) {
	if (!loungeRoomsGrid) return;
	loungePublicRooms = rooms || [];
	if (loungeActiveCount) {
		loungeActiveCount.textContent = `${loungePublicRooms.length} active`;
	}

	if (loungePublicRooms.length === 0) {
		loungeRoomsGrid.innerHTML = `<div class="lounge-empty-state">No public party rooms active right now. Click "+ Create Party Room" above to start one!</div>`;
		return;
	}

	loungeRoomsGrid.innerHTML = "";
	loungePublicRooms.forEach((r) => {
		const card = document.createElement("div");
		card.className = "lounge-room-card";
		card.innerHTML = `
			<div class="lounge-card-top">
				<div>
					<div class="lounge-card-name">${escapeHtml(r.name)}</div>
					<div class="lounge-card-host">Host: <b>@${escapeHtml(r.host?.displayName || r.host?.username || 'Host')}</b></div>
				</div>
				<span class="lounge-card-code">${escapeHtml(r.code)}</span>
			</div>
			<div class="lounge-card-game">
				<span>🎮</span> <span>${escapeHtml(r.featuredGame || 'Free Play')}</span>
			</div>
			<div class="lounge-card-bottom">
				<div class="lounge-card-members">
					<span>👥</span> <span>${r.memberCount} / ${r.maxMembers} Players</span>
				</div>
				<button class="btn btn-primary btn-sm lounge-card-join-btn" data-code="${r.code}">Join Party</button>
			</div>
		`;

		card.querySelector(".lounge-card-join-btn").addEventListener("click", () => {
			joinPartyRoom(r.code);
		});

		loungeRoomsGrid.appendChild(card);
	});
}

function joinPartyRoom(code) {
	if (!code || !code.trim()) {
		showToast({ icon: "⚠️", title: "Missing Code", message: "Please enter a valid room code." });
		return;
	}
	if (!authToken) {
		showToast({ icon: "🔒", title: "Sign In Required", message: "Please sign in to join a Clash Lounge party." });
		openAuthModal("login");
		return;
	}

	if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
		presenceWs.send(JSON.stringify({ type: "lounge_join", code: code.trim().toUpperCase() }));
	} else {
		showToast({ icon: "⚠️", title: "Connecting", message: "Connecting to game server. Please try again in a moment." });
		connectPresenceSocket();
	}
}

function handleLoungeRoomUpdate(room) {
	if (!room) return;
	currentLoungeRoom = room;

	if (loungeLobbyView) loungeLobbyView.classList.add("hidden");
	if (loungeCreateDrawer) loungeCreateDrawer.classList.add("hidden");
	if (loungeActiveRoomView) loungeActiveRoomView.classList.remove("hidden");

	if (loungeRoomTitle) loungeRoomTitle.textContent = room.name;
	if (loungeRoomCodeBadge) {
		loungeRoomCodeBadge.textContent = `${room.code} 📋`;
		loungeRoomCodeBadge.onclick = () => {
			navigator.clipboard.writeText(room.code).then(() => {
				showToast({ icon: "📋", title: "Code Copied!", message: `Room code ${room.code} copied to clipboard.` });
			}).catch(()=>{});
		};
	}

	if (loungeFeaturedGamePill) {
		loungeFeaturedGamePill.textContent = `🎮 Featured: ${room.featuredGame || 'Free Play'}`;
	}

	if (loungeMembersCount) {
		loungeMembersCount.textContent = `${room.members.length} / ${room.maxMembers}`;
	}

	// Render members list
	if (loungeMembersList) {
		loungeMembersList.innerHTML = "";
		room.members.forEach((m) => {
			const item = document.createElement("div");
			item.className = "lounge-member-card";
			const isHost = m.id === room.host?.id || m.isHost;
			const isMe = currentUser && currentUser.id === m.id;

			let joinBtnHtml = "";
			if (!isMe && m.activity && m.activity.startsWith("Playing ") && room.featuredGameUrl) {
				joinBtnHtml = `<button class="lounge-member-join-btn" data-url="${room.featuredGameUrl}">▶ Play Along</button>`;
			}

			item.innerHTML = `
				<div class="lounge-member-left">
					<div class="lounge-member-avatar ${escapeHtml(m.avatarUrl || 'avatar-1')}"></div>
					<div>
						<div class="lounge-member-name">
							<span>${escapeHtml(m.displayName || m.username)}</span>
							${isHost ? '<span class="lounge-host-crown" title="Party Host">👑</span>' : ''}
							${isMe ? '<span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">(You)</span>' : ''}
						</div>
						<div class="lounge-member-activity">● ${escapeHtml(m.activity || 'In Lounge')}</div>
					</div>
				</div>
				${joinBtnHtml}
			`;

			const joinBtn = item.querySelector(".lounge-member-join-btn");
			if (joinBtn) {
				joinBtn.addEventListener("click", () => {
					createTab(joinBtn.dataset.url, true);
				});
			}

			loungeMembersList.appendChild(item);
		});
	}
}

function handleLoungeUserJoined(data) {
	if (data.room) handleLoungeRoomUpdate(data.room);
	appendLoungeChatSystem(`👋 ${data.user?.displayName || data.user?.username || 'A player'} joined the party!`);
}

function handleLoungeUserLeft(data) {
	if (data.room) handleLoungeRoomUpdate(data.room);
	appendLoungeChatSystem(`🚪 ${data.user?.displayName || 'A player'} left the party.`);
}

function handleLoungeGameChanged(data) {
	if (data.room) handleLoungeRoomUpdate(data.room);
	appendLoungeChatSystem(`🎮 Party game updated to: ${data.featuredGame}`);
}

function appendLoungeChatMessage(msg) {
	if (!loungeChatMessages || !msg) return;
	const div = document.createElement("div");
	div.className = "lounge-chat-msg";
	const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	div.innerHTML = `
		<div class="lounge-msg-meta">
			<span class="lounge-msg-author">${escapeHtml(msg.senderName || 'Member')}</span>
			<span class="lounge-msg-time">${timeStr}</span>
		</div>
		<div class="lounge-msg-text">${escapeHtml(msg.content)}</div>
	`;
	loungeChatMessages.appendChild(div);
	loungeChatMessages.scrollTop = loungeChatMessages.scrollHeight;
}

function appendLoungeChatSystem(text) {
	if (!loungeChatMessages) return;
	const div = document.createElement("div");
	div.className = "lounge-chat-system";
	div.textContent = text;
	loungeChatMessages.appendChild(div);
	loungeChatMessages.scrollTop = loungeChatMessages.scrollHeight;
}

function resetLoungeToLobby() {
	currentLoungeRoom = null;
	if (loungeActiveRoomView) loungeActiveRoomView.classList.add("hidden");
	if (loungeLobbyView) loungeLobbyView.classList.remove("hidden");
	if (loungeChatMessages) {
		loungeChatMessages.innerHTML = '<div class="lounge-chat-system">Welcome to the Lounge Party! Chat here with your party members in real-time.</div>';
	}
	loadLoungeRooms();
}

// Lounge Event Listeners
if (loungeOpenCreateBtn) {
	loungeOpenCreateBtn.addEventListener("click", () => {
		if (!authToken) {
			showToast({ icon: "🔒", title: "Sign In Required", message: "Please sign in to create a party room." });
			openAuthModal("login");
			return;
		}
		if (loungeCreateDrawer) {
			loungeCreateDrawer.classList.toggle("hidden");
			if (!loungeCreateDrawer.classList.contains("hidden") && loungeInputName) {
				loungeInputName.focus();
			}
		}
	});
}

if (loungeCreateClose && loungeCreateDrawer) {
	loungeCreateClose.addEventListener("click", () => loungeCreateDrawer.classList.add("hidden"));
}
if (loungeCreateCancel && loungeCreateDrawer) {
	loungeCreateCancel.addEventListener("click", () => loungeCreateDrawer.classList.add("hidden"));
}

if (loungeCreateForm) {
	loungeCreateForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const name = loungeInputName.value.trim();
		const gameRaw = loungeSelectGame ? loungeSelectGame.value : "Free Play|";
		const [featuredGame, featuredGameUrl] = gameRaw.split("|");
		const maxMembers = parseInt(loungeSelectMax?.value, 10) || 8;

		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({
				type: "lounge_create",
				name,
				featuredGame,
				featuredGameUrl: featuredGameUrl || null,
				maxMembers
			}));
		} else {
			showToast({ icon: "⚠️", title: "Connection Error", message: "Connecting to server..." });
			connectPresenceSocket();
		}
	});
}

if (loungeJoinCodeBtn && loungeJoinCodeInput) {
	loungeJoinCodeBtn.addEventListener("click", () => {
		joinPartyRoom(loungeJoinCodeInput.value);
	});
	loungeJoinCodeInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			joinPartyRoom(loungeJoinCodeInput.value);
		}
	});
}

if (loungeRefreshRoomsBtn) {
	loungeRefreshRoomsBtn.addEventListener("click", () => {
		loadLoungeRooms();
		showToast({ icon: "🔄", title: "Refreshed", message: "Party rooms list updated." });
	});
}

if (loungeLeaveRoomBtn) {
	loungeLeaveRoomBtn.addEventListener("click", () => {
		if (confirm("Leave this party room?")) {
			if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
				presenceWs.send(JSON.stringify({ type: "lounge_leave" }));
			}
			resetLoungeToLobby();
		}
	});
}

if (loungeLaunchGameBtn) {
	loungeLaunchGameBtn.addEventListener("click", () => {
		if (currentLoungeRoom && currentLoungeRoom.featuredGameUrl) {
			createTab(currentLoungeRoom.featuredGameUrl, true);
		} else {
			const gamesNav = document.getElementById("nav-games");
			if (gamesNav) gamesNav.click();
		}
	});
}

if (loungeChatForm && loungeChatInput) {
	loungeChatForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const content = loungeChatInput.value.trim();
		if (!content) return;
		if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
			presenceWs.send(JSON.stringify({ type: "lounge_chat", content }));
			loungeChatInput.value = "";
		}
	});
}

// ============================================================
// ⚡ Game Controls Modal Controller (Streamlined)
// ============================================================

let currentGameKey = "clash_general";
let currentGameSpeed = 1.0;
let isFpsMonitorActive = false;
let isAutoClickerActive = false;
let autoClickerInterval = null;

function openGameToolkit() {
	if (!gameToolkitModal) return;
	const activeTab = tabs.find(t => t.id === activeTabId);
	if (toolkitActiveGamePill) {
		toolkitActiveGamePill.textContent = activeTab ? (activeTab.title || "Active Tab") : "No Active Tab";
	}
	gameToolkitModal.classList.remove("hidden");
}

function closeGameToolkit() {
	if (gameToolkitModal) gameToolkitModal.classList.add("hidden");
}

if (navToolkitBtn) navToolkitBtn.addEventListener("click", openGameToolkit);
if (gameToolkitModalClose) gameToolkitModalClose.addEventListener("click", closeGameToolkit);
if (gameToolkitModal) {
	gameToolkitModal.addEventListener("click", (e) => {
		if (e.target === gameToolkitModal) closeGameToolkit();
	});
}


// Speed Controller & Game Tweaks
// ============================================================
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

			// Helper for userscripts to adjust speed on the fly
			iframeWin.setClashSpeed = function(newSpeed) {
				iframeWin.__clashSpeed = newSpeed;
			};
		}
	} catch (e) {
		console.warn("[Clash Speed Hook] Hook error:", e);
	}
}

function injectConsentDismisser(iframe) {
	if (!iframe || iframe.dataset.consentWatch === "1") return;
	iframe.dataset.consentWatch = "1";
	const consentTags = ["ytd-consent-bump-v2-lightbox", "ytd-consent-bump-v2-renderer", "ytd-consent-bump-v2-renderer-alignment", "ytd-cookie-dialog-renderer", "ytd-consent-bump-v2"];
	const tick = () => {
		try {
			const d = iframe.contentDocument;
			const w = iframe.contentWindow;
			if (!d || !d.documentElement || !w) return;
			const host = (w.location && w.location.hostname) || "";
			if (host.includes("consent.youtube.com") || host.includes("consent.google.com")) {
				if (!d.getElementById("clash-consent-clicked")) {
					const btns = d.querySelectorAll("button, input[type=submit], [role=button]");
					for (const b of btns) {
						const label = ((b.textContent || b.value || "") + "").trim();
						if (label === "Accept all" || label === "I agree") {
							const marker = d.createElement("meta");
							marker.id = "clash-consent-clicked";
							(d.head || d.documentElement).appendChild(marker);
							b.click();
							break;
						}
					}
				}
				return;
			}
			for (const tag of consentTags) {
				const el = d.querySelector(tag);
				if (el) el.style.setProperty("display", "none", "important");
			}
			const dialogs = d.querySelectorAll("tp-yt-paper-dialog, [role=dialog], ytd-popup-container");
			for (const dlg of dialogs) {
				const txt = dlg.textContent || "";
				if (txt.includes("Before you continue to YouTube") || (txt.includes("Before you continue") && txt.includes("Reject all") && txt.includes("Accept all"))) {
					let node = dlg;
					let guard = 0;
					while (node.parentNode && guard++ < 8) {
						const pname = ((node.parentNode.tagName || "") + "").toLowerCase();
						if (pname.startsWith("ytd-consent") || pname === "tp-yt-paper-dialog" || pname === "ytd-popup-container") node = node.parentNode;
						else break;
					}
					node.style.setProperty("display", "none", "important");
				}
			}
			const rich = d.querySelectorAll("ytd-rich-section-renderer");
			for (const r of rich) {
				if ((r.textContent || "").includes("Your YouTube History is off")) r.style.setProperty("display", "none", "important");
			}
		} catch (e) {}
	};
	setInterval(tick, 400);
	tick();
}

// Speed Button Clicks
speedButtons.forEach(btn => {
	btn.addEventListener("click", () => {
		speedButtons.forEach(b => b.classList.remove("active"));
		btn.classList.add("active");
		currentGameSpeed = parseFloat(btn.dataset.speed) || 1.0;

		const activeTab = tabs.find(t => t.id === activeTabId);
		if (activeTab && activeTab.iframe && activeTab.iframe.contentWindow) {
			injectGameSpeedHook(activeTab.iframe.contentWindow, currentGameSpeed);
			showToast({ icon: "⚡", title: "Speed Changed", message: `Game engine running at ${currentGameSpeed}x speed!` });
		}
	});
});

// Force Dark Mode Tweak
if (tweakToggleDarkmode) {
	tweakToggleDarkmode.addEventListener("change", () => {
		const activeTab = tabs.find(t => t.id === activeTabId);
		if (!activeTab || !activeTab.iframe) return;
		try {
			const doc = activeTab.iframe.contentDocument;
			if (tweakToggleDarkmode.checked) {
				const style = doc.createElement("style");
				style.id = "clash-tamper-darkmode";
				style.textContent = `html, body { background: #0c0b14 !important; color: #e2e8f0 !important; } * { border-color: rgba(255,255,255,0.1) !important; }`;
				doc.head.appendChild(style);
			} else {
				const s = doc.getElementById("clash-tamper-darkmode");
				if (s) s.remove();
			}
		} catch (e) {}
	});
}

// Rapid Auto-Clicker Tweak
if (tweakToggleAutoclick) {
	tweakToggleAutoclick.addEventListener("change", () => {
		const activeTab = tabs.find(t => t.id === activeTabId);
		if (!activeTab || !activeTab.iframe) return;
		try {
			const doc = activeTab.iframe.contentDocument;
			if (tweakToggleAutoclick.checked) {
				let mouseX = 100, mouseY = 100;
				doc.addEventListener("mousemove", (e) => { mouseX = e.clientX; mouseY = e.clientY; });
				autoClickerInterval = activeTab.iframe.contentWindow.setInterval(() => {
					const el = doc.elementFromPoint(mouseX, mouseY);
					if (el) el.click();
				}, 50);
				showToast({ icon: "🤖", title: "Auto-Clicker Active", message: "Auto-clicking enabled (50ms interval)!" });
			} else {
				if (autoClickerInterval) {
					activeTab.iframe.contentWindow.clearInterval(autoClickerInterval);
					autoClickerInterval = null;
				}
				showToast({ icon: "🛑", title: "Auto-Clicker Stopped", message: "Auto-clicking disabled." });
			}
		} catch (e) {}
	});
}

// Cloak Presets
const CLOAK_CONFIGS = {
	default: { title: "Clash Proxy — Unrestricted Web & Arcade", icon: "/logo.png" },
	google: { title: "Google", icon: "https://www.google.com/favicon.ico" },
	drive: { title: "Google Drive", icon: "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png" },
	classroom: { title: "Classes", icon: "https://ssl.gstatic.com/classroom/favicon.png" },
	canvas: { title: "Dashboard", icon: "https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico" }
};

function applyCloak(cloakKey) {
	const conf = CLOAK_CONFIGS[cloakKey] || CLOAK_CONFIGS.default;
	document.title = conf.title;
	let favicon = document.querySelector("link[rel*='icon']");
	if (favicon) favicon.href = conf.icon;

	cloakBtns.forEach(btn => {
		btn.classList.toggle("active", btn.dataset.cloak === cloakKey);
	});
}

// ============================================================
// 👻 About:Blank Cloaking Controller
// ============================================================

function launchAboutBlankCloak(customDecoy) {
	const decoy = customDecoy || 
		(settingAboutBlankDecoyUrl ? settingAboutBlankDecoyUrl.value.trim() : null) || 
		localStorage.getItem("clash_aboutblank_decoy") || 
		"https://classroom.google.com";

	try {
		localStorage.setItem("clash_aboutblank_decoy", decoy);
	} catch(e) {}

	const win = window.open("about:blank", "_blank");
	if (!win) {
		showToast({
			icon: "⚠️",
			title: "Popup Blocked",
			message: "Please allow popups so Clash Proxy can launch in an about:blank window.",
			type: "error"
		});
		return;
	}

	const doc = win.document;
	const activeCloakKey = localStorage.getItem("clash_active_cloak") || "default";
	const conf = CLOAK_CONFIGS[activeCloakKey] || CLOAK_CONFIGS.default;
	doc.title = conf.title;

	let link = doc.createElement("link");
	link.rel = "shortcut icon";
	link.href = conf.icon;
	doc.head.appendChild(link);

	const iframe = doc.createElement("iframe");
	iframe.src = window.location.href;
	iframe.style.position = "fixed";
	iframe.style.top = "0";
	iframe.style.left = "0";
	iframe.style.width = "100vw";
	iframe.style.height = "100vh";
	iframe.style.border = "none";
	iframe.style.margin = "0";
	iframe.style.padding = "0";
	iframe.style.overflow = "hidden";
	iframe.style.zIndex = "999999";

	doc.body.style.margin = "0";
	doc.body.style.padding = "0";
	doc.body.style.overflow = "hidden";
	doc.body.appendChild(iframe);

	// Immediately replace the original tab with the decoy site!
	window.location.replace(decoy);
}

function initAboutBlankCloakSettings() {
	const savedDecoy = localStorage.getItem("clash_aboutblank_decoy") || "https://classroom.google.com";
	if (settingAboutBlankDecoyUrl) {
		settingAboutBlankDecoyUrl.value = savedDecoy;
	}

	if (settingAboutBlankAuto) {
		settingAboutBlankAuto.checked = localStorage.getItem("clash_aboutblank_auto") === "true";
		settingAboutBlankAuto.addEventListener("change", (e) => {
			localStorage.setItem("clash_aboutblank_auto", e.target.checked ? "true" : "false");
			showToast({
				icon: "⚡",
				title: "Auto-Cloak",
				message: e.target.checked ? "Auto About:Blank enabled for future sessions." : "Auto About:Blank disabled."
			});
		});
	}

	if (settingAboutBlankLaunchBtn) {
		settingAboutBlankLaunchBtn.addEventListener("click", () => launchAboutBlankCloak());
	}

	if (navAboutBlankBtn) {
		navAboutBlankBtn.addEventListener("click", () => launchAboutBlankCloak());
	}

	aboutBlankPresetBtns.forEach(btn => {
		btn.addEventListener("click", () => {
			aboutBlankPresetBtns.forEach(b => b.classList.remove("active"));
			btn.classList.add("active");
			const url = btn.dataset.url;
			if (settingAboutBlankDecoyUrl) {
				settingAboutBlankDecoyUrl.value = url;
			}
			localStorage.setItem("clash_aboutblank_decoy", url);
		});
	});

	// Check Auto About:Blank on startup
	try {
		const autoCloak = localStorage.getItem("clash_aboutblank_auto") === "true";
		if (autoCloak && window.self === window.top) {
			const decoy = localStorage.getItem("clash_aboutblank_decoy") || "https://classroom.google.com";
			launchAboutBlankCloak(decoy);
		}
	} catch(e) {}
}

initAboutBlankCloakSettings();



cloakBtns.forEach(btn => {
	btn.addEventListener("click", () => {
		const cloak = btn.dataset.cloak;
		applyCloak(cloak);
		if (authToken) {
			fetch("/api/profile", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({ settings: { cloak } })
			}).catch(()=>{});
		}
	});
});

themeBtns.forEach(btn => {
	btn.addEventListener("click", () => {
		const theme = btn.dataset.theme;
		document.body.className = "";
		if (theme !== "neon-purple") {
			document.body.classList.add(`theme-${theme}`);
		}
		themeBtns.forEach(b => b.classList.toggle("active", b.dataset.theme === theme));

		if (authToken) {
			fetch("/api/profile", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({ settings: { theme } })
			}).catch(()=>{});
		}
	});
});

// ============================================================
// Modals (Auth & Edit Profile)
// ============================================================

function openAuthModal(tab = "login") {
	if (!authModal) return;
	authModal.classList.remove("hidden");
	switchAuthTab(tab);
}

function closeAuthModal() {
	if (authModal) authModal.classList.add("hidden");
}

function switchAuthTab(tab) {
	if (tab === "login") {
		tabLoginBtn.classList.add("active");
		tabRegisterBtn.classList.remove("active");
		loginForm.classList.remove("hidden");
		registerForm.classList.add("hidden");
		if (loginUsernameInput) setTimeout(() => loginUsernameInput.focus(), 50);
	} else {
		tabRegisterBtn.classList.add("active");
		tabLoginBtn.classList.remove("active");
		registerForm.classList.remove("hidden");
		loginForm.classList.add("hidden");
		if (regUsernameInput) setTimeout(() => regUsernameInput.focus(), 50);
	}
}

if (tabLoginBtn) tabLoginBtn.addEventListener("click", () => switchAuthTab("login"));
if (tabRegisterBtn) tabRegisterBtn.addEventListener("click", () => switchAuthTab("register"));
if (authModalClose) authModalClose.addEventListener("click", closeAuthModal);

if (loginForm) {
	loginForm.addEventListener("submit", (e) => {
		e.preventDefault();
		loginUser(loginUsernameInput.value, loginPasswordInput.value);
	});
}

if (registerForm) {
	registerForm.addEventListener("submit", (e) => {
		e.preventDefault();
		registerUser(regUsernameInput.value, regPasswordInput.value, regDisplayNameInput.value);
	});
}

// Edit Profile Modal
let selectedAvatar = "avatar-1";

function openProfileModal() {
	if (!profileModal || !currentUser) return;
	selectedAvatar = currentUser.avatar_url || "avatar-1";
	if (editDisplayNameInput) editDisplayNameInput.value = currentUser.display_name || currentUser.username;
	if (editBioInput) editBioInput.value = currentUser.bio || "";

	avatarOptions.forEach(opt => {
		opt.classList.toggle("selected", opt.dataset.avatar === selectedAvatar);
	});

	profileModal.classList.remove("hidden");
}

function closeProfileModal() {
	if (profileModal) profileModal.classList.add("hidden");
}

if (profileModalClose) profileModalClose.addEventListener("click", closeProfileModal);

avatarOptions.forEach(opt => {
	opt.addEventListener("click", () => {
		avatarOptions.forEach(o => o.classList.remove("selected"));
		opt.classList.add("selected");
		selectedAvatar = opt.dataset.avatar;
	});
});

if (editProfileForm) {
	editProfileForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!authToken) return;

		const displayName = editDisplayNameInput.value.trim();
		const bio = editBioInput.value.trim();

		try {
			const res = await fetch("/api/profile", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({
					display_name: displayName,
					avatar_url: selectedAvatar,
					bio: bio
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Save failed");

			currentUser = data.user;
	window.__myRankCache = null;
			closeProfileModal();
			renderUserHeader();
			renderProfilePage();
			showToast({ icon: "💾", title: "Saved", message: "Profile updated successfully!" });
		} catch (err) {
			showToast({ icon: "⚠️", title: "Error", message: err.message });
		}
	});
}

// ============================================================
// Toast Notification Engine
// ============================================================

function showToast({ icon = "🔔", title = "Notification", message = "", type = "", actionText = "", onAction = null, duration = 4500 }) {
	if (!toastContainer) return;

	const toast = document.createElement("div");
	toast.className = `toast ${type}`;
	toast.innerHTML = `
		<div class="toast-icon">${icon}</div>
		<div class="toast-body">
			<div class="toast-title">${escapeHtml(title)}</div>
			${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
		</div>
		${actionText ? `<button class="toast-action-btn">${escapeHtml(actionText)}</button>` : ''}
	`;

	if (actionText && onAction) {
		const actBtn = toast.querySelector(".toast-action-btn");
		if (actBtn) {
			actBtn.addEventListener("click", () => {
				onAction();
				toast.remove();
			});
		}
	}

	toastContainer.appendChild(toast);

	setTimeout(() => {
		toast.style.transition = "opacity 0.4s, transform 0.4s";
		toast.style.opacity = "0";
		toast.style.transform = "translateX(50px)";
		setTimeout(() => toast.remove(), 400);
	}, duration);
}

// ============================================================
// Arcade Games Library Logic
// ============================================================

let allGames = [];
let currentDisplayList = [];
let renderedCount = 0;
const BATCH_SIZE = 150;

async function loadGamesLibrary() {
	try {
		const res = await fetch("/api/games");
		if (!res.ok) throw new Error("Failed to load games list");
		const data = await res.json();
		allGames = Array.isArray(data) ? data : (data.games || []);
		
		if (gamesCountBadge) {
			gamesCountBadge.textContent = `${allGames.length.toLocaleString()}`;
		}
		
		renderGames(allGames);
	} catch (err) {
		console.error("Games fetch error:", err);
		if (gamesGrid) {
			gamesGrid.innerHTML = `<div class="games-loading">Failed to load games list. Make sure the server is running.</div>`;
		}
	}
}

function renderGames(gamesList, reset = true) {
	if (!gamesGrid) return;
	if (reset) {
		currentDisplayList = gamesList;
		renderedCount = 0;
		gamesGrid.innerHTML = "";
	}
	if (currentDisplayList.length === 0) {
		gamesGrid.innerHTML = `<div class="games-loading">No games found matching your search.</div>`;
		return;
	}

	const batch = currentDisplayList.slice(renderedCount, renderedCount + BATCH_SIZE);
	if (batch.length === 0) return;

	const fragment = document.createDocumentFragment();
	batch.forEach(game => {
		const card = document.createElement("div");
		card.className = "game-card";
		card.dataset.gameUrl = game.url;
		card.dataset.gameTitle = game.title;
		card.innerHTML = `
			<div class="game-card-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="6" y1="12" x2="10" y2="12"></line>
					<line x1="8" y1="10" x2="8" y2="14"></line>
					<circle cx="15" cy="13" r="1"></circle>
					<circle cx="17.5" cy="10.5" r="1"></circle>
					<path d="M18.7 18.7a8.5 8.5 0 0 0 2.3-5.7v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2a8.5 8.5 0 0 0 2.3 5.7L7 21h10l1.7-2.3z"></path>
				</svg>
			</div>
			<span class="game-card-title">${escapeHtml(game.title)}</span>
			<button class="game-card-aboutblank-btn" title="Open in about:blank">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
					<polyline points="15 3 21 3 21 9"></polyline>
					<line x1="10" y1="14" x2="21" y2="3"></line>
				</svg>
				about:blank
			</button>
		`;
		card.addEventListener("click", (e) => {
			if (e.target.closest(".game-card-aboutblank-btn")) {
				e.stopPropagation();
				if (game.url) openAboutBlank(game.url);
			} else {
				if (game.url) createTab(game.url, true);
			}
		});
		fragment.appendChild(card);
	});

	gamesGrid.appendChild(fragment);
	renderedCount += batch.length;
}

window.addEventListener("scroll", () => {
	if (renderedCount < currentDisplayList.length) {
		if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
			renderGames(currentDisplayList, false);
		}
	}
});

if (gamesSearchInput) {
	gamesSearchInput.addEventListener("input", (e) => {
		const query = e.target.value.toLowerCase().trim();
		if (!query) {
			renderGames(allGames);
			return;
		}
		const filtered = allGames.filter(g => 
			g.title.toLowerCase().includes(query) || 
			g.filename.toLowerCase().includes(query)
		);
		renderGames(filtered);
	});
}

// Load games library
loadGamesLibrary();

// ============================================================
// Error & Status Display
// ============================================================

function setStatus(state, msg) {
	if (!statusDot || !statusText) return;
	statusDot.className = "status-dot " + state;
	statusText.textContent = msg;
}

function showError(msg) {
	if (proxyErrorMessage) proxyErrorMessage.textContent = msg;
	if (proxyError) proxyError.classList.remove("hidden");
}

function hideError() {
	if (proxyError) proxyError.classList.add("hidden");
}

// ============================================================
// Sidebar Navigation
// ============================================================

function openSidebar() {
	if (sidebar) sidebar.classList.add("open");
	if (sidebarOverlay) sidebarOverlay.classList.add("active");
}

function closeSidebar() {
	if (sidebar) sidebar.classList.remove("open");
	if (sidebarOverlay) sidebarOverlay.classList.remove("active");
}

if (sidebarToggleBtn) {
	sidebarToggleBtn.onclick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		openSidebar();
	};
	sidebarToggleBtn.addEventListener("click", openSidebar);
}
if (sidebarCloseBtn) {
	sidebarCloseBtn.onclick = (e) => {
		e.preventDefault();
		closeSidebar();
	};
	sidebarCloseBtn.addEventListener("click", closeSidebar);
}
if (sidebarOverlay) {
	sidebarOverlay.onclick = (e) => {
		e.preventDefault();
		closeSidebar();
	};
	sidebarOverlay.addEventListener("click", closeSidebar);
}

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") {
		closeSidebar();
		closeAuthModal();
		closeProfileModal();
	}
});

sidebarLinks.forEach((link) => {
	link.addEventListener("click", (e) => {
		e.preventDefault();
		const targetPage = link.dataset.page;

		// Owner Panel opens INSIDE the site (server proxies it, owner-gated)
		if (targetPage === "owner-panel") {
			e.stopPropagation();
			closeSidebar();
			location.href = "/panel/?token=" + encodeURIComponent(authToken || "");
			return;
		}

		document.querySelectorAll(".sidebar-link").forEach((l) => l.classList.remove("active"));
		link.classList.add("active");

		pages.forEach((p) => p.classList.remove("active"));
		const page = document.getElementById(`page-${targetPage}`);
		if (page) page.classList.add("active");

		if (targetPage === "games" || targetPage === "settings" || targetPage === "profile" || targetPage === "friends" || targetPage === "leaderboard" || targetPage === "lounge" || targetPage === "chat") {
			framesContainer.classList.add("hidden");
			browserChrome.classList.add("hidden");
			mainContent.classList.remove("hidden");
			mainContent.classList.remove("new-tab-mode");
		}

		if (targetPage === "profile") renderProfilePage();
		if (targetPage === "friends") loadFriends();
		if (targetPage === "leaderboard") loadLeaderboard();
		if (targetPage === "lounge") loadLoungeRooms();
		if (targetPage === "chat") {
			closeChatDrawer();
			loadChatConversations();
		}

		closeSidebar();
	});
});

// ============================================================
// Keyboard Shortcuts
// ============================================================

document.addEventListener("keydown", (e) => {
	if (!e || !e.key) return;
	const onSearchPage = !mainContent.classList.contains("hidden");
	if (
		onSearchPage &&
		e.key.length === 1 &&
		!e.ctrlKey && !e.metaKey && !e.altKey &&
		document.activeElement !== proxyInput &&
		document.activeElement !== navUrlInput &&
		document.activeElement !== gamesSearchInput &&
		document.activeElement !== friendUsernameInput &&
		document.activeElement.tagName !== "INPUT" &&
		document.activeElement.tagName !== "TEXTAREA"
	) {
		if (proxyInput) proxyInput.focus();
	}

	if (e.ctrlKey && e.key === "l" && !browserChrome.classList.contains("hidden")) {
		e.preventDefault();
		navUrlInput.focus();
		navUrlInput.select();
	}

	if (e.ctrlKey && e.key === "t") {
		e.preventDefault();
		createTab();
	}

	if (e.ctrlKey && e.key === "w" && activeTabId) {
		e.preventDefault();
		closeTab(activeTabId);
	}

	if (e.key === "F11") {
		e.preventDefault();
		toggleFullscreen();
	}
});

// ============================================================
// Utility Functions
// ============================================================

function extractDomain(url) {
	try {
		return new URL(url).hostname;
	} catch {
		return url.substring(0, 30);
	}
}

function escapeHtml(str) {
	if (!str) return "";
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

// Initialize Auth on startup
initAuth();

// Initialize Clash Shield UI
updateShieldUI();

// Initialize Bookmarks & Speed Dial
loadBookmarks();
