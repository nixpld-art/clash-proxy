"use strict";

/**
 * Converts user input into a fully qualified URL.
 * - If the input is already a valid URL, returns it as-is.
 * - If adding "https://" makes it a valid URL with a dot in the host, uses that.
 * - Otherwise, searches using the configured search engine.
 *
 * @param {string} input - Raw user input from the search bar.
 * @param {string} template - Search engine URL template (%s = query).
 * @returns {string} Fully qualified URL.
 */
function search(input, template) {
	try {
		// Input is already a valid URL (e.g., https://example.com)
		return new URL(input).toString();
	} catch (err) {
		// Not a valid URL as-is
	}

	try {
		// Input might be a domain (e.g., example.com or example.com/path)
		const urlWithProtocol = new URL(`https://${input}`);
		if (urlWithProtocol.hostname.includes(".")) {
			return urlWithProtocol.toString();
		}
	} catch (err) {
		// Not a valid domain either
	}

	// Fall back to search engine
	return template.replace("%s", encodeURIComponent(input));
}
