"use strict";

// ============================================================
// DOM References
// ============================================================
const mainContent = document.getElementById("main-content");
const proxyForm = document.getElementById("proxy-form");
const proxyInput = document.getElementById("proxy-input");
const proxyError = document.getElementById("proxy-error");
const proxyErrorMessage = document.getElementById("proxy-error-message");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

const browserChrome = document.getElementById("browser-chrome");
const tabList = document.getElementById("tab-list");
const newTabBtn = document.getElementById("new-tab-btn");
const framesContainer = document.getElementById("frames-container");

const navBackBtn = document.getElementById("nav-back-btn");
const navForwardBtn = document.getElementById("nav-forward-btn");
const navRefreshBtn = document.getElementById("nav-refresh-btn");
const navHomeBtn = document.getElementById("nav-home-btn");
const navFullscreenBtn = document.getElementById("nav-fullscreen-btn");
const fullscreenIconEnter = document.getElementById("fullscreen-icon-enter");
const fullscreenIconExit = document.getElementById("fullscreen-icon-exit");
const navUrlInput = document.getElementById("nav-url-input");
const navSidebarBtn = document.getElementById("nav-sidebar-btn");

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const sidebarLinks = document.querySelectorAll(".sidebar-link:not(.disabled)");
const pages = document.querySelectorAll(".page");

// Games
const gamesGrid = document.getElementById("games-grid");
const gamesSearch = document.getElementById("games-search");
const gamesCount = document.getElementById("games-count");
const theater = document.getElementById("theater");
const theaterFrame = document.getElementById("theater-frame");
const theaterTitle = document.getElementById("theater-title");
const theaterClose = document.getElementById("theater-close");
const theaterFullscreen = document.getElementById("theater-fullscreen");
let currentGame = null;

// ============================================================
// Scramjet Init
// ============================================================
let controller = null;
let transport = null;
let transportReady = false;
let initFailed = false;

async function initScramjet() {
	setStatus("loading", "Loading transport...");
	const EpoxyTransport = (await import(_CONFIG.transportUrl)).default;
	transport = new EpoxyTransport({ wisp: _CONFIG.wispUrl });
	await transport.init();
	transportReady = true;

	setStatus("loading", "Registering service worker...");
	const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
	await navigator.serviceWorker.ready;

	// If the page is not yet controlled by the service worker, reload to establish control
	if (!navigator.serviceWorker.controller) {
		const reloaded = sessionStorage.getItem("clash_sw_reloaded");
		if (!reloaded) {
			sessionStorage.setItem("clash_sw_reloaded", "true");
			console.log("[Clash Proxy] Reloading to establish service worker control...");
			location.reload();
			return new Promise(() => {}); // Halt execution while reloading
		} else {
			console.warn("[Clash Proxy] Service worker not controlling page even after reload.");
		}
	} else {
		sessionStorage.removeItem("clash_sw_reloaded");
	}

	setStatus("loading", "Initializing proxy engine...");
	controller = new $scramjetController.Controller({
		serviceworker: navigator.serviceWorker.controller || reg.active,
		transport,
		config: _CONFIG.controllerConfig,
	});

	await controller.wait();
	console.log("[Clash Proxy] Scramjet v2 initialized");
	setStatus("ready", "Ready — Enter a URL or search query");
}

let initPromise = initScramjet().catch((err) => {
	console.error("[Clash Proxy] Init failed:", err);
	initFailed = true;
	setStatus("error", "Failed to initialize proxy engine");
	showRetryButton();
});

function showRetryButton() {
	const statusBar = document.querySelector(".status-bar");
	if (!statusBar) return;

	// Remove any existing retry button
	const existing = statusBar.querySelector(".retry-btn");
	if (existing) existing.remove();

	const retryBtn = document.createElement("button");
	retryBtn.className = "retry-btn";
	retryBtn.textContent = "Retry";
	retryBtn.style.cssText = `
		margin-left: 8px;
		padding: 4px 14px;
		border-radius: 999px;
		border: 1px solid rgba(108, 92, 231, 0.4);
		background: rgba(108, 92, 231, 0.15);
		color: #a29bfe;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	`;
	retryBtn.addEventListener("mouseenter", () => {
		retryBtn.style.background = "rgba(108, 92, 231, 0.3)";
	});
	retryBtn.addEventListener("mouseleave", () => {
		retryBtn.style.background = "rgba(108, 92, 231, 0.15)";
	});
	retryBtn.addEventListener("click", () => {
		retryBtn.remove();
		initFailed = false;
		initPromise = initScramjet().catch((err) => {
			console.error("[Clash Proxy] Init retry failed:", err);
			initFailed = true;
			setStatus("error", "Failed to initialize proxy engine");
			showRetryButton();
		});
	});
	statusBar.appendChild(retryBtn);
}

