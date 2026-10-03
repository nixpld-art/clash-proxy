// ============================================================
// Classic mode — Service-Worker-free proxy engine.
//
// Browser requests  /classic/<absolute-target-url>  and this
// module fetches the target server-side, rewrites HTML/CSS so
// every URL points back through /classic/, injects the client
// shim (public/classic-client.js), and streams everything else
// (video/images/fonts/JS) through with Range support.
//
// No Service Worker is involved anywhere, so networks that
// block SW registration still work.
// ============================================================
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { WebSocketServer, WebSocket as WsClient } from "ws";

// transient diagnostics (googlevideo 403s, upstream failures) — file
// because the local dev server's stdout goes nowhere
function dbg(line) {
	try { appendFileSync("data/classic-debug.log", new Date().toISOString() + " " + line + "\n"); } catch {}
}

const PREFIX = "/classic/";
const CLIENT_JS = "/classic-client.js?v=5";
const JAR_COOKIE = "cpjar";
const CANON_SOCS = "SOCS=CAISFggDEgk5ODk5ODk1NzQaBWVuLUdCIAEaBgiAovHVBg";

// ANDROID client returns direct (unciphered) stream URLs from
// /youtubei/v1/player — verified 30/30 formats, 0 signatureCipher.
const ANDROID_CLIENT = {
	clientName: "ANDROID",
	clientVersion: "20.10.38",
	androidSdkVersion: 35,
	osName: "Android",
	osVersion: "15",
	platform: "MOBILE",
	clientFormFactor: "SMALL_FORM_FACTOR",
	timeZone: "UTC",
	utcOffsetMinutes: 0,
};
const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 15) gzip";

const YT_SUFFIXES = [
	".youtube.com", ".youtube-nocookie.com", ".googlevideo.com", ".ytimg.com",
	".ggpht.com", ".googleapis.com", ".gstatic.com", ".google.com", ".google.co.uk",
	".googleusercontent.com", ".googleadservices.com", ".googlesyndication.com",
	".google-analytics.com", ".gvt1.com", ".doubleclick.net",
];
function isYtHost(h) {
	h = String(h || "").toLowerCase();
	return YT_SUFFIXES.some((s) => h === s.slice(1) || h.endsWith(s));
}

// Response headers we never forward (CSP would block our injected
// shim, HSTS/XFO must not be adopted by our origin, hop-by-hop is
// meaningless, set-cookie goes into the jar instead).
const RESP_STRIP = new Set([
	"content-security-policy", "content-security-policy-report-only",
	"x-frame-options", "strict-transport-security", "set-cookie",
	"alt-svc", "public-key-pins", "public-key-pins-report-only",
	"report-to", "nel", "connection", "keep-alive", "transfer-encoding",
	"proxy-authenticate", "proxy-authorization", "trailer", "upgrade",
	"referrer-policy",
]);

// Request headers never forwarded (host/cookie/encoding are ours to manage).
const REQ_STRIP = new Set([
	"host", "cookie", "accept-encoding", "connection", "keep-alive",
	"proxy-authenticate", "proxy-authorization", "te", "trailer",
	"transfer-encoding", "upgrade", "content-length",
	"x-forwarded-for", "x-forwarded-proto", "x-forwarded-host",
]);

// ------------------------------------------------------------
// Cookie jar — per-browser-session, server side.
// Keyed by the cpjar cookie so users don't share cookies.
// ------------------------------------------------------------
const jars = new Map(); // jarId -> { cookies: [{name,value,domain,path,expires}], t }

function jarGet(id) {
	const j = jars.get(id);
	if (!j) return null;
	j.t = Date.now();
	return j;
}
function jarTouch(id, cookies) {
	if (jars.size > 400 && !jars.has(id)) {
		// evict least-recently-used
		let oldest = null, ot = Infinity;
		for (const [k, v] of jars) if (v.t < ot) { ot = v.t; oldest = k; }
		if (oldest) jars.delete(oldest);
	}
	let j = jars.get(id);
	if (!j) { j = { cookies: [], t: Date.now() }; jars.set(id, j); }
	if (cookies && cookies.length) {
		for (const c of cookies) {
			// delete existing match (also handles expiry via value === null)
			j.cookies = j.cookies.filter((x) => !(x.name === c.name && x.domain === c.domain && x.path === c.path));
			if (c.value !== null) j.cookies.push(c);
		}
		if (j.cookies.length > 150) j.cookies.splice(0, j.cookies.length - 150);
	}
	return j;
}

