import { readFileSync, statSync } from "node:fs";
import { isAdminUser } from "./auth-utils.js";

const RANKS_PATH = new URL("../clash owner pannel/ranks-data.json", import.meta.url);
let cache = { mtime: -1, data: null };

export function readRanks() {
	try {
		const st = statSync(RANKS_PATH);
		if (!cache.data || st.mtimeMs !== cache.mtime) {
			cache = { mtime: st.mtimeMs, data: JSON.parse(readFileSync(RANKS_PATH, "utf8")) };
		}
		return cache.data;
	} catch {
		return { presets: [], assignments: {} };
	}
}

export function userRank(user) {
	if (!user) return null;
	const ranks = readRanks();
	const a = (ranks.assignments || {})[String(user.id)] || null;
	// Database resets recycle user IDs, so an id-only assignment can land on
	// the wrong player ("some random account shows Owner"). Every assignment
	// must now carry the username it was granted to; untagged legacy entries
	// are ignored (admins still get "Owner" from their DATABASE role).
	if (!a || !a.username) return { rankName: null, privileges: [], presetId: null };
	if (String(user.username || "").toLowerCase() !== String(a.username).toLowerCase()) {
		return { rankName: null, privileges: [], presetId: null };
	}
	const preset = a && a.presetId ? (ranks.presets || []).find((p) => p.id === a.presetId) : null;
	const privileges = [...new Set([...(a.privileges || []), ...(preset?.privileges || [])])];
	return { rankName: a?.rankName || preset?.name || null, privileges, presetId: a?.presetId || null };
}

export function hasPrivilege(user, privilege) {
	if (!user) return false;
	if (isAdminUser(user)) return true;
	return userRank(user).privileges.includes(privilege);
}
