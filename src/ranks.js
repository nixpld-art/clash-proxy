import { readFileSync, statSync } from "node:fs";
import { isPrivilegedUsername, isAdminUser } from "./auth-utils.js";

const RANKS_PATH = new URL("../clash owner pannel/ranks-data.json", import.meta.url);
let cache = { mtime: -1, data: null };

export const PRIVILEGES = [
	// Moderation Tools (6)
	{ id: "mod-kick", name: "Kick Players", desc: "Disconnect disruptive players from active sessions", category: "Moderation" },
	{ id: "mod-mute", name: "Timeout / Mute", desc: "Mute toxic players in the global chat", category: "Moderation" },
	{ id: "mod-warn", name: "Official Warnings", desc: "Issue official logged warnings to user profiles", category: "Moderation" },
	{ id: "mod-chat-clear", name: "Clear Chat", desc: "Purge recent global chat messages in emergencies", category: "Moderation" },
	{ id: "mod-reports", name: "Handle Reports", desc: "Review and resolve community user reports", category: "Moderation" },
	{ id: "mod-audit-view", name: "View Audit Log", desc: "Access the staff action audit trails", category: "Moderation" },

	// Chat & Communication (5)
	{ id: "chat-broadcast", name: "Server Broadcast", desc: "Send live floating banner announcements to all online users", category: "Communication" },
	{ id: "chat-color", name: "Colored Staff Chat", desc: "Highlight your messages with glowing staff styling", category: "Communication" },
	{ id: "chat-slowmode", name: "Chat Slowmode", desc: "Toggle slowmode limits on the global chat room", category: "Communication" },
	{ id: "social-pin", name: "Pin Messages", desc: "Pin important community messages to the lounge", category: "Communication" },
	{ id: "member-inspector", name: "Inspect Profiles", desc: "Inspect detailed player statistics and activity logs", category: "Communication" },

	// Game & Content Curation (4)
	{ id: "game-testing", name: "Game Staging Tester", desc: "Test unreleased staged games and submit status reports", category: "Games" },
	{ id: "game-feature", name: "Feature Games", desc: "Nominate games for Game of the Week & Daily Picks", category: "Games" },
	{ id: "game-bug-reports", name: "Game Bug Reports", desc: "Manage and triage player-reported broken games", category: "Games" },
	{ id: "game-tag-editor", name: "Game Tag Editor", desc: "Propose and edit game tags and categorization", category: "Games" },

	// Flair & Cosmetics (4)
	{ id: "cosmetic-custom-tag", name: "Custom Staff Tag", desc: "Equip and edit an exclusive custom tag flair", category: "Cosmetics" },
	{ id: "cosmetic-name-glow", name: "Staff Name Glow", desc: "Apply glowing animated staff aura to your username", category: "Cosmetics" },
	{ id: "bazaar-staff-discount", name: "Staff Bazaar Discount", desc: "Get an automatic 25% coin discount in the Bazaar", category: "Cosmetics" },
	{ id: "bazaar-exclusive-badge", name: "Staff Title Badge", desc: "Equip the exclusive verified Staff title badge", category: "Cosmetics" },

	// Server & Network (3)
	{ id: "server-motd-edit", name: "Edit MOTD", desc: "Update the site-wide Message of the Day header", category: "Server" },
	{ id: "server-maintenance-alert", name: "Maintenance Notice", desc: "Broadcast upcoming maintenance warnings", category: "Server" },
	{ id: "whitelist-manage", name: "Manage Whitelist", desc: "Add or remove members from beta access whitelists", category: "Server" }
];

export const ALL_PRIVILEGE_IDS = PRIVILEGES.map((p) => p.id);

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
	if (isPrivilegedUsername(user.username)) {
		return {
			rankName: "Owner",
			privileges: ALL_PRIVILEGE_IDS,
			presetId: null,
			isOwner: true
		};
	}
	const ranks = readRanks();
	const a = (ranks.assignments || {})[String(user.id)] || null;
	if (!a || !a.username) return { rankName: null, privileges: [], presetId: null, isOwner: false };
	if (String(user.username || "").toLowerCase() !== String(a.username).toLowerCase()) {
		return { rankName: null, privileges: [], presetId: null, isOwner: false };
	}
	const preset = a && a.presetId ? (ranks.presets || []).find((p) => p.id === a.presetId) : null;
	const privileges = [...new Set([...(a.privileges || []), ...(preset?.privileges || [])])];
	return {
		rankName: a?.rankName || preset?.name || null,
		privileges,
		presetId: a?.presetId || null,
		isOwner: false
	};
}

export function hasPrivilege(user, privilege) {
	if (!user) return false;
	if (isPrivilegedUsername(user.username)) return true;
	const r = userRank(user);
	return !!(r && r.privileges && r.privileges.includes(privilege));
}