function parseSetCookie(sc, defDomain) {
	try {
		const parts = String(sc).split(";");
		const first = parts[0];
		const eq = first.indexOf("=");
		if (eq <= 0) return null;
		const name = first.slice(0, eq).trim();
		let value = first.slice(eq + 1).trim();
		let domain = defDomain, path = "/", expires = 0, drop = false;
		for (let i = 1; i < parts.length; i++) {
			const p = parts[i].trim();
			const i2 = p.indexOf("=");
			const k = (i2 < 0 ? p : p.slice(0, i2)).trim().toLowerCase();
			const v = i2 < 0 ? "" : p.slice(i2 + 1).trim();
			if (k === "domain" && v) domain = v.replace(/^\./, "").toLowerCase();
			else if (k === "path" && v) path = v;
			else if (k === "max-age") { const s = parseInt(v, 10); if (!Number.isNaN(s)) { expires = s <= 0 ? 1 : Date.now() + s * 1000; if (s <= 0) drop = true; } }
			else if (k === "expires" && !expires) { const t = Date.parse(v); if (!Number.isNaN(t)) { expires = t; if (t <= Date.now()) drop = true; } }
		}
		if (drop) return { name, value: null, domain: (domain || defDomain || "").toLowerCase(), path };
		if (!value) value = "";
		return { name, value, domain: (domain || defDomain || "").toLowerCase(), path };
	} catch { return null; }
}

function cookieHeaderFor(jarId, target) {
	const j = jarGet(jarId);
	if (!j || !j.cookies.length) return "";
	const host = target.hostname.toLowerCase();
	const p = target.pathname || "/";
	const now = Date.now();
	const out = [];
	for (const c of j.cookies) {
		if (c.expires && c.expires <= now) continue;
		const d = c.domain || "";
		if (d && !(host === d || host.endsWith("." + d))) continue;
		if (c.path && c.path !== "/" && !(p === c.path || p.startsWith(c.path.endsWith("/") ? c.path : c.path + "/"))) continue;
		out.push(c.name + "=" + c.value);
	}
	return out.join("; ");
}

function jarIdFrom(req) {
	try {
		for (const part of String(req.headers.cookie || "").split(";")) {
			const s = part.trim();
			if (s.startsWith(JAR_COOKIE + "=")) {
				const v = s.slice(JAR_COOKIE.length + 1).trim();
				if (/^[A-Za-z0-9_-]{8,64}$/.test(v)) return v;
			}
		}
	} catch {}
	return null;
}

// ------------------------------------------------------------
// URL helpers
// ------------------------------------------------------------
function absolutize(value, base) {
	if (value == null) return null;
	const v = String(value).trim();
	if (!v) return null;
	if (/^(data|blob|javascript|mailto|tel|sms|about|chrome|chrome-extension|devtools|file):/i.test(v)) return null;
	if (v.startsWith("#")) return null;
	if (/[{}<>]/.test(v)) return null; // template leftovers, JSON in data attrs
	try {
		const abs = new URL(v, base);
		if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
		return abs;
	} catch { return null; }
}

// If a URL/Referer points at our own /classic/ path, return the
// target URL it proxies; otherwise null.
function unwrapProxy(str, hostHdr) {
	try {
		const u = new URL(String(str), "http://localhost");
		if (hostHdr && u.host !== hostHdr) return null;
		if (u.pathname.startsWith(PREFIX)) {
			return u.pathname.slice(PREFIX.length) + u.search + u.hash;
		}
	} catch {}
	return null;
}

// Server-side safety net: a navigation/subresource request hit an
// unknown path on OUR origin (relative link the rewrite missed).
// Resolve it against the target URL in the Referer and redirect.
export function resolveClassicRedirect(reqPath, refererHeader, hostHdr) {
	try {
		if (!refererHeader || !reqPath) return null;
		const target = unwrapProxy(refererHeader, hostHdr);
		if (!target) return null;
		const abs = new URL(reqPath, target);
		if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
		return PREFIX + abs.href;
	} catch { return null; }
}

// --- stripped-referer safety net -------------------------------
// A sandboxed about:blank iframe created by the page can run
// history.replaceState('/watch?...') which (Chromium quirk) rewrites
// the MAIN document's URL to an origin-relative path. Afterwards
// relative navigations/subresources hit our origin with a Referer
// that no longer carries the /classic/ prefix. We remember which
// classic documents each client loaded (keyed by jar cookie / IP)
// and reconstruct the target from an exact path+query match.
const recentDocs = new Map(); // key -> [{ p, href, ts }]
const RECENT_DOCS_MAX = 10;
const RECENT_DOCS_AGE = 30 * 60 * 1000;