// ============================================================
// Tab System
// ============================================================
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;
let newTabPending = null;

// Interval for polling iframe title/URL changes
let tabPollInterval = null;

function startTabPolling() {
	if (tabPollInterval) return;
	tabPollInterval = setInterval(pollActiveTabs, 800);
}

function stopTabPolling() {
	if (tabPollInterval) {
		clearInterval(tabPollInterval);
		tabPollInterval = null;
	}
}

function pollActiveTabs() {
	let changed = false;

	for (const tab of tabs) {
		if (!tab.iframe || tab.isNewTab) continue;

		try {
			const iframeDoc = tab.iframe.contentDocument || tab.iframe.contentWindow?.document;
			if (iframeDoc) {
				// Update title from the proxied page
				const pageTitle = iframeDoc.title;
				if (pageTitle && pageTitle !== tab.title && pageTitle.length > 0) {
					tab.title = pageTitle;
					changed = true;
				}
			}
		} catch (e) {
			// Cross-origin — can't access contentDocument, that's fine
		}
	}

	if (changed) {
		renderTabs();
	}

	// Update nav button states
	updateNavButtonStates();
}

function updateNavButtonStates() {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (!tab || !tab.iframe || tab.isNewTab) {
		navBackBtn.disabled = true;
		navForwardBtn.disabled = true;
		return;
	}

	// Back/Forward are always enabled when we have a proxied frame
	// (we can't reliably check history length from parent due to cross-origin)
	navBackBtn.disabled = false;
	navForwardBtn.disabled = false;
}

async function createTab(url) {
	const id = `tab-${++tabIdCounter}`;

	const tab = {
		id,
		title: url ? "Loading..." : "New Tab",
		url: url || "",
		frame: null,
		iframe: null,
		isNewTab: !url,
		isLoading: false,
	};

	tabs.push(tab);
	switchToTab(id);
	renderTabs();

	if (url) {
		await navigateTab(id, url);
	} else {
		newTabPending = id;
		showNewTabPage();
	}
}

async function navigateTab(tabId, rawInput) {
	const tab = tabs.find((t) => t.id === tabId);
	if (!tab) return;

	try {
		if (initFailed) {
			showError("Proxy engine failed to initialize. Click Retry to try again.");
			return;
		}

		setStatus("loading", "Initializing proxy engine...");
		await initPromise;

		const url = search(rawInput, _CONFIG.searchEngine);
		tab.url = url;
		tab.isNewTab = false;
		tab.isLoading = true;
		newTabPending = null;

		// Tear down old iframe if re-navigating
		if (tab.iframe) {
			tab.iframe.removeEventListener("load", tab._onLoad);
			tab.iframe.remove();
			tab.iframe = null;
			tab.frame = null;
		}

		setStatus("loading", "Creating session...");
		const frame = controller.createFrame();
		frame.element.classList.add("proxy-iframe");
		frame.element.dataset.tabId = tabId;
		frame.element.setAttribute("allow", "autoplay; fullscreen; microphone; camera; display-capture; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; gamepad");

		tab.frame = frame;
		tab.iframe = frame.element;

		// Set initial title from domain
		tab.title = extractDomain(url);
		renderTabs();
		updateNavUrl(url);

		// Listen for load events to update title/URL and hide loading status
		tab._onLoad = function () {
			tab.isLoading = false;

			try {
				const iframeDoc = tab.iframe.contentDocument || tab.iframe.contentWindow?.document;
				if (iframeDoc && iframeDoc.title) {
					tab.title = iframeDoc.title;
					renderTabs();
				}
			} catch (e) {
				// Cross-origin, title stays as domain
			}

			// Only hide status if this is the active tab
			if (tab.id === activeTabId) {
				hideStatus();
			}

			updateNavButtonStates();
		};
		tab.iframe.addEventListener("load", tab._onLoad);

		framesContainer.appendChild(tab.iframe);

		setStatus("loading", "Navigating...");
		frame.go(url);

		showBrowserView();
		showActiveFrame();

		// Start polling for title/URL changes
		startTabPolling();

		// Set a fallback to hide the loading status after a timeout
		// in case the load event doesn't fire (e.g. streaming content)
		setTimeout(() => {
			if (tab.isLoading && tab.id === activeTabId) {
				tab.isLoading = false;
				hideStatus();
			}
		}, 15000);

	} catch (err) {
		console.error("[Clash Proxy] Navigation error:", err);
		tab.title = "Error";
		tab.isNewTab = false;
		tab.isLoading = false;
		renderTabs();

		// Show user-friendly error messages
		const friendlyMsg = getFriendlyErrorMessage(err);
		setStatus("error", friendlyMsg);
		showError(friendlyMsg);
	}
}

