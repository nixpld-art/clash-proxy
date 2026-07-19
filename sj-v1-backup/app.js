"use strict";

/**
 * Clash Proxy — Main Application Logic
 *
 * Manages tabs, navigation (back/forward/refresh),
 * Scramjet proxy frames, fullscreen, and sidebar.
 */

// ============================================================
// DOM Elements
// ============================================================

// Landing page
const mainContent = document.getElementById("main-content");
const proxyForm = document.getElementById("proxy-form");
const proxyInput = document.getElementById("proxy-input");
const proxyError = document.getElementById("proxy-error");
const proxyErrorMessage = document.getElementById("proxy-error-message");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

// Browser chrome
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
const navSidebarBtn = document.getElementById("nav-sidebar-btn");

// Sidebar
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const sidebarLinks = document.querySelectorAll(".sidebar-link:not(.disabled)");
const pages = document.querySelectorAll(".page");

// ============================================================
// Scramjet Initialization
// ============================================================

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

let scramjetReady = false;
let scramjetInitError = null;

async function initScramjet() {
	try {
		await scramjet.init();
		scramjetReady = true;
		console.log("[Clash Proxy] Scramjet initialized successfully");
	} catch (err) {
		scramjetInitError = err;
		console.error("[Clash Proxy] Scramjet init failed:", err);
	}
}
const scramjetInitPromise = initScramjet();

const connection = new BareMux.BareMuxConnection(_CONFIG.baremuxWorkerPath);

// ============================================================
// Tab Management
// ============================================================

let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

// Track which tab is a "new tab" (showing search bar, not a proxied page)
let newTabPending = null;

/**
 * Creates a new tab. If no URL provided, shows the search bar.
 */
async function createTab(url) {
	const id = `tab-${++tabIdCounter}`;

	const tab = {
		id,
		title: url ? "Loading..." : "New Tab",
		url: url || "",
		frame: null,
		iframe: null,
		isNewTab: !url, // true if this is a blank new tab
	};

	tabs.push(tab);
	switchToTab(id);
	renderTabs();

	if (url) {
		await navigateTab(id, url);
	} else {
		// Show search bar inside the browser chrome
		newTabPending = id;
		showNewTabPage();
	}
}

/**
 * Navigates a tab to a URL via Scramjet.
 */
async function navigateTab(tabId, rawInput) {
	const tab = tabs.find((t) => t.id === tabId);
	if (!tab) return;

	try {
		setStatus("loading", "Initializing...");

		// Wait for Scramjet to be ready
		if (!scramjetReady) {
			setStatus("loading", "Loading proxy engine...");
			await scramjetInitPromise;
			if (scramjetInitError) {
				throw new Error("Proxy engine failed to initialize: " + scramjetInitError.message);
			}
		}

		// Register SW and set transport
		setStatus("loading", "Registering service worker...");
		await registerSW();

		setStatus("loading", "Connecting transport...");
		const wispUrl = _CONFIG.wispUrl;
		try {
			const currentTransport = await connection.getTransport();
			const targetTransport = _CONFIG.transportPath;
			if (!currentTransport || !currentTransport.endsWith(targetTransport)) {
				await connection.setTransport(targetTransport, [
					{ websocket: wispUrl },
				]);
			}
		} catch (transportErr) {
			console.warn("[Clash Proxy] Transport setup issue:", transportErr);
		}

		const url = search(rawInput, _CONFIG.searchEngine);
		tab.url = url;
		tab.isNewTab = false;
		newTabPending = null;

		// Remove old iframe if exists
		if (tab.iframe) {
			tab.iframe.remove();
			tab.iframe = null;
			tab.frame = null;
		}

		// Create new Scramjet frame
		setStatus("loading", "Creating session...");
		let frame;
		try {
			frame = scramjet.createFrame();
		} catch (frameErr) {
			throw new Error("Failed to create proxy frame: " + frameErr.message);
		}
		frame.frame.classList.add("proxy-iframe");
		frame.frame.dataset.tabId = tabId;
		frame.frame.setAttribute("allow", "autoplay; fullscreen; microphone; camera; display-capture; clipboard-read; clipboard-write; encrypted-media; picture-in-picture");

		tab.frame = frame;
		tab.iframe = frame.frame;

		framesContainer.appendChild(tab.iframe);

		setStatus("loading", "Navigating...");
		frame.go(url);

		// Update title
		tab.title = extractDomain(url);
		renderTabs();
		updateNavUrl(url);

		// Show browser view with the frame
		showBrowserView();
		showActiveFrame();
		hideStatus();

	} catch (err) {
		console.error("[Clash Proxy] Navigation error:", err);
		tab.title = "Error";
		tab.isNewTab = false;
		renderTabs();
		setStatus("error", "Failed to load: " + (err.message || "Unknown error"));
	}
}

/**
 * Switches to a tab by ID.
 */
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
	}
}

/**
 * Closes a tab by ID.
 */
function closeTab(tabId) {
	const idx = tabs.findIndex((t) => t.id === tabId);
	if (idx === -1) return;

	const tab = tabs[idx];

	// Remove iframe
	if (tab.iframe) {
		tab.iframe.remove();
	}

	tabs.splice(idx, 1);

	// If no tabs left, go back to landing page
	if (tabs.length === 0) {
		activeTabId = null;
		newTabPending = null;
		showLandingPage();
		return;
	}

	// If we closed the active tab, switch to nearest tab
	if (activeTabId === tabId) {
		const newIdx = Math.min(idx, tabs.length - 1);
		switchToTab(tabs[newIdx].id);
	}

	renderTabs();
}