export function classicClientKeys(req) {
	const keys = [];
	try {
		for (const part of String(req.headers.cookie || "").split(";")) {
			const s = part.trim();
			if (s.startsWith(JAR_COOKIE + "=")) {
				const v = s.slice(JAR_COOKIE.length + 1).trim();
				if (/^[A-Za-z0-9_-]{8,64}$/.test(v)) keys.push("j:" + v);
			}
		}
	} catch {}
	keys.push("ip:" + String(req.ip || req.socket?.remoteAddress || "?"));
	return keys;
}

export function rememberClassicDoc(key, target) {
	if (!key || !target) return;
	let arr = recentDocs.get(key);
	if (!arr) { arr = []; recentDocs.set(key, arr); }
	const p = target.pathname + target.search;
	const now = Date.now();
	for (const d of arr) {
		if (d.p === p) { d.ts = now; d.href = target.href; return; }
	}
	arr.unshift({ p, href: target.href, ts: now });
	if (arr.length > RECENT_DOCS_MAX) arr.pop();
}

export function resolveStrippedRedirect(reqPath, refererHeader, hostHdr, key) {
	try {
		if (!refererHeader || !reqPath || !key) return null;
		const ref = new URL(String(refererHeader), "http://localhost");
		if (hostHdr && ref.host !== hostHdr) return null;
		if (ref.pathname.startsWith(PREFIX)) return null; // classic referer: other net handles it
		const arr = recentDocs.get(key);
		if (!arr) return null;
		const p = ref.pathname + ref.search;
		const now = Date.now();
		for (const d of arr) {
			if (d.p === p && now - d.ts < RECENT_DOCS_AGE) {
				const abs = new URL(reqPath, d.href);
				if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
				return PREFIX + abs.href;
			}
		}
	} catch {}
	return null;
}

// ------------------------------------------------------------
// HTML / CSS rewriting
// ------------------------------------------------------------
const URL_ATTR_NAMES = /^(href|src|srcset|action|poster|formaction|background|data|cite|longdesc|profile|xlink:href)$/i;

function rewriteSrcset(val, base) {
	return val.split(",").map((seg) => {
		const s = seg.trim();
		if (!s) return "";
		const m = s.match(/^(\S+)([\s\S]*)$/);
		if (!m) return s;
		const abs = absolutize(m[1], base);
		if (!abs) return s;
		return PREFIX + abs.href + (m[2] || "");
	}).join(", ");
}

function rewriteCss(css, base) {
	css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
		const abs = absolutize(u, base);
		if (!abs) return m;
		return `url(${q || ""}${PREFIX}${abs.href}${q || ""})`;
	});
	css = css.replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, u) => {
		const abs = absolutize(u, base);
		if (!abs) return m;
		return `@import ${q}${PREFIX}${abs.href}${q}`;
	});
	return css;
}

function transformAttr(name, val, base) {
	const n = String(name).toLowerCase();
	if (n === "style") return rewriteCss(val, base);
	if (n === "srcset") return rewriteSrcset(val, base);
	if (!URL_ATTR_NAMES.test(n)) return val;
	const abs = absolutize(val, base);
	if (!abs) return val;
	return PREFIX + abs.href;
}

// Parse one tag ("<name attr=value ...>") with real attribute
// scanning — quoted values are read to their closing quote so a
// URL-looking string INSIDE another attribute is never touched.
function rewriteTag(tag, base) {
	if (!/^<[a-zA-Z]/.test(tag)) return tag; // doctype / comments / closing tags
	let i = 1;
	let out = "<";
	let start = i;
	while (i < tag.length && /[^\s/>]/.test(tag[i])) i++;
	out += tag.slice(start, i);
	while (i < tag.length) {
		const c = tag[i];
		if (/\s/.test(c) || c === ">" || c === "/" || c === "?") { out += c; i++; continue; }
		start = i;
		while (i < tag.length && /[^\s=>]/.test(tag[i])) i++;
		const name = tag.slice(start, i);
		out += name;
		while (i < tag.length && /\s/.test(tag[i])) { out += tag[i]; i++; }
		if (tag[i] !== "=") continue;
		out += "=";
		i++;
		while (i < tag.length && /\s/.test(tag[i])) { out += tag[i]; i++; }
		const q = tag[i];
		if (q === '"' || q === "'") {
			const end = tag.indexOf(q, i + 1);
			if (end < 0) { out += tag.slice(i); i = tag.length; break; }
			out += q + transformAttr(name, tag.slice(i + 1, end), base) + q;
			i = end + 1;
		} else {
			start = i;
			while (i < tag.length && !/[\s>]/.test(tag[i])) i++;
			out += transformAttr(name, tag.slice(start, i), base);
		}
	}
	return out;
}

function rewriteHtmlAttrs(chunk, base) {
	return chunk.replace(/<[^>]*>/g, (t) => rewriteTag(t, base));
}