function getFriendlyErrorMessage(err) {
	const msg = err?.message || String(err) || "";
	const lower = msg.toLowerCase();

	if (lower.includes("version mismatch")) {
		return "Proxy engine version conflict. Try clearing your browser cache and refreshing.";
	}
	if (lower.includes("not loaded") || lower.includes("not ready")) {
		return "Proxy engine is still loading. Please wait a moment and try again.";
	}
	if (lower.includes("not found") || lower.includes("404")) {
		return "The requested page could not be found.";
	}
	if (lower.includes("network") || lower.includes("fetch") || lower.includes("dns")) {
		return "Network error — could not reach the target site. Check your connection.";
	}
	if (lower.includes("timeout") || lower.includes("timed out")) {
		return "Connection timed out. The target site may be slow or unavailable.";
	}
	if (lower.includes("refused") || lower.includes("blocked")) {
		return "Connection was refused or blocked by the target site.";
	}
	if (lower.includes("ssl") || lower.includes("certificate") || lower.includes("tls")) {
		return "SSL/TLS error connecting to the target site.";
	}

	// Fallback: show the actual error but truncated
	if (msg.length > 120) {
		return "Failed to load: " + msg.substring(0, 120) + "…";
	}
	return "Failed to load: " + (msg || "Unknown error");
}

function switchToTab(tabId) {
	activeTabId = tabId;
	const tab = tabs.find((t) => t.id === tabId);

	renderTabs();

	if (tab && tab.isNewTab) {
		newTabPending = tabId;
		showNewTabPage();
	} else if (tab && tab.url) {
		newTabPending = null;
		showBrowserView();
		showActiveFrame();
		updateNavUrl(tab.url);

		// Update status based on tab loading state
		if (tab.isLoading) {
			setStatus("loading", "Loading...");
		} else {
			hideStatus();
		}
	}

	updateNavButtonStates();
}

function closeTab(tabId) {
	const idx = tabs.findIndex((t) => t.id === tabId);
	if (idx === -1) return;

	const tab = tabs[idx];

	if (tab.iframe) {
		if (tab._onLoad) {
			tab.iframe.removeEventListener("load", tab._onLoad);
		}
		tab.iframe.remove();
	}

	tabs.splice(idx, 1);

	if (tabs.length === 0) {
		activeTabId = null;
		newTabPending = null;
		stopTabPolling();
		showLandingPage();
		return;
	}

	if (activeTabId === tabId) {
		const newIdx = Math.min(idx, tabs.length - 1);
		switchToTab(tabs[newIdx].id);
	}

	renderTabs();
}

function renderTabs() {
	tabList.innerHTML = "";

	tabs.forEach((tab) => {
		const tabEl = document.createElement("div");
		tabEl.className = `tab${tab.id === activeTabId ? " active" : ""}`;
		tabEl.dataset.tabId = tab.id;

		const titleText = tab.isLoading ? "⏳ " + escapeHtml(tab.title) : escapeHtml(tab.title);

		tabEl.innerHTML = `
			<span class="tab-title">${titleText}</span>
			<span class="tab-close" data-close-tab="${tab.id}">&times;</span>
		`;

		tabEl.addEventListener("click", (e) => {
			if (e.target.classList.contains("tab-close")) return;
			switchToTab(tab.id);
		});

		const closeBtn = tabEl.querySelector(".tab-close");
		closeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			closeTab(tab.id);
		});

		tabList.appendChild(tabEl);
	});
}

function showActiveFrame() {
	const iframes = framesContainer.querySelectorAll("iframe");
	iframes.forEach((f) => {
		f.classList.toggle("active", f.dataset.tabId === activeTabId);
	});
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
	iframes.forEach((f) => f.classList.remove("active"));

	navUrlInput.value = "";
	proxyInput.value = "";
	setTimeout(() => proxyInput.focus(), 50);
}

