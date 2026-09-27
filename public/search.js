"use strict";

/**
 * Converts user input into a fully qualified URL.
 */
function search(input, template) {
	if (!input) return "";
	const trimmed = input.trim();
	if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("http://localhost") || trimmed.startsWith("http://127.0.0.1")) {
		return trimmed;
	}
	const tpl = template || (typeof _CONFIG !== "undefined" && _CONFIG.searchEngine) || "https://duckduckgo.com/?q=%s";

	try {
		return new URL(trimmed).toString();
	} catch (err) {}

	try {
		const urlWithProtocol = new URL(`https://${trimmed}`);
		if (urlWithProtocol.hostname.includes(".")) {
			return urlWithProtocol.toString();
		}
	} catch (err) {}

	return tpl.replace("%s", encodeURIComponent(trimmed));
}

window.search = search;
window.resolveSearchUrl = search;