function matchBrace(s, start) {
	let depth = 0, inStr = false, esc = false;
	for (let i = start; i < s.length; i++) {
		const c = s[i];
		if (inStr) {
			if (esc) esc = false;
			else if (c === "\\") esc = true;
			else if (c === '"') inStr = false;
			continue;
		}
		if (c === '"') { inStr = true; continue; }
		if (c === "{") depth++;
		else if (c === "}") { depth--; if (depth === 0) return i; }
	}
	return -1;
}

function findYtPlayerResp(html) {
	let from = 0;
	while (true) {
		const idx = html.indexOf("ytInitialPlayerResponse", from);
		if (idx < 0) return null;
		from = idx + 1;
		// find the '=' after the name, then the '{'
		let i = idx + "ytInitialPlayerResponse".length;
		while (i < html.length && /\s/.test(html[i])) i++;
		if (html[i] !== "=") continue;
		i++;
		while (i < html.length && /\s/.test(html[i])) i++;
		if (html[i] !== "{") continue;
		const end = matchBrace(html, i);
		if (end < 0) continue;
		return { start: i, end: end + 1 };
	}
}

function ytVideoIdFromUrl(u) {
	try {
		const v = u.searchParams.get("v");
		if (v && /^[\w-]{11}$/.test(v)) return v;
	} catch {}
	const m = String(u.pathname || "").match(/\/(shorts|live|embed)\/([\w-]{11})/);
	return m ? m[2] : null;
}

// Cache ANDROID player responses per video (page + SPA POSTs share).
const playerCache = new Map(); // videoId -> { t, data }
async function androidPlayer(videoId, jarId) {
	const hit = playerCache.get(videoId);
	if (hit && Date.now() - hit.t < 600000) return hit.data;
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), 25000);
	try {
		const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": ANDROID_UA,
				"X-YouTube-Client-Name": "3",
				"X-YouTube-Client-Version": ANDROID_CLIENT.clientVersion,
				"Origin": "https://www.youtube.com",
				"Cookie": CANON_SOCS,
			},
			body: JSON.stringify({
				context: { client: { ...ANDROID_CLIENT, hl: "en", gl: "US" } },
				videoId,
				contentCheckOk: true,
				racyCheckOk: true,
			}),
			signal: ac.signal,
		});
		const j = await r.json();
		if (j && j.streamingData && playerCache.size < 60) {
			playerCache.set(videoId, { t: Date.now(), data: j });
		}
		return j && j.streamingData ? j : null;
	} catch { return null; }
	finally { clearTimeout(timer); }
}

// YouTube pages embed a WEB player response whose formats are all
// signatureCipher'd (we don't run scramjet's JS rewriter). Splice in
// the ANDROID streamingData (direct URLs) so the native <video> plays.
async function spliceYtStreaming(html, target, jarId) {
	try {
		if (!/(^|\.)youtube\.com$/i.test(target.hostname)) return html;
		const loc = findYtPlayerResp(html);
		if (!loc) return html;
		let obj;
		try { obj = JSON.parse(html.slice(loc.start, loc.end)); } catch { return html; }
		const sd = obj && obj.streamingData;
		const fmts = sd ? [...(sd.formats || []), ...(sd.adaptiveFormats || [])] : [];
		if (fmts.length && fmts.some((f) => f.url)) return html; // already direct
		const vid = (obj.videoDetails && obj.videoDetails.videoId) || ytVideoIdFromUrl(target);
		if (!vid) return html;
		const alt = await androidPlayer(vid, jarId);
		if (!alt || !alt.streamingData) return html;
		obj.streamingData = alt.streamingData;
		if (obj.playabilityStatus && obj.playabilityStatus.status !== "OK" &&
			alt.playabilityStatus && alt.playabilityStatus.status === "OK") {
			obj.playabilityStatus = alt.playabilityStatus;
		}
		// escape '<' so a description containing "</script>" can't end the tag
		const json = JSON.stringify(obj).replace(/</g, "\\u003c");
		return html.slice(0, loc.start) + json + html.slice(loc.end);
	} catch { return html; }
}

function injectShim(html, base, cookieHeader, dbgFlags) {
	if (dbgFlags && dbgFlags.includes("noshim")) return html;
	const cfg = JSON.stringify({ base, prefix: PREFIX, cookie: cookieHeader || "" }).replace(/</g, "\\u003c");
	const tag = `<script>window.__CLASSIC__=${cfg};</script><script src="${CLIENT_JS}"></script>`;
	if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, (m, a) => `<head${a}>${tag}`);
	if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, (m, a) => `<html${a}>${tag}`);
	return tag + html;
}

