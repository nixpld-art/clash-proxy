/**
 * Clash Shield — Built-in AdBlocker, Tracker Protection & Performance Engine
 * v1.0.0
 */
(function (root, factory) {
	const exported = factory();
	if (typeof module === "object" && module.exports) {
		module.exports = exported;
	}
	if (typeof root !== "undefined") {
		root.ClashShield = exported;
	}
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this), function () {
	"use strict";

	const STORAGE_CONFIG_KEY = "clash_shield_config";
	const STORAGE_STATS_KEY = "clash_shield_stats";

	// Default preferences
	const defaultConfig = {
		adBlockEnabled: true,
		popupBlockEnabled: true,
		forceDarkMode: false,
		whitelist: [],
	};

	// Default stats
	const defaultStats = {
		totalBlocked: 0,
		bytesSaved: 0,
	};

	let config = { ...defaultConfig };
	let stats = { ...defaultStats };

	// Tab-level blocked counters: tabId -> count
	const tabBlockedCounts = new Map();

	// Load configuration from localStorage if available
	if (typeof localStorage !== "undefined") {
		try {
			const savedConfig = localStorage.getItem(STORAGE_CONFIG_KEY);
			if (savedConfig) {
				config = { ...defaultConfig, ...JSON.parse(savedConfig) };
			}
			const savedStats = localStorage.getItem(STORAGE_STATS_KEY);
			if (savedStats) {
				stats = { ...defaultStats, ...JSON.parse(savedStats) };
			}
		} catch (e) {
			console.warn("[Clash Shield] Could not load stored config/stats:", e);
		}
	}

	function saveConfig() {
		try {
			localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
		} catch (e) {}
	}

	function saveStats() {
		try {
			localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
		} catch (e) {}
	}

	// Curated high-impact ad & tracking domain blocklist
	const BLOCKED_DOMAINS = new Set([
		// Google Ad & Tracking Services
		"doubleclick.net",
		"googlesyndication.com",
		"adservice.google.com",
		"googleadservices.com",
		"google-analytics.com",
		"googletagmanager.com",
		"analytics.google.com",
		"pagead2.googlesyndication.com",
		"tpc.googlesyndication.com",
		"admob.com",
		"2mdn.net",

		// Major Ad Exchanges & Networks
		"amazon-adsystem.com",
		"aax.amazon-adsystem.com",
		"criteo.com",
		"criteo.net",
		"taboola.com",
		"outbrain.com",
		"outbrainimg.com",
		"rubiconproject.com",
		"pubmatic.com",
		"adnxs.com",
		"adnxs-simple.com",
		"openx.net",
		"media.net",
		"smartadserver.com",
		"bidswitch.net",
		"sharethrough.com",
		"triplelift.com",
		"casalemedia.com",
		"indexexchange.com",
		"yieldmo.com",
		"sovrn.com",
		"undertone.com",
		"teads.tv",
		"revcontent.com",
		"mgid.com",
		"zergnet.com",
		"infolinks.com",
		"chitika.com",
		"buysellads.com",
		"propellerads.com",
		"adcash.com",
		"popads.net",
		"popcash.net",
		"zeroredirect.com",
		"yllix.com",
		"exoclick.com",
		"juicyads.com",
		"trafficjunky.com",
		"clickadu.com",
		"hilltopads.com",
		"adsterra.com",
		"monetag.com",
		"bidvertiser.com",
		"revenuehits.com",

		// Trackers, Telemetry & Analytics
		"scorecardresearch.com",
		"quantserve.com",
		"quantcast.com",
		"hotjar.com",
		"clarity.ms",
		"crazyegg.com",
		"mixpanel.com",
		"segment.io",
		"segment.com",
		"amplitude.com",
		"mouseflow.com",
		"optimizely.com",
		"chartbeat.com",
		"newrelic.com",
		"mc.yandex.ru",
		"statcounter.com",
		"connect.facebook.net",
		"pixel.facebook.com",
		"adroll.com",

		// Mobile & In-app ad networks
		"adcolony.com",
		"applovin.com",
		"unityads.unity3d.com",
		"vungle.com",
		"inmobi.com",
		"chartboost.com",
		"ironsrc.com",

		// Crypto Miners & Spyware
		"coinhive.com",
		"coin-hive.com",
		"crypto-loot.com",
		"jsecoin.com",
		"monerominer.rocks"
	]);

	// Keyword & path patterns indicating ad scripts or tracking pixels
	const BLOCKED_PATTERNS = [
		/\/pagead\/js\/adsbygoogle\.js/i,
		/\/pagead\/gen_204/i,
		/\/ads\/ga-audiences/i,
		/\/gtag\/js\?id=/i,
		/\/analytics\.js$/i,
		/\/beacon\/.*\.gif/i,
		/\/pixel\.gif/i,
		/\/adsbygoogle/i,
		/\/adservice\./i,
		/\/popunder/i,
		/\/popup-ad/i,
	];

	/**
	 * Extract hostname from arbitrary URL string or URL object.
	 */
	function getHost(url) {
		if (!url) return "";
		try {
			if (typeof url === "string") {
				if (!url.startsWith("http://") && !url.startsWith("https://")) {
					url = "https://" + url;
				}
				return new URL(url).hostname.toLowerCase();
			} else if (url && url.hostname) {
				return url.hostname.toLowerCase();
			}
		} catch (e) {}
		return "";
	}

	/**
	 * Check if a hostname matches any blocked domain or subdomain.
	 */
	function matchesBlockedDomain(hostname) {
		if (!hostname) return false;
		if (BLOCKED_DOMAINS.has(hostname)) return true;

		// Check root and subdomains: e.g. "a.b.doubleclick.net"
		const parts = hostname.split(".");
		for (let i = 1; i < parts.length - 1; i++) {
			const sub = parts.slice(i).join(".");
			if (BLOCKED_DOMAINS.has(sub)) return true;
		}
		return false;
	}

	/**
	 * Cosmetic filtering CSS to eliminate blank white boxes and banner placeholders.
	 */
	const COSMETIC_FILTER_CSS = `
		.adsbygoogle, [class*="ad-banner"], [id*="ad-banner"], [class*="ad_banner"],
		[id*="ad_banner"], [class*="advertisement"], [id*="advertisement"],
		[class*="ad-container"], [id*="ad-container"], [class*="taboola"], [id*="taboola"],
		[class*="outbrain"], [id*="outbrain"], ins.adsbygoogle, iframe[src*="doubleclick.net"],
		iframe[src*="googlesyndication.com"], iframe[src*="adnxs.com"], [data-ad-client],
		[data-ad-slot], [id^="google_ads_"], [class^="google_ads_"], .pub_300x250, .pub_728x90,
		#header-ad, #footer-ad, #sidebar-ad, .sidebar-ad, .banner-ad, .top-ad, .bottom-ad {
			display: none !important;
			visibility: hidden !important;
			height: 0 !important;
			max-height: 0 !important;
			min-height: 0 !important;
			opacity: 0 !important;
			pointer-events: none !important;
			overflow: hidden !important;
		}
	`;

	/**
	 * Smart Dark Mode CSS (Inverts bright backgrounds while preserving media).
	 */
	const DARK_MODE_CSS = `
		html {
			filter: invert(90%) hue-rotate(180deg) !important;
			background: #121212 !important;
		}
		img, video, canvas, iframe, svg, [style*="background-image"] {
			filter: invert(100%) hue-rotate(180deg) !important;
		}
	`;

	const ClashShield = {
		/**
		 * Retrieve current configuration.
		 */
		getConfig() {
			return { ...config };
		},

		/**
		 * Retrieve current lifetime stats.
		 */
		getStats() {
			return { ...stats };
		},

		/**
		 * Reset lifetime stats.
		 */
		clearStats() {
			stats.totalBlocked = 0;
			stats.bytesSaved = 0;
			saveStats();
			this.emitChange();
		},

		/**
		 * Check if a specific domain is whitelisted.
		 */
		isWhitelisted(domain) {
			const host = getHost(domain);
			return config.whitelist.includes(host);
		},

		/**
		 * Toggle whitelist state for a domain.
		 */
		toggleWhitelist(domain) {
			const host = getHost(domain);
			if (!host) return false;

			const idx = config.whitelist.indexOf(host);
			if (idx >= 0) {
				config.whitelist.splice(idx, 1);
			} else {
				config.whitelist.push(host);
			}
			saveConfig();
			this.emitChange();
			return this.isWhitelisted(host);
		},

		/**
		 * Toggle Ad & Tracker Blocker.
		 */
		setAdBlockEnabled(val) {
			config.adBlockEnabled = !!val;
			saveConfig();
			this.emitChange();
		},

		/**
		 * Toggle Popup Blocker.
		 */
		setPopupBlockEnabled(val) {
			config.popupBlockEnabled = !!val;
			saveConfig();
			this.emitChange();
		},

		/**
		 * Toggle Force Dark Mode.
		 */
		setForceDarkMode(val) {
			config.forceDarkMode = !!val;
			saveConfig();
			this.emitChange();
		},

		/**
		 * Determine whether a network request should be blocked.
		 * @param {string|URL} url - Request target URL
		 * @param {string} [currentSiteHost] - Hostname of the current top-level page
		 * @returns {boolean}
		 */
		shouldBlock(url, currentSiteHost) {
			if (!config.adBlockEnabled) return false;

			// If current top domain is whitelisted, do not block
			if (currentSiteHost && this.isWhitelisted(currentSiteHost)) {
				return false;
			}

			const host = getHost(url);
			if (!host) return false;

			// Do not block local / clash proxy internal resources
			if (
				host === "localhost" ||
				host === "127.0.0.1" ||
				(typeof location !== "undefined" && host === location.hostname) ||
				host.endsWith(".local")
			) {
				return false;
			}

			// Check domain blocklist
			if (matchesBlockedDomain(host)) {
				return true;
			}

			// Check URL path/pattern blocklist
			const urlStr = typeof url === "string" ? url : (url.href || url.toString());
			for (let i = 0; i < BLOCKED_PATTERNS.length; i++) {
				if (BLOCKED_PATTERNS[i].test(urlStr)) {
					return true;
				}
			}

			return false;
		},

		/**
		 * Record a blocked request event and update counters.
		 * @param {string|URL} url
		 * @param {string} [tabId]
		 */
		recordBlock(url, tabId) {
			stats.totalBlocked++;
			// Estimated ~125 KB saved per blocked ad / video script / tracking bundle
			stats.bytesSaved += 128000;
			saveStats();

			if (tabId) {
				const current = tabBlockedCounts.get(tabId) || 0;
				tabBlockedCounts.set(tabId, current + 1);
			}

			this.emitChange(tabId);
		},

		/**
		 * Get the number of blocked requests for a specific tab.
		 */
		getTabBlockedCount(tabId) {
			return tabBlockedCounts.get(tabId) || 0;
		},

		/**
		 * Reset blocked counter for a tab (e.g. on new navigation).
		 */
		resetTabCount(tabId) {
			tabBlockedCounts.set(tabId, 0);
			this.emitChange(tabId);
		},

		/**
		 * Clear tab when closed.
		 */
		removeTab(tabId) {
			tabBlockedCounts.delete(tabId);
		},

		/**
		 * Apply cosmetic filter, dark mode, and popup sandboxing to a loaded proxy iframe.
		 * @param {HTMLIFrameElement} iframe
		 * @param {string} [pageUrl]
		 */
		applyToFrame(iframe, pageUrl) {
			if (!iframe) return;

			try {
				const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
				const win = iframe.contentWindow;
				if (!doc) return;

				const currentHost = pageUrl ? getHost(pageUrl) : "";
				const isWhitelisted = currentHost && this.isWhitelisted(currentHost);

				// 1. Cosmetic Element Hiding (if adblock enabled and not whitelisted)
				if (config.adBlockEnabled && !isWhitelisted) {
					let cosmeticStyle = doc.getElementById("clash-shield-cosmetics");
					if (!cosmeticStyle && doc.head) {
						cosmeticStyle = doc.createElement("style");
						cosmeticStyle.id = "clash-shield-cosmetics";
						cosmeticStyle.textContent = COSMETIC_FILTER_CSS;
						doc.head.appendChild(cosmeticStyle);
					}
				} else {
					const existing = doc.getElementById("clash-shield-cosmetics");
					if (existing) existing.remove();
				}

				// 2. Force Dark Mode
				if (config.forceDarkMode) {
					let darkStyle = doc.getElementById("clash-shield-darkmode");
					if (!darkStyle && doc.head) {
						darkStyle = doc.createElement("style");
						darkStyle.id = "clash-shield-darkmode";
						darkStyle.textContent = DARK_MODE_CSS;
						doc.head.appendChild(darkStyle);
					}
				} else {
					const existing = doc.getElementById("clash-shield-darkmode");
					if (existing) existing.remove();
				}

				// 3. Popup Protection (intercept window.open)
				if (config.popupBlockEnabled && win && !win.__clashPopupProtected) {
					win.__clashPopupProtected = true;
					const origOpen = win.open;
					win.open = (url, target, features) => {
						const targetHost = getHost(url);
						if (url && (matchesBlockedDomain(targetHost) || this.shouldBlock(url, currentHost))) {
							console.log("[Clash Shield] Blocked popup window to:", url);
							this.recordBlock(url, iframe.dataset.tabId);
							return null;
						}
						return origOpen ? origOpen.call(win, url, target, features) : null;
					};
				}
			} catch (err) {
				// Cross-origin restriction fallback if any iframe security boundary occurs
				console.debug("[Clash Shield] Frame styling hook:", err);
			}
		},

		/**
		 * Listeners for UI reactive updates.
		 */
		listeners: new Set(),
		onChange(fn) {
			this.listeners.add(fn);
			return () => this.listeners.delete(fn);
		},
		emitChange(tabId) {
			this.listeners.forEach(fn => {
				try { fn(tabId); } catch (e) {}
			});
		},

		/**
		 * Format bytes into human readable format (e.g. 4.2 MB).
		 */
		formatBytes(bytes) {
			if (!bytes || bytes < 1024) return "0 KB";
			const kb = bytes / 1024;
			if (kb < 1024) return `${kb.toFixed(1)} KB`;
			const mb = kb / 1024;
			if (mb < 1024) return `${mb.toFixed(1)} MB`;
			const gb = mb / 1024;
			return `${gb.toFixed(2)} GB`;
		}
	};

	return ClashShield;
});