function showLandingPage() {
	mainContent.classList.remove("hidden");
	mainContent.classList.remove("new-tab-mode");
	browserChrome.classList.add("hidden");
	framesContainer.classList.add("hidden");
	proxyInput.value = "";
	activeTabId = null;
	newTabPending = null;
	tabs = [];
	renderTabs();
	hideError();
	hideStatus();
	setTimeout(() => proxyInput.focus(), 50);
}

// ============================================================
// Navigation Bar Event Handlers
// ============================================================
navBackBtn.addEventListener("click", () => {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab && tab.frame) {
		tab.frame.back();
	}
});

navForwardBtn.addEventListener("click", () => {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab && tab.frame) {
		tab.frame.forward();
	}
});

navRefreshBtn.addEventListener("click", () => {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab && tab.frame) {
		tab.isLoading = true;
		setStatus("loading", "Reloading...");
		renderTabs();
		tab.frame.reload();
	}
});

navHomeBtn.addEventListener("click", () => {
	showLandingPage();
	stopTabPolling();
});

navUrlInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		const input = navUrlInput.value.trim();
		if (!input) return;

		if (activeTabId && newTabPending === activeTabId) {
			navigateTab(activeTabId, input);
		} else if (activeTabId) {
			navigateTab(activeTabId, input);
		} else {
			createTab(input);
		}
	}
});

newTabBtn.addEventListener("click", () => {
	createTab();
});

navSidebarBtn.addEventListener("click", openSidebar);

function updateNavUrl(url) {
	try {
		const parsed = new URL(url);
		navUrlInput.value = parsed.hostname + parsed.pathname + parsed.search;
	} catch {
		navUrlInput.value = url;
	}
}

// ============================================================
// Fullscreen
// ============================================================
navFullscreenBtn.addEventListener("click", toggleFullscreen);

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

// ============================================================
// Form Submission
// ============================================================
proxyForm.addEventListener("submit", async (e) => {
	e.preventDefault();
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
		// Clear input after successful navigation start
		proxyInput.value = "";
	} catch (err) {
		console.error("[Clash Proxy] Error:", err);
		const friendlyMsg = getFriendlyErrorMessage(err);
		showError(friendlyMsg);
		setStatus("error", friendlyMsg);
	}
});

// ============================================================
// Status & Error Display
// ============================================================
function showError(msg) {
	proxyErrorMessage.textContent = msg;
	proxyError.classList.remove("hidden");
}

function hideError() {
	proxyError.classList.add("hidden");
}

function setStatus(type, msg) {
	if (type === "loading") {
		statusDot.className = "status-dot loading";
		statusText.textContent = msg;
	} else if (type === "error") {
		statusDot.className = "status-dot error";
		statusText.textContent = msg;
	} else {
		statusDot.className = "status-dot";
		statusText.textContent = msg || "Ready — Enter a URL or search query";
	}
}

function hideStatus() {
	setStatus("ready", "Ready — Enter a URL or search query");
}

// ============================================================
// Sidebar
// ============================================================
function openSidebar() {
	sidebar.classList.add("open");
	sidebarOverlay.classList.add("active");
}

function closeSidebar() {
	sidebar.classList.remove("open");
	sidebarOverlay.classList.remove("active");
}

sidebarToggleBtn.addEventListener("click", openSidebar);
sidebarCloseBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeSidebar();
});

sidebarLinks.forEach((link) => {
	link.addEventListener("click", (e) => {
		e.preventDefault();
		const targetPage = link.dataset.page;

		document.querySelectorAll(".sidebar-link").forEach((l) => l.classList.remove("active"));
		link.classList.add("active");

		pages.forEach((p) => p.classList.remove("active"));
		const page = document.getElementById(`page-${targetPage}`);
		if (page) page.classList.add("active");

		if (targetPage === "proxy") {
			showLandingPage();
		} else {
			mainContent.classList.remove("hidden");
			mainContent.classList.remove("new-tab-mode");
			browserChrome.classList.add("hidden");
			framesContainer.classList.add("hidden");
		}
		closeSidebar();
	});
});