async function renderHtml(text, target, jarId, dbgFlags) {
	// capture + remove <base>, resolve against the document URL
	let base = target.href;
	const baseTag = text.match(/<base\b[^>]*?>/i);
	if (baseTag) {
		const hrefM = baseTag[0].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
		const raw = hrefM ? (hrefM[1] !== undefined ? hrefM[1] : (hrefM[2] !== undefined ? hrefM[2] : hrefM[3])) : null;
		if (raw) {
			try { const a = new URL(raw, target.href); if (a.protocol === "http:" || a.protocol === "https:") base = a.href; } catch {}
		}
		text = text.replace(baseTag[0], "");
	}

	if (!dbgFlags.includes("nosplice")) {
		// YouTube: swap ciphered embedded streams for direct ANDROID ones
		text = await spliceYtStreaming(text, target, jarId);
	}

	if (dbgFlags.includes("norewrite")) return injectShim(text, base, cookieHeaderFor(jarId, target), dbgFlags);

	// split so inline <script> bodies are never touched — but the
	// opening tag's src/onerror attributes still get rewritten
	const parts = text.split(/(<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>)/i);
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		if (!p) continue;
		let m = p.match(/^(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)$/i);
		if (m) { parts[i] = rewriteHtmlAttrs(m[1], base) + m[2] + m[3]; continue; }
		m = p.match(/^(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)$/i);
		if (m) { parts[i] = rewriteHtmlAttrs(m[1], base) + rewriteCss(m[2], base) + m[3]; continue; }
		parts[i] = rewriteHtmlAttrs(p, base);
	}
	text = parts.join("");

	// meta refresh: content="0; url=/somewhere"
	text = text.replace(/(<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*)(["'])([^"']+)\2/gi, (m, pre, q, content) => {
		const mm = content.match(/^(\s*[\d.]+\s*;\s*url\s*=\s*)([\s\S]+)$/i);
		if (!mm) return m;
		const raw = mm[2].trim().replace(/^["']|["']$/g, "");
		const abs = absolutize(raw, base);
		if (!abs) return m;
		return `${pre}${q}${mm[1]}${PREFIX}${abs.href}${q}`;
	});

	return injectShim(text, base, cookieHeaderFor(jarId, target), dbgFlags);
}

// Compact fetch/XHR/importScripts patch prepended to worker scripts
// (detected via Sec-Fetch-Dest: worker).
function workerBootstrap(targetUrl) {
	const cfg = JSON.stringify(targetUrl).replace(/</g, "\\u003c");
	return `/*clash-classic-worker*/
var __CB=${cfg};
function __CA(u){try{if(/^(data|blob|javascript):/i.test(String(u)))return String(u);var a=new URL(String(u),__CB);if(a.protocol!=="http:"&&a.protocol!=="https:")return String(u);return location.origin+"/classic/"+a.href;}catch(e){return String(u);}}
try{var __F=self.fetch;self.fetch=function(i,n){try{if(typeof i==="string")i=__CA(i);else if(i&&i.url){var t=__CA(i.url);if(t!==i.url)i=new Request(t,i);}}catch(e){}return __F.call(this,i,n);};}catch(e){}
try{var __O=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){var a=[].slice.call(arguments);a[1]=__CA(a[1]);return __O.apply(this,a);};}catch(e){}
try{var __I=self.importScripts;if(__I)self.importScripts=function(){return __I.apply(self,[].slice.call(arguments).map(__CA));};}catch(e){}
`;
}

// ------------------------------------------------------------
// YouTube /youtubei/v1/player body spoof → ANDROID (direct URLs)
// ------------------------------------------------------------
function spoofPlayerBody(buf) {
	try {
		const j = JSON.parse(buf.toString("utf8"));
		if (!j || typeof j !== "object" || !j.context || !j.context.client) return null;
		const inc = j.context.client;
		j.context.client = {
			...ANDROID_CLIENT,
			hl: inc.hl || "en",
			gl: inc.gl || "US",
			timeZone: inc.timeZone || "UTC",
			utcOffsetMinutes: typeof inc.utcOffsetMinutes === "number" ? inc.utcOffsetMinutes : 0,
			userAgent: ANDROID_UA,
		};
		j.contentCheckOk = true;
		j.racyCheckOk = true;
		return Buffer.from(JSON.stringify(j));
	} catch { return null; }
}

// ------------------------------------------------------------
// Upstream request headers
// ------------------------------------------------------------
function buildReqHeaders(req, target, jarId, isPlayerSpoof) {
	const out = {};
	for (const [k, v] of Object.entries(req.headers)) {
		const lk = k.toLowerCase();
		if (REQ_STRIP.has(lk)) continue;
		if (v == null) continue;
		if (lk === "origin") { out.origin = target.origin; continue; }
		if (lk === "referer" || lk === "referrer") {
			const unw = unwrapProxy(String(v), req.headers.host);
			out.referer = unw || target.origin + "/";
			continue;
		}
		out[lk] = Array.isArray(v) ? v.join(", ") : String(v);
	}
	out["accept-encoding"] = "identity";
	if (isPlayerSpoof) {
		out["user-agent"] = ANDROID_UA;
		out["x-youtube-client-name"] = "3";
		out["x-youtube-client-version"] = ANDROID_CLIENT.clientVersion;
		delete out["sec-ch-ua"];
		delete out["sec-ch-ua-mobile"];
		delete out["sec-ch-ua-platform"];
		delete out["sec-ch-ua-full-version"];
		delete out["sec-ch-ua-full-version-list"];
	}
	const host = target.hostname.toLowerCase();
	let ck = cookieHeaderFor(jarId, target);
	if (isYtHost(host) && !/(^|;\s*)SOCS=/.test(ck)) {
		ck = ck ? ck + "; " + CANON_SOCS : CANON_SOCS;
	}
	if (ck) out.cookie = ck;
	if (host.endsWith(".googlevideo.com")) {
		// stream URLs were generated with the ANDROID UA
		out["user-agent"] = ANDROID_UA;
		delete out["sec-ch-ua"];
		delete out["sec-ch-ua-mobile"];
		delete out["sec-ch-ua-platform"];
		delete out["sec-ch-ua-full-version"];
		delete out["sec-ch-ua-full-version-list"];
	}
	return out;
}

async function readBody(body) {
	if (body == null) return null;
	if (Buffer.isBuffer(body)) return body;
	if (typeof body === "string") return Buffer.from(body);
	const chunks = [];
	for await (const c of body) chunks.push(c);
	return Buffer.concat(chunks);
}

function errPage(message) {
	const safe = String(message || "Unknown error").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])).slice(0, 200);
	return `<!DOCTYPE html><html><head><title>Proxy error — Clash Proxy</title>
<style>body{background:#0a0a0f;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.c{text-align:center;max-width:520px;padding:0 24px}h1{font-size:1.6rem;font-weight:700;margin:0 0 8px}p{opacity:.6;line-height:1.6}code{color:#ff6b6b}a{display:inline-block;margin-top:14px;color:#a29bfe}</style></head>
<body><div class="c"><h1>Couldn't reach that site</h1><p>The proxy server failed to fetch the page.</p><p><code>${safe}</code></p>
<p style="margin-top:18px;opacity:.45;font-size:.85rem">If this keeps happening on YouTube, try switching the Proxy Engine in Settings.</p>
<a href="javascript:location.reload()">Retry</a> &nbsp;·&nbsp; <a href="/">Back to Clash Proxy</a></div></body></html>`;
}

