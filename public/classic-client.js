// ============================================================
// Clash Proxy — Classic mode client shim.
// Injected as the FIRST script of every proxied page (no Service
// Worker involved). Dynamically rewrites any URL the page creates
// at runtime so requests go back through /classic/<url>, where the
// server fetches the real target.
//
// window.__CLASSIC__ = { base: "<absolute page URL>", prefix: "/classic/" }
// injected by the server before this script.
// ============================================================
(function () {
	"use strict";
	if (window.__CLASSIC_ACTIVE__) return;
	window.__CLASSIC_ACTIVE__ = true;

	// ---- Theme mismatch reload killer ----------------------------
	// YouTube's router does: documentElement.hasAttribute("dark") !==
	// (prefers-color-scheme dark) -> append ?themeRefresh=1 and force
	// a FULL reload on every navigation (each scroll = reload = slow).
	// The proxied page never gets the dark attr (no YouTube cookies in
	// the browser), so on OS-dark systems this fired constantly.
	// Keep the attr synced with the OS preference instead.
	try {
		var mqT = window.matchMedia("(prefers-color-scheme: dark)");
		var syncT = function () {
			var d = mqT.matches, el = document.documentElement;
			if (el && el.hasAttribute("dark") !== d) el.toggleAttribute("dark", d);
		};
		if (document.documentElement) {
			syncT();
			if (typeof MutationObserver !== "undefined") {
				new MutationObserver(syncT).observe(document.documentElement, { attributes: true, attributeFilter: ["dark"] });
			}
			if (mqT.addEventListener) mqT.addEventListener("change", syncT);
			else if (mqT.addListener) mqT.addListener(syncT);
		}
	} catch (e) {}

	// ---- Chromium 154 View Transitions crash workaround -----------
	// The proxied document trips a renderer STATUS_BREAKPOINT
	// (std::map::at "key not found" in cc::draw_property_utils)
	// the moment the page calls document.startViewTransition().
	// Neutralize it: return a valid-looking transition object so
	// page code (YouTube navigation) continues normally.
	try {
		if (typeof Document !== "undefined" && Document.prototype.startViewTransition) {
			Document.prototype.startViewTransition = function () {
				var p = Promise.resolve();
				return {
					ready: p, finished: p, updateCallbackDone: p,
					skipTransition: function () {},
					addEventListener: function () {},
					removeEventListener: function () {},
					dispatchEvent: function () { return true; }
				};
			};
		}
	} catch (e) {}

	var cfg = window.__CLASSIC__ || {};
	var PREFIX = typeof cfg.prefix === "string" && cfg.prefix ? cfg.prefix : "/classic/";
	var ORIGIN = location.origin;
	var NativeURL = window.URL;
	var nativeFetch = window.fetch;

	// ---- target URL of this document (changes on pushState) ----
	var targetBase = null;
	try { if (cfg.base) targetBase = new NativeURL(String(cfg.base)).href; } catch (e) {}

	// Turn our own proxied URL back into the real target URL, else null.
	function unwrap(href) {
		try {
			var u = new NativeURL(String(href), ORIGIN);
			if (u.origin === ORIGIN && u.pathname.indexOf(PREFIX) === 0) {
				return u.pathname.slice(PREFIX.length) + u.search + u.hash;
			}
		} catch (e) {}
		return null;
	}
	if (!targetBase) targetBase = unwrap(location.href) || location.href;

	try {
		function getTbOrigin() {
			try { return new NativeURL(targetBase).origin; } catch (e) { return ORIGIN; }
		}
		function getTbHost() {
			try { return new NativeURL(targetBase).hostname; } catch (e) { return location.hostname; }
		}
		try { Object.defineProperty(window, "origin", { get: getTbOrigin, configurable: true }); } catch (e) {}
		try { Object.defineProperty(Document.prototype, "domain", { get: getTbHost, configurable: true }); } catch (e) {}
		try { Object.defineProperty(Document.prototype, "URL", { get: function () { return targetBase; }, configurable: true }); } catch (e) {}
		try { Object.defineProperty(Document.prototype, "documentURI", { get: function () { return targetBase; }, configurable: true }); } catch (e) {}
		try { Object.defineProperty(Document.prototype, "baseURI", { get: function () { return targetBase; }, configurable: true }); } catch (e) {}
		try { Object.defineProperty(Navigator.prototype, "webdriver", { get: function () { return false; }, configurable: true }); } catch (e) {}
		try { Object.defineProperty(navigator, "webdriver", { get: function () { return false; }, configurable: true }); } catch (e) {}
		try {
			var origReferrer = Object.getOwnPropertyDescriptor(Document.prototype, "referrer");
			var origRefGet = origReferrer ? origReferrer.get : null;
			Object.defineProperty(Document.prototype, "referrer", {
				get: function () {
					var r = origRefGet ? origRefGet.call(this) : "";
					var unw = unwrap(r);
					return unw || (r && r.indexOf(ORIGIN) >= 0 ? "" : r);
				},
				configurable: true
			});
		} catch (e) {}
	} catch (e) {}

	// ---- postMessage / MessageEvent cross-origin bridge ----
	try {
		var origPM = Window.prototype.postMessage;
		Window.prototype.postMessage = function (msg, targetOrigin, transfer) {
			var to = (typeof targetOrigin === "string" && targetOrigin !== "*") ? "*" : targetOrigin;
			return transfer !== undefined ? origPM.call(this, msg, to, transfer) : origPM.call(this, msg, to);
		};
		try {
			var origWinPM = window.postMessage;
			if (origWinPM && origWinPM !== origPM) {
				window.postMessage = function (msg, targetOrigin, transfer) {
					var to = (typeof targetOrigin === "string" && targetOrigin !== "*") ? "*" : targetOrigin;
					return transfer !== undefined ? origWinPM.call(this, msg, to, transfer) : origWinPM.call(this, msg, to);
				};
			}
		} catch (e2) {}
	} catch (e) {}

	try {
		var origMsgOrigin = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "origin");
		var origMsgGet = origMsgOrigin ? origMsgOrigin.get : null;
		Object.defineProperty(MessageEvent.prototype, "origin", {
			get: function () {
				var raw = origMsgGet ? origMsgGet.call(this) : "";
				if (raw === ORIGIN) {
					try {
						if (this.source && this.source.__CLASSIC__ && this.source.__CLASSIC__.base) {
							return new NativeURL(this.source.__CLASSIC__.base).origin;
						}
					} catch (e3) {}
					try {
						if (this.source && this.source.document && this.source.document.URL) {
							var unw = unwrap(this.source.document.URL);
							if (unw) return new NativeURL(unw).origin;
						}
					} catch (e4) {}
					return getTbOrigin ? getTbOrigin() : raw;
				}
				return raw;
			},
			configurable: true
		});
	} catch (e) {}

	// ---- clean address at boot ------------------------------------
	// SPAs read location.pathname before anything else and route an
	// unfamiliar "/classic/https://..." to their own 404 (TikTok did
	// exactly that). Rewrite the document URL to the target's
	// same-origin path immediately — our server reconstructs the
	// target from the recent-docs map / referer on full reloads.
	try {
		var bootT = unwrap(location.href);
		if (bootT) {
			try {
				var bootU = new NativeURL(bootT);
				history.replaceState(history.state, document.title,
					bootU.pathname + bootU.search + bootU.hash);
			} catch (e2) {}
		}
	} catch (e) {}

	function shouldRewrite(s) {
		if (!s) return false;
		if (/^(data|blob|javascript|mailto|tel|sms|about|chrome|chrome-extension|devtools|file):/i.test(s)) return false;
		if (s.charAt(0) === "#") return false;
		if (/[{}<>]/.test(s)) return false; // JSON attrs, template leftovers
		return true;
	}

	// Absolute target URL -> proxied URL on our origin.
	function toProxy(u) {
		if (u == null) return u;
		var s = String(u);
		if (!shouldRewrite(s)) return s;
		var abs;
		try { abs = new NativeURL(s, targetBase); } catch (e) { return s; }
		if (abs.protocol !== "http:" && abs.protocol !== "https:") return s;
		if (abs.origin === ORIGIN) {
			var p = abs.pathname;
			if (p.indexOf(PREFIX) === 0 || p.indexOf("/classic-ws/") === 0 ||
				p.indexOf("/scram/") === 0 || p.indexOf("/api/") === 0) {
				return abs.href; // already proxied / our own app route
			}
			// root-relative path that was resolved against the proxied
			// document (new Request('/x'), fetch(location.origin+'/x')…)
			// belongs to the target site — remap it.
			try {
				var tbU = new NativeURL(targetBase);
				return ORIGIN + PREFIX + new NativeURL(p + abs.search + abs.hash, tbU.origin).href;
			}
			catch (e) { return abs.href; }
		}
		return ORIGIN + PREFIX + abs.href;
	}

	// Any URL -> the native target it represents (inverse of toProxy).
	// Returns null when the URL isn't ours.
	function fromProxy(href) {
		var abs;
		try { abs = new NativeURL(String(href), targetBase); } catch (e) { return null; }
		if (abs.origin !== ORIGIN) return null;
		if (abs.pathname.indexOf(PREFIX) === 0) {
			return abs.pathname.slice(PREFIX.length) + abs.search + abs.hash;
		}
		// resolved into our origin from a root-relative string → re-resolve vs target
		try {
			var tbU = new NativeURL(targetBase);
			return new NativeURL(abs.pathname + abs.search + abs.hash, tbU.origin).href;
		} catch (e) { return null; }
	}

	// ---- URL constructor: sites see native-looking target URLs ----
	try {
		function ClassicURL(url, base) {
			var b = base;
			if (b !== undefined && b !== null) {
				var fb = fromProxy(String(b));
				if (fb) b = fb;
			}
			var u;
			try {
				if (b === undefined || b === null) u = new NativeURL(url);
				else u = new NativeURL(url, b);
			} catch (err) {
				if (b === undefined || b === null) {
					try { u = new NativeURL(url, targetBase); } catch (e) { throw err; }
				} else {
					throw err;
				}
			}
			var back = fromProxy(u.href);
			if (back) { try { return new NativeURL(back); } catch (e) {} }
			return u;
		}
		ClassicURL.prototype = NativeURL.prototype;
		Object.setPrototypeOf(ClassicURL, NativeURL);
		window.URL = ClassicURL;
	} catch (e) {}

	// ---- fetch ----
	// Chrome only allows *streaming* request bodies (duplex:'half',
	// what a cloned body-carrying Request becomes) over HTTP/2 or
	// HTTP/3 — on our cleartext http/1.1 origin it dies with
	// ERR_ALPN_NEGOTIATION_FAILED. Also: fetch(request, init) must
	// merge BOTH — dropping either loses the body (player 400s).
	try {
		var nativeRS = window.ReadableStream;
		window.fetch = function (input, init) {
			var self = this;
			try {
				if (window.Request && input instanceof Request) {
					var ri = input;
					var fin = init;
					var t2 = toProxy(ri.url);
					var m = {};
					m.method = fin && fin.method !== undefined ? fin.method : ri.method;
					m.mode = fin && fin.mode !== undefined ? fin.mode : ri.mode;
					m.credentials = fin && fin.credentials !== undefined ? fin.credentials : ri.credentials;
					m.cache = fin && fin.cache !== undefined ? fin.cache : ri.cache;
					m.redirect = fin && fin.redirect !== undefined ? fin.redirect : ri.redirect;
					m.referrer = fin && fin.referrer !== undefined ? fin.referrer : ri.referrer;
					m.referrerPolicy = fin && fin.referrerPolicy !== undefined ? fin.referrerPolicy : ri.referrerPolicy;
					m.integrity = fin && fin.integrity !== undefined ? fin.integrity : ri.integrity;
					m.keepalive = fin && fin.keepalive !== undefined ? fin.keepalive : ri.keepalive;
					m.signal = fin && fin.signal !== undefined ? fin.signal : ri.signal;
					if (fin && fin.priority !== undefined) m.priority = fin.priority;
					var mh = new Headers(ri.headers);
					if (fin && fin.headers) {
						new Headers(fin.headers).forEach(function (v, k) {
							mh.delete(k);
							mh.append(k, v);
						});
					}
					m.headers = mh;
					var hasBody = m.method !== "GET" && m.method !== "HEAD";
					var finHasBody = !!(fin && fin.body !== undefined && fin.body !== null);
					if (!hasBody) return nativeFetch.call(self, t2, m);
					if (finHasBody) {
						var fb = fin.body;
						if (nativeRS && fb instanceof nativeRS) {
							return fb.arrayBuffer().then(function (buf) {
								m.body = buf;
								return nativeFetch.call(self, t2, m);
							});
						}
						m.body = fb;
						return nativeFetch.call(self, t2, m);
					}
					if (ri.body && !ri.bodyUsed) {
						return ri.clone().arrayBuffer().then(function (buf) {
							m.body = buf;
							return nativeFetch.call(self, t2, m);
						});
					}
					if (ri.bodyUsed) return nativeFetch.call(self, ri, fin);
					return nativeFetch.call(self, t2, m);
				} else if (typeof input === "string" || input instanceof NativeURL) {
					var t = toProxy(input instanceof NativeURL ? input.href : input);
					if (t !== input) input = t;
				}
				if (init && init.body && nativeRS && init.body instanceof nativeRS) {
					var b = init.body;
					return b.arrayBuffer().then(function (buf) {
						var i2 = {};
						for (var k2 in init) {
							if (Object.prototype.hasOwnProperty.call(init, k2) && k2 !== "body" && k2 !== "duplex") i2[k2] = init[k2];
						}
						i2.body = buf;
						return nativeFetch.call(self, input, i2);
					});
				}
			} catch (e) {}
			return nativeFetch.call(this, input, init);
		};
	} catch (e) {}

	// ---- XHR ----
	try {
		var xhrOpen = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function (method, url) {
			var args = Array.prototype.slice.call(arguments);
			try { args[1] = toProxy(url); } catch (e) {}
			return xhrOpen.apply(this, args);
		};
	} catch (e) {}

	// ---- sendBeacon ----
	try {
		if (navigator.sendBeacon) {
			var nativeBeacon = Function.prototype.call.bind(navigator.sendBeacon);
			navigator.sendBeacon = function (url, data) {
				try { url = toProxy(url); } catch (e) {}
				return nativeBeacon(navigator, url, data);
			};
		}
	} catch (e) {}

	// ---- WebSocket → piped through /classic-ws/ ----
	try {
		var NativeWS = window.WebSocket;
		if (NativeWS) {
			function ClassicWS(url, protocols) {
				var abs;
				try { abs = new NativeURL(String(url), targetBase).href; } catch (e) { abs = String(url); }
				var wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host +
					"/classic-ws/?u=" + encodeURIComponent(abs);
				return protocols !== undefined ? new NativeWS(wsUrl, protocols) : new NativeWS(wsUrl);
			}
			ClassicWS.prototype = NativeWS.prototype;
			Object.setPrototypeOf(ClassicWS, NativeWS);
			window.WebSocket = ClassicWS;
		}
	} catch (e) {}

	// ---- EventSource ----
	try {
		var NativeES = window.EventSource;
		if (NativeES) {
			function ClassicES(url, init) { return new NativeES(toProxy(url), init); }
			ClassicES.prototype = NativeES.prototype;
			Object.setPrototypeOf(ClassicES, NativeES);
			window.EventSource = ClassicES;
		}
	} catch (e) {}

	// ---- Workers (their own scope gets a server-side mini-shim too) ----
	function patchWorker(name) {
		try {
			var N = window[name];
			if (!N) return;
			function ClassicWorker(url, opts) { return new N(toProxy(url), opts); }
			ClassicWorker.prototype = N.prototype;
			Object.setPrototypeOf(ClassicWorker, N);
			window[name] = ClassicWorker;
		} catch (e) {}
	}
	patchWorker("Worker");
	patchWorker("SharedWorker");

	// ---- history (keeps targetBase in sync for relative URLs) ----
	// History entries store the target's same-origin path (never the
	// /classic/ form) so site routers always see native-looking
	// paths; pathTargets maps each entry back to its full target URL.
	try {
		var pathTargets = {};
		var nativePush = history.pushState;
		var nativeReplace = history.replaceState;
		function track(url) {
			if (url == null) return null;
			var s = String(url);
			var abs = null;
			var uw = unwrap(s);
			try {
				if (uw) {
					abs = new NativeURL(uw);
				} else {
					abs = new NativeURL(s, targetBase);
					if (abs.origin === ORIGIN) {
						var tbU = new NativeURL(targetBase);
						abs = new NativeURL(abs.pathname + abs.search + abs.hash, tbU.origin);
					}
				}
			} catch (e) { return null; }
			if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
			targetBase = abs.href;
			var rel = abs.pathname + abs.search + abs.hash;
			pathTargets[rel] = abs.href;
			return rel;
		}
		history.pushState = function (state, title, url) {
			var u = track(url);
			return nativePush.call(this, state, title, u === null ? url : u);
		};
		history.replaceState = function (state, title, url) {
			var u = track(url);
			return nativeReplace.call(this, state, title, u === null ? url : u);
		};
		window.addEventListener("popstate", function () {
			var t = unwrap(location.href);
			if (t) { targetBase = t; return; }
			var m = pathTargets[location.pathname + location.search];
			if (m) targetBase = m;
		});
	} catch (e) {}

	// ---- URL attributes (img.src, a.href, ...) ----
	function rewriteSrcsetStr(v) {
		return String(v).split(",").map(function (seg) {
			var s = seg.trim();
			if (!s) return "";
			var m = s.match(/^(\S+)([\s\S]*)$/);
			if (!m) return s;
			return toProxy(m[1]) + (m[2] || "");
		}).join(", ");
	}
	var URL_ATTRS_RE = /^(href|src|srcset|action|poster|formaction|background|data|cite|longdesc|profile|xlink:href)$/i;

	function patchProp(ctorName, prop) {
		try {
			var C = window[ctorName];
			if (!C || !C.prototype) return;
			var d = Object.getOwnPropertyDescriptor(C.prototype, prop);
			if (!d || !d.set || !d.get) return;
			Object.defineProperty(C.prototype, prop, {
				configurable: true,
				enumerable: d.enumerable,
				get: function () { return d.get.call(this); },
				set: function (v) {
					var nv = v;
					try {
						if (v != null) nv = (prop === "srcset") ? rewriteSrcsetStr(v) : toProxy(v);
					} catch (e) { nv = v; }
					return d.set.call(this, nv);
				}
			});
		} catch (e) {}
	}
	[
		["HTMLAnchorElement", "href"], ["HTMLAreaElement", "href"], ["HTMLLinkElement", "href"],
		["HTMLScriptElement", "src"], ["HTMLImageElement", "src"], ["HTMLImageElement", "srcset"],
		["HTMLSourceElement", "src"], ["HTMLSourceElement", "srcset"], ["HTMLIFrameElement", "src"],
		["HTMLFormElement", "action"], ["HTMLVideoElement", "src"], ["HTMLVideoElement", "poster"],
		["HTMLAudioElement", "src"], ["HTMLTrackElement", "src"], ["HTMLEmbedElement", "src"],
		["HTMLObjectElement", "data"], ["HTMLInputElement", "src"], ["HTMLInputElement", "formAction"],
		["HTMLBodyElement", "background"], ["HTMLFrameElement", "src"], ["HTMLFrameSetElement", "src"],
	].forEach(function (p) { patchProp(p[0], p[1]); });

	// ---- setAttribute / setAttributeNS ----
	function attrValue(name, value) {
		try {
			if (value == null) return value;
			if (!URL_ATTRS_RE.test(name)) return value;
			return String(name).toLowerCase() === "srcset" ? rewriteSrcsetStr(value) : toProxy(value);
		} catch (e) { return value; }
	}
	try {
		var nativeSetAttribute = Element.prototype.setAttribute;
		Element.prototype.setAttribute = function (name, value) {
			return nativeSetAttribute.call(this, name, attrValue(name, value));
		};
	} catch (e) {}
	try {
		var nativeSetAttributeNS = Element.prototype.setAttributeNS;
		if (nativeSetAttributeNS) {
			Element.prototype.setAttributeNS = function (ns, name, value) {
				var local = String(name).split(":").pop();
				return nativeSetAttributeNS.call(this, ns, name, attrValue(local, value));
			};
		}
	} catch (e) {}

	// ---- Audio constructor (sets content attributes internally,
	// bypassing the JS src setter → would hit our origin root) ----
	try {
		var NativeAudio = window.Audio;
		if (NativeAudio) {
			window.Audio = function (src) {
				var a = new NativeAudio();
				if (src != null) a.setAttribute("src", String(src));
				return a;
			};
			window.Audio.prototype = NativeAudio.prototype;
			Object.setPrototypeOf(window.Audio, NativeAudio);
		}
	} catch (e) {}

	// ---- window.open ----
	try {
		var nativeOpen = window.open;
		window.open = function (url, name, features) {
			if (url != null) { try { url = toProxy(url); } catch (e) {} }
			return nativeOpen.call(this, url, name, features);
		};
	} catch (e) {}

	// ---- proxied sites must never register their own Service Worker
	// on our origin (would hijack the whole app) ----
	try {
		if (navigator.serviceWorker) {
			var swProto = Object.getPrototypeOf(navigator.serviceWorker);
			var swDesc = swProto && Object.getOwnPropertyDescriptor(swProto, "register");
			if (swDesc && swDesc.configurable) {
				Object.defineProperty(swProto, "register", {
					configurable: true,
					writable: true,
					value: function () {
						return Promise.reject(new Error("Service workers are disabled in Classic mode"));
					}
				});
			}
		}
	} catch (e) {}

	// ---- YouTube SABR Disabler & Error Neutralizer -------------
	// Desktop YouTube player crashes with `fmt.missing` ("Something went wrong")
	// when `useServerDrivenAbr` is true but direct Range-GET / MSE formats are provided.
	// Neutralize useServerDrivenAbr so the player smoothly selects direct formats.
	try {
		var stripServerAbrClient = function (node) {
			if (!node || typeof node !== "object") return;
			if (Array.isArray(node)) {
				for (var i = 0; i < node.length; i++) stripServerAbrClient(node[i]);
				return;
			}
			if (node.frameworkUpdates && node.serviceTrackingParams && JSON.stringify(node.serviceTrackingParams).includes("ANDROID")) {
				delete node.frameworkUpdates;
				delete node.onResponseReceivedActions;
				delete node.attestation;
			}
			if (node.playabilityStatus && node.streamingData) {
				node.playabilityStatus.status = "OK";
				node.playabilityStatus.playableInEmbed = true;
			}
			if (node.mediaCommonConfig && typeof node.mediaCommonConfig === "object") {
				node.mediaCommonConfig.useServerDrivenAbr = false;
			}
			if (node.useServerDrivenAbr !== undefined) {
				node.useServerDrivenAbr = false;
			}
			for (var k in node) {
				if (Object.prototype.hasOwnProperty.call(node, k) && typeof node[k] === "object" && node[k] !== null) {
					stripServerAbrClient(node[k]);
				}
			}
		};

		var _cClientYtResp = window.ytInitialPlayerResponse;
		if (_cClientYtResp) stripServerAbrClient(_cClientYtResp);
		Object.defineProperty(window, "ytInitialPlayerResponse", {
			configurable: true,
			enumerable: true,
			get: function () { return _cClientYtResp; },
			set: function (v) {
				stripServerAbrClient(v);
				_cClientYtResp = v;
			}
		});

		if (window.Response) {
			if (Response.prototype.json) {
				var origRespJson = Response.prototype.json;
				Response.prototype.json = function () {
					return origRespJson.apply(this, arguments).then(function (data) {
						stripServerAbrClient(data);
						return data;
					});
				};
			}
			if (Response.prototype.text) {
				var origRespText = Response.prototype.text;
				Response.prototype.text = function () {
					var u = this.url || "";
					return origRespText.apply(this, arguments).then(function (txt) {
						if (txt && (u.includes("youtubei/v1/player") || u.includes("reel_") || txt.includes("streamingData") || txt.includes("useServerDrivenAbr"))) {
							try {
								var data = JSON.parse(txt);
								stripServerAbrClient(data);
								return JSON.stringify(data);
							} catch (e) {
								return txt;
							}
						}
						return txt;
					});
				};
			}
		}
		if (window.JSON && JSON.parse) {
			var origJsonParse = JSON.parse;
			JSON.parse = function () {
				var res = origJsonParse.apply(this, arguments);
				if (res && typeof res === "object" && (res.streamingData || res.videoDetails || res.playerConfig)) {
					stripServerAbrClient(res);
				}
				return res;
			};
		}
	} catch (e) {}

	// ---- Autoplay Enforcer -------------------------------------
	// Ensures videos and shorts play automatically upon loading and navigation,
	// without overriding explicit pauses or looping in the background.
	(function () {
		var activeVideoId = null;
		var hasAutoPlayed = false;

		function getVideoIdFromUrl() {
			try {
				var u = location.href;
				var sm = u.match(/\/shorts\/([\w-]{11})/);
				if (sm) return sm[1];
				var wm = u.match(/[?&]v=([\w-]{11})/);
				if (wm) return wm[1];
			} catch (e) {}
			return null;
		}

		function triggerPlay(video) {
			if (!video || !video.paused || video.ended || hasAutoPlayed) return;
			video.autoplay = true;
			try {
				var p = video.play();
				if (p && typeof p.then === "function") {
					p.then(function () {
						hasAutoPlayed = true;
					}).catch(function () {
						// Browser blocked unmuted autoplay: mute and play
						if (!video.muted) {
							video.muted = true;
							var p2 = video.play();
							if (p2 && typeof p2.then === "function") {
								p2.then(function () {
									hasAutoPlayed = true;
								}).catch(function () {});
							}
							var unmute = function () {
								try { video.muted = false; } catch (e) {}
								window.removeEventListener("pointerdown", unmute, true);
								window.removeEventListener("keydown", unmute, true);
								window.removeEventListener("wheel", unmute, true);
								window.removeEventListener("touchstart", unmute, true);
							};
							window.addEventListener("pointerdown", unmute, true);
							window.addEventListener("keydown", unmute, true);
							window.addEventListener("wheel", unmute, true);
							window.addEventListener("touchstart", unmute, true);
						}
					});
				}
			} catch (e) {}
		}

		function tryAutoplay() {
			var vid = getVideoIdFromUrl();
			if (vid && vid !== activeVideoId) {
				activeVideoId = vid;
				hasAutoPlayed = false;
			}
			if (hasAutoPlayed) return;

			// Shorts player
			if (vid && location.pathname.includes("/shorts/")) {
				var sp = document.querySelector("#shorts-player");
				if (sp && typeof sp.loadVideoById === "function") {
					var curVid = sp.getVideoData && sp.getVideoData() && sp.getVideoData().video_id;
					if (curVid !== vid) {
						var now = Date.now();
						if (sp.__lastLoadedVid !== vid || (now - (sp.__lastLoadTime || 0) > 4000)) {
							sp.__lastLoadedVid = vid;
							sp.__lastLoadTime = now;
							try { sp.loadVideoById(vid); } catch (e) {}
						}
					} else {
						if (typeof sp.playVideo === "function") {
							try { sp.playVideo(); } catch (e) {}
						}
					}
				}
			}

			// Watch page movie player
			var mp = document.querySelector("#movie_player, .html5-video-player");
			if (mp && typeof mp.getPlayerState === "function") {
				var st = mp.getPlayerState();
				if (st === 5 || st === -1 || st === 2) {
					if (typeof mp.playVideo === "function") {
						try { mp.playVideo(); } catch (e) {}
					}
				}
			}

			// Direct video element
			var v = document.querySelector("video");
			if (v && v.paused && !v.ended) {
				triggerPlay(v);
			}

			var cuedOverlay = document.querySelector(".ytp-cued-thumbnail-overlay:not([style*='display: none'])");
			if (cuedOverlay) {
				var playBtn = document.querySelector(".ytp-large-play-button, .ytp-play-button");
				if (playBtn) {
					try { playBtn.click(); } catch (e) {}
				}
			}
		}

		function onNewVideo() {
			var vid = getVideoIdFromUrl();
			if (vid && vid !== activeVideoId) {
				activeVideoId = vid;
			}
			hasAutoPlayed = false;
			tryAutoplay();
			setTimeout(tryAutoplay, 150);
			setTimeout(tryAutoplay, 400);
			setTimeout(tryAutoplay, 900);
			setTimeout(tryAutoplay, 1800);
		}

		window.addEventListener("playing", function (e) {
			if (e.target && e.target.tagName === "VIDEO") {
				hasAutoPlayed = true;
			}
		}, true);

		window.addEventListener("yt-navigate-finish", onNewVideo);
		window.addEventListener("popstate", onNewVideo);

		// Shorts feed navigation (Arrow keys / wheel / navigation clicks)
		window.addEventListener("keydown", function (e) {
			if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "PageDown" || e.key === "PageUp" || e.key === "j") {
				setTimeout(onNewVideo, 100);
			}
		}, true);
		window.addEventListener("wheel", function () {
			setTimeout(onNewVideo, 150);
		}, { passive: true });
		document.addEventListener("click", function (e) {
			if (e.target && e.target.closest && e.target.closest("a[href*='/watch'], a[href*='/shorts/'], #navigation-button-down, #navigation-button-up, [aria-label*='Next' i], [aria-label*='Previous' i]")) {
				setTimeout(onNewVideo, 100);
			}
		}, true);

		// Initial load
		onNewVideo();
	})();
})();