/**
 * Renders the tab bar UI.
 */
function renderTabs() {
	tabList.innerHTML = "";

	tabs.forEach((tab) => {
		const tabEl = document.createElement("div");
		tabEl.className = `tab${tab.id === activeTabId ? " active" : ""}`;
		tabEl.dataset.tabId = tab.id;

		tabEl.innerHTML = `
			<span class="tab-title">${escapeHtml(tab.title)}</span>
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

/**
 * Shows only the active tab's iframe.
 */
function showActiveFrame() {
	const iframes = framesContainer.querySelectorAll("iframe");
	iframes.forEach((f) => {
		f.classList.toggle("active", f.dataset.tabId === activeTabId);
	});
}

// ============================================================
// View Switching
// ============================================================

/**
 * Shows browser chrome with proxied content (hides landing and new-tab page).
 */
function showBrowserView() {
	mainContent.classList.add("hidden");
	browserChrome.classList.remove("hidden");
	framesContainer.classList.remove("hidden");
}

/**
 * Shows the new tab page: browser chrome stays, content area shows the search bar.
 */
function showNewTabPage() {
	browserChrome.classList.remove("hidden");
	framesContainer.classList.remove("hidden");
	mainContent.classList.remove("hidden");
	mainContent.classList.add("new-tab-mode");

	// Hide all iframes
	const iframes = framesContainer.querySelectorAll("iframe");
	iframes.forEach((f) => f.classList.remove("active"));

	// Focus the search input
	navUrlInput.value = "";
	setTimeout(() => proxyInput.focus(), 50);
}

/**
 * Full landing page (no browser chrome, first visit).
 */
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
	setTimeout(() => proxyInput.focus(), 50);
}

// ============================================================
// Navigation Controls
// ============================================================

navBackBtn.addEventListener("click", () => {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab && tab.iframe && tab.iframe.contentWindow) {
		try { tab.iframe.contentWindow.history.back(); } catch (e) {}
	}
});

navForwardBtn.addEventListener("click", () => {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab && tab.iframe && tab.iframe.contentWindow) {
		try { tab.iframe.contentWindow.history.forward(); } catch (e) {}
	}
});

navRefreshBtn.addEventListener("click", () => {
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab && tab.iframe && tab.iframe.contentWindow) {
		try { tab.iframe.contentWindow.location.reload(); } catch (e) {}
	}
});

navHomeBtn.addEventListener("click", () => {
	showLandingPage();
});

// URL bar navigation
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

// New tab button
newTabBtn.addEventListener("click", () => {
	createTab(); // No URL = new tab with search bar
});

// Sidebar button in nav bar
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

// Update icon when fullscreen state changes
document.addEventListener("fullscreenchange", () => {
	const isFullscreen = !!document.fullscreenElement;
	fullscreenIconEnter.style.display = isFullscreen ? "none" : "";
	fullscreenIconExit.style.display = isFullscreen ? "" : "none";
});

// ============================================================
// Landing Page Form
// ============================================================

proxyForm.addEventListener("submit", async (e) => {
	e.preventDefault();
	hideError();
	setStatus("loading", "Preparing...");

	const input = proxyInput.value.trim();
	if (!input) return;

	try {
		// If we have a pending new tab, navigate it
		if (newTabPending) {
			await navigateTab(newTabPending, input);
			mainContent.classList.remove("new-tab-mode");
		} else {
			// First time — create a tab
			await createTab(input);
		}
	} catch (err) {
		console.error("[Clash Proxy] Error:", err);
		showError(err.message || "Failed to load. Please try again.");
		setStatus("error", err.message || "Failed to load");
	}
});

// ============================================================
// Error / Status Display
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

		showLandingPage();
		closeSidebar();
	});
});

// ============================================================
// Keyboard Shortcuts
// ============================================================

document.addEventListener("keydown", (e) => {
	// Focus search on typing (landing page or new tab page)
	const onSearchPage = !mainContent.classList.contains("hidden");
	if (
		onSearchPage &&
		e.key.length === 1 &&
		!e.ctrlKey && !e.metaKey && !e.altKey &&
		document.activeElement !== proxyInput &&
		document.activeElement !== navUrlInput &&
		document.activeElement.tagName !== "INPUT"
	) {
		proxyInput.focus();
	}

	// Ctrl+L to focus URL bar
	if (e.ctrlKey && e.key === "l" && !browserChrome.classList.contains("hidden")) {
		e.preventDefault();
		navUrlInput.focus();
		navUrlInput.select();
	}

	// Ctrl+T for new tab
	if (e.ctrlKey && e.key === "t" && !browserChrome.classList.contains("hidden")) {
		e.preventDefault();
		createTab();
	}

	// Ctrl+W to close tab
	if (e.ctrlKey && e.key === "w" && activeTabId) {
		e.preventDefault();
		closeTab(activeTabId);
	}

	// F11 for fullscreen
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
// === FUTURE EXTENSIONS ===
// Add game loaders, settings handlers, etc. below this line.
// ============================================================