// ------------------------------------------------------------
// Main route
// ------------------------------------------------------------
export default async function classicRoutes(fastify) {
	// proxy bodies must arrive as raw streams, not parsed JSON
	fastify.removeAllContentTypeParsers();
	fastify.addContentTypeParser("*", (req, payload, done) => done(null, payload));

	fastify.all(PREFIX + "*", { bodyLimit: 64 * 1024 * 1024 }, async (req, reply) => {
		const rawUrl = req.raw.url || "/";
		if (!rawUrl.startsWith(PREFIX)) return reply.callNotFound();
		const targetStr = rawUrl.slice(PREFIX.length);
		let target;
		try { target = new URL(targetStr); } catch { return reply.code(400).type("text/plain").send("Invalid proxy URL"); }
		if (target.protocol !== "http:" && target.protocol !== "https:") return reply.code(400).type("text/plain").send("Unsupported protocol");

		let jarId = jarIdFrom(req);
		let newJar = false;
		if (!jarId) { jarId = randomBytes(12).toString("hex"); newJar = true; }

		// remember page navigations (for the stripped-referer safety net)
		try {
			const dest = String(req.headers["sec-fetch-dest"] || "");
			const mode = String(req.headers["sec-fetch-mode"] || "");
			if (req.method === "GET" && (dest === "document" || mode === "navigate")) {
				for (const k of classicClientKeys(req)) rememberClassicDoc(k, target);
			}
		} catch {}

		// --- request body (buffered so the player spoof can rewrite it) ---
		let body = null;
		let isPlayerSpoof = false;
		if (req.method !== "GET" && req.method !== "HEAD") {
			body = await readBody(req.body);
			dbg(`BODY ${req.method} ${target.pathname.slice(0, 40)} len=${body ? body.length : 0} cl=${req.headers["content-length"] || "-"} ct=${String(req.headers["content-type"] || "-").slice(0, 40)}`);
			if (body && body.length && target.pathname.includes("/youtubei/v1/player")) {
				let keys = "?", parseOk = false, before = "?";
				try { const j0 = JSON.parse(body.toString("utf8")); parseOk = true; before = j0?.context?.client?.clientName + "/" + j0?.context?.client?.clientVersion + " videoId=" + j0?.videoId; keys = Object.keys(j0).join(","); } catch {}
				const spoofed = spoofPlayerBody(body);
				dbg(`PLAYER_IN len=${body.length} parse=${parseOk} keys=[${keys}] before=${before} spoofed=${!!spoofed}`);
				if (spoofed) { body = spoofed; isPlayerSpoof = true; }
			}
		}

		const upHeaders = buildReqHeaders(req, target, jarId, isPlayerSpoof);

		// --- fetch target (one retry: stale keep-alive sockets give
		// "Premature close" / ECONNRESET on the first attempt) ---
		let upstream;
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), 60000);
		const upBody = (req.method !== "GET" && req.method !== "HEAD") ? (body || undefined) : undefined;
		for (let attempt = 0; ; attempt++) {
			try {
				upstream = await fetch(target, {
					method: req.method,
					headers: upHeaders,
					body: upBody,
					redirect: "manual",
					signal: ac.signal,
				});
				break;
			} catch (e) {
				const msg = e && (e.cause && e.cause.message ? e.cause.message : e.message) || String(e);
				if (attempt < 2 && /premature close|other side closed|socket hang up|econnreset|und_err_socket|terminated/i.test(msg)) {
					dbg(`RETRY(${attempt + 1}) ${target.hostname}${target.pathname.slice(0, 50)} :: ${msg}`);
					await new Promise((r) => setTimeout(r, 300));
					continue;
				}
				clearTimeout(timer);
				dbg(`FETCH_ERR ${req.method} ${target.href.slice(0, 160)} :: ${msg} ua=${String(req.headers["user-agent"] || "").slice(0, 60)} range=${req.headers.range || "-"}`);
				return reply.code(502).type("text/html; charset=utf-8").send(errPage(msg));
			}
		}
		clearTimeout(timer);

		const isGw = target.hostname.endsWith(".googlevideo.com");
		if (isGw || upstream.status >= 400) {
			dbg(`${req.method} ${target.hostname}${target.pathname.slice(0, 60)} -> ${upstream.status}${upstream.status >= 400 ? " !!" : ""} range=${req.headers.range || "-"} ua=${String(upHeaders["user-agent"] || "").slice(0, 55)} enc=${upstream.headers.get("content-encoding") || "-"} ct=${String(upstream.headers.get("content-type") || "").slice(0, 40)}`);
		}
		if (upstream.status >= 400 && upstream.status < 500 && /application\/json/i.test(String(upstream.headers.get("content-type") || ""))) {
			try {
				const peek = Buffer.from(await upstream.clone().arrayBuffer()).toString("utf8").replace(/\s+/g, " ").slice(0, 400);
				dbg(`UP4XX_BODY ${target.pathname.slice(0, 40)} :: ${peek}`);
			} catch {}
		}

		// --- cookies into the jar ---
		try {
			const scs = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : [];
			const parsed = [];
			for (const sc of scs) {
				const c = parseSetCookie(sc, target.hostname);
				if (c) parsed.push(c);
			}
			if (parsed.length) jarTouch(jarId, parsed);
			else jarTouch(jarId, null);
		} catch {}

		// --- response headers ---
		const outHeaders = {};
		for (const [k, v] of upstream.headers) {
			const lk = k.toLowerCase();
			if (RESP_STRIP.has(lk)) continue;
			outHeaders[lk] = v;
		}
		if (newJar) outHeaders["set-cookie"] = `${JAR_COOKIE}=${jarId}; Path=/; Max-Age=15552000; SameSite=Lax`;

		// redirect: point Location back through /classic/
		if (upstream.status >= 300 && upstream.status < 400) {
			const loc = upstream.headers.get("location");
			if (loc) {
				try {
					const abs = new URL(loc, target);
					outHeaders.location = PREFIX + abs.href;
				} catch { outHeaders.location = loc; }
				return reply.code(upstream.status).headers(outHeaders).send();
			}
		}

		const ct = String(upstream.headers.get("content-type") || "");
		const hasBody = upstream.body && req.method !== "HEAD" && upstream.status !== 204 && upstream.status !== 304;
		if (!hasBody) {
			return reply.code(upstream.status).headers(outHeaders).send();
		}

		// undici decodes content-codings but keeps the header — if that
		// happened, the body no longer matches Content-Length/Encoding.
		const decoded = !!outHeaders["content-encoding"];
		if (decoded) {
			delete outHeaders["content-encoding"];
			delete outHeaders["content-length"];
		}

		// --- HTML: rewrite + inject shim ---
		const charsetM = ct.match(/charset\s*=\s*"?([\w-]+)"?/i);
		const charset = charsetM ? charsetM[1].toLowerCase() : "";
		const charsetOk = !charset || charset === "utf-8" || charset === "utf8";
		if (/text\/html/i.test(ct) && charsetOk) {
			const text = await upstream.text();
			delete outHeaders["content-length"];
			const dbgFlags = String(req.headers["x-clash-dbg"] || "").toLowerCase();
			const html = await renderHtml(text, target, jarId, dbgFlags);
			return reply.code(upstream.status).headers(outHeaders).type("text/html; charset=utf-8").send(html);
		}

		// --- CSS: rewrite url() relative to this stylesheet ---
		if (/text\/css/i.test(ct) && charsetOk) {
			const css = await upstream.text();
			delete outHeaders["content-length"];
			const dbgFlags = String(req.headers["x-clash-dbg"] || "").toLowerCase();
			const rewritten = dbgFlags.includes("norewrite") ? css : rewriteCss(css, target.href);
			return reply.code(upstream.status).headers(outHeaders).type("text/css; charset=utf-8").send(rewritten);
		}

		// --- worker scripts get a mini shim prepended ---
		const dest = String(req.headers["sec-fetch-dest"] || "");
		if ((dest === "worker" || dest === "sharedworker") && /javascript|ecmascript/i.test(ct)) {
			const src = await upstream.text();
			delete outHeaders["content-length"];
			const dbgFlags = String(req.headers["x-clash-dbg"] || "").toLowerCase();
			if (dbgFlags.includes("norewrite")) {
				return reply.code(upstream.status).headers(outHeaders).type("application/javascript; charset=utf-8").send(src);
			}
			const withShim = workerBootstrap(target.href) + "\n" + src;
			return reply.code(upstream.status).headers(outHeaders).type("application/javascript; charset=utf-8").send(withShim);
		}

		// --- everything else: stream through (Range/206 intact) ---
		return reply.code(upstream.status).headers(outHeaders).send(Readable.fromWeb(upstream.body));
	});
}