// ============================================================
// Keyboard Shortcuts
// ============================================================
document.addEventListener("keydown", (e) => {
	const onSearchPage = !mainContent.classList.contains("hidden");
	if (
		onSearchPage &&
		e.key.length === 1 &&
		!e.ctrlKey && !e.metaKey && !e.altKey &&
		document.activeElement !== proxyInput &&
		document.activeElement !== navUrlInput &&
		document.activeElement !== gamesSearch &&
		(document.activeElement && document.activeElement.tagName !== "INPUT")
	) {
		proxyInput.focus();
	}

	if (e.ctrlKey && e.key === "l" && !browserChrome.classList.contains("hidden")) {
		e.preventDefault();
		navUrlInput.focus();
		navUrlInput.select();
	}

	if (e.ctrlKey && e.key === "t" && !browserChrome.classList.contains("hidden")) {
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
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

// ============================================================
// Games Section
// ============================================================
function gameFallback(name) {
	var hash = 0;
	for (var i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
	var ah = Math.abs(hash);
	var hue = ((ah % 360) + 360) % 360;
	var h2 = (hue + 40) % 360;
	var letter = name.replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "G";
	var dark = "hsl(" + hue + ",40%,25%)";
	var mid = "hsl(" + hue + ",45%,38%)";
	var light = "hsl(" + h2 + ",50%,50%)";
	return "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='" + dark + "'/><stop offset='50%' stop-color='" + mid + "'/><stop offset='100%' stop-color='" + light + "'/></linearGradient></defs><rect width='100' height='100' rx='22' fill='url(#g)'/><text x='50' y='67' text-anchor='middle' font-size='48' font-weight='800' font-family='-apple-system,BlinkMacSystemFont,sans-serif' fill='rgba(255,255,255,0.92)'>" + letter + "</text></svg>");
}

function renderGames(games) {
	if (!gamesGrid) return;
	var searchVal = (gamesSearch ? gamesSearch.value : "").toLowerCase();
	gamesGrid.innerHTML = "";
	if (!games || !games.length) {
		if (gamesCount) gamesCount.textContent = "0";
		return;
	}
	var list = games;
	if (searchVal) {
		list = games.filter(function (g) {
			return (g.title || "").toLowerCase().indexOf(searchVal) >= 0 ||
				(g.cat || "").toLowerCase().indexOf(searchVal) >= 0;
		});
	}
	if (!list.length) {
		gamesGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">No games match your search</div>';
		if (gamesCount) gamesCount.textContent = "0/" + games.length;
		return;
	}
	list.forEach(function (game) {
		var card = document.createElement("div");
		card.className = "game-card";
		var thumbSvg = gameFallback(game.title || "G");
		card.innerHTML = '<div class="game-card-thumb" style="background-image:url(' + thumbSvg + ');background-size:cover;background-position:center"><div class="play-overlay">▶</div></div><div class="game-card-body"><div class="game-card-title">' + escapeHtml(game.title || "Game") + '</div><div class="game-card-cat">' + escapeHtml(game.cat || "Other") + '</div></div>';
		card.addEventListener("click", function () { openTheater(game); });
		gamesGrid.appendChild(card);
	});
	if (gamesCount) gamesCount.textContent = list.length + "/" + games.length;
}

function openTheater(game) {
	if (!theater || !theaterFrame) return;
	var url = game.url || "";
	if (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0 && url.indexOf("/") !== 0) {
		return;
	}
	currentGame = game;
	theater.classList.remove("hidden");
	theaterTitle.textContent = game.title || "Game";
	theaterFrame.src = url;
}

function closeTheater() {
	if (theater) theater.classList.add("hidden");
	if (theaterFrame) { theaterFrame.src = ""; }
	currentGame = null;
}

function toggleTheaterFullscreen() {
	if (!document.fullscreenElement) {
		theater.requestFullscreen().catch(function () {});
	} else {
		document.exitFullscreen().catch(function () {});
	}
}

if (gamesSearch) {
	gamesSearch.addEventListener("input", function () { renderGames(CLASH_GAMES); });
}

if (theaterClose) theaterClose.addEventListener("click", closeTheater);
if (theaterFullscreen) theaterFullscreen.addEventListener("click", toggleTheaterFullscreen);

if (theaterFrame) {
	theaterFrame.addEventListener("load", () => {
		try {
			const loc = theaterFrame.contentWindow.location;
			if (loc.pathname === "/" || loc.href === window.location.origin + "/") {
				closeTheater();
			}
		} catch (e) {
			// Cross-origin check failed, which is expected for external domains
		}
	});
}

document.addEventListener("keydown", function (e) {
	if (e.key === "Escape" && theater && !theater.classList.contains("hidden")) {
		closeTheater();
	}
});

// Initialize games when the data is available
if (typeof CLASH_GAMES !== "undefined" && CLASH_GAMES.length) {
	renderGames(CLASH_GAMES);
}

// Suppress unhandled promise rejection from init
initPromise.catch(() => {});