// ------------------------------------------------------------
// WebSocket piping  (/classic-ws/?u=<target ws://...>)
// ------------------------------------------------------------
export function classicUpgrade(req, socket, head) {
	try {
		const u = new URL(req.url, "http://localhost");
		const target = u.searchParams.get("u");
		if (!target) { socket.destroy(); return; }
		const t = new URL(target);
		if (t.protocol !== "ws:" && t.protocol !== "wss:" && t.protocol !== "http:" && t.protocol !== "https:") { socket.destroy(); return; }

		const jarId = jarIdFrom(req);
		const headers = {
			host: t.host,
			origin: t.origin,
			"user-agent": String(req.headers["user-agent"] || "Mozilla/5.0"),
		};
		const ck = jarId ? cookieHeaderFor(jarId, t) : "";
		if (ck) headers.cookie = ck;
		if (isYtHost(t.hostname) && !/(^|;\s*)SOCS=/.test(ck)) {
			headers.cookie = (headers.cookie ? headers.cookie + "; " : "") + CANON_SOCS;
		}
		const subproto = String(req.headers["sec-websocket-protocol"] || "")
			.split(",").map((s) => s.trim()).filter(Boolean);

		const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
		wss.handleUpgrade(req, socket, head, (client) => {
			const outOpts = { headers, perMessageDeflate: false };
			let out;
			try {
				out = subproto.length ? new WsClient(t.href, subproto, outOpts) : new WsClient(t.href, outOpts);
			} catch {
				try { client.close(); } catch {}
				return;
			}
			const closeBoth = () => {
				try { client.close(); } catch {}
				try { out.close(); } catch {}
				try { wss.close(); } catch {}
			};
			out.on("message", (d, isBin) => { if (client.readyState === 1) client.send(d, { binary: isBin }); });
			client.on("message", (d, isBin) => {
				if (out.readyState === 1) out.send(d, { binary: isBin });
				else if (out.readyState === 0) out.once("open", () => { try { out.send(d, { binary: isBin }); } catch {} });
			});
			out.on("close", closeBoth);
			client.on("close", closeBoth);
			out.on("error", closeBoth);
			client.on("error", closeBoth);
		});
	} catch {
		try { socket.destroy(); } catch {}
	}
}
