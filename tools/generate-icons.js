import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const iconsDir = join(process.cwd(), "public/assets/icons");
const gamesDir = join(process.cwd(), "public/assets/games");
mkdirSync(iconsDir, { recursive: true });
mkdirSync(gamesDir, { recursive: true });

const icons = {
	"discord.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,

	"reddit.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.609a1.24 1.24 0 0 1 1.108-.693zM8.618 10.742a1.328 1.328 0 1 0 0 2.656 1.328 1.328 0 0 0 0-2.656zm6.764 0a1.328 1.328 0 1 0 0 2.656 1.328 1.328 0 0 0 0-2.656zm-6.66 4.394a.434.434 0 0 0-.084.606c.683.844 2.052 1.309 3.362 1.309 1.31 0 2.679-.465 3.362-1.309a.434.434 0 0 0-.686-.532c-.482.595-1.554.957-2.676.957-1.122 0-2.194-.362-2.676-.957a.434.434 0 0 0-.602-.074z"/></svg>`,

	"twitch.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#A970FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>`,

	"wikipedia.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#F8FAFC"><path d="M12.09 13.124 8.16 2.399H5.503L.085 17.51h2.518l1.455-4.244h5.362l1.246 4.244h2.576l-1.152-4.386zm-5.748-1.92 2.025-5.918 1.954 5.918H6.342zm11.954-8.805h-2.657l-3.84 10.493 2.115 5.7h2.477l1.32-4.073h5.454l1.308 4.073h2.527L21.572 2.399h-2.628l-2.648 8.084zm.824 8.358 1.996-5.845 1.956 5.845H19.12z"/></svg>`,

	"github.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#F8FAFC"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,

	"plus.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#00f2fe" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,

	"globe.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,

	"gamepad.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><circle cx="15" cy="13" r="1" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r="1" fill="currentColor"></circle><path d="M18.7 18.7a8.5 8.5 0 0 0 2.3-5.7v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2a8.5 8.5 0 0 0 2.3 5.7L7 21h10l1.7-2.3z"></path></svg>`,

	"sound.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,

	"ai.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path><circle cx="12" cy="12" r="4"></circle></svg>`,

	"shield.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,

	"gear.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,

	"star.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#EAB308" stroke="#EAB308" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,

	"flame.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#F97316"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,

	"history.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline><polyline points="12 7 12 12 15 15"></polyline></svg>`,

	"energy.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#00f2fe"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,

	"link.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,

	"external.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,

	// 10 Badges
	"badge-spark.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#00f2fe" stroke-width="2"/><polygon points="26 8 12 26 24 26 22 40 36 22 24 22 26 8" fill="#00f2fe"/></svg>`,
	"badge-veteran.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#6366f1" stroke-width="2"/><path d="M37.4 37.4a17 17 0 0 0 4.6-11.4v-4a10 10 0 0 0-10-10H16a10 10 0 0 0-10 10v4a17 17 0 0 0 4.6 11.4L14 42h20l3.4-4.6z" fill="#6366f1"/><line x1="12" y1="24" x2="20" y2="24" stroke="#fff" stroke-width="3"/><line x1="16" y1="20" x2="16" y2="28" stroke="#fff" stroke-width="3"/><circle cx="30" cy="26" r="2" fill="#fff"/><circle cx="35" cy="21" r="2" fill="#fff"/></svg>`,
	"badge-master.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#eab308" stroke-width="2"/><polygon points="8 36 12 16 20 26 24 12 28 26 36 16 40 36" fill="#eab308"/><circle cx="12" cy="14" r="2.5" fill="#fef08a"/><circle cx="24" cy="10" r="2.5" fill="#fef08a"/><circle cx="36" cy="14" r="2.5" fill="#fef08a"/></svg>`,
	"badge-gateway.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#10b981" stroke-width="2"/><circle cx="24" cy="24" r="14" fill="none" stroke="#10b981" stroke-width="2.5"/><line x1="10" y1="24" x2="38" y2="24" stroke="#10b981" stroke-width="2"/><path d="M24 10a18 18 0 0 1 5 14 18 18 0 0 1-5 14 18 18 0 0 1-5-14 18 18 0 0 1 5-14z" fill="none" stroke="#10b981" stroke-width="2"/></svg>`,
	"badge-voyager.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#f43f5e" stroke-width="2"/><path d="M24 8l10 14-6 4 4 10-8-4-8 4 4-10-6-4z" fill="#f43f5e"/></svg>`,
	"badge-sonic.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#a855f7" stroke-width="2"/><polygon points="22 10 12 18 4 18 4 30 12 30 22 38 22 10" fill="#a855f7"/><path d="M30 14a12 12 0 0 1 0 20M36 8a20 20 0 0 1 0 32" fill="none" stroke="#a855f7" stroke-width="3" stroke-linecap="round"/></svg>`,
	"badge-neural.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#06b6d4" stroke-width="2"/><rect x="14" y="14" width="20" height="20" rx="4" fill="none" stroke="#06b6d4" stroke-width="2.5"/><circle cx="20" cy="20" r="2" fill="#06b6d4"/><circle cx="28" cy="20" r="2" fill="#06b6d4"/><line x1="20" y1="28" x2="28" y2="28" stroke="#06b6d4" stroke-width="2"/><line x1="24" y1="8" x2="24" y2="14" stroke="#06b6d4" stroke-width="2"/><line x1="24" y1="34" x2="24" y2="40" stroke="#06b6d4" stroke-width="2"/></svg>`,
	"badge-chameleon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#ec4899" stroke-width="2"/><path d="M24 10s10 4 10 12c0 8-10 16-10 16S14 30 14 22c0-8 10-12 10-12z" fill="#ec4899"/><circle cx="24" cy="22" r="4" fill="#fff"/></svg>`,
	"badge-void.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#8b5cf6" stroke-width="2"/><path d="M14 34L34 14M34 14H20M34 14V28" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	"badge-customizer.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/><polygon points="24 8 28.5 17 38 18.5 31 25.5 33 35 24 30 15 35 17 25.5 10 18.5 19.5 17 24 8" fill="#f59e0b"/></svg>`
};

for (const [name, content] of Object.entries(icons)) {
	writeFileSync(join(iconsDir, name), content, "utf8");
}

console.log("Generated " + Object.keys(icons).length + " icons!");

// Generate Drive Mad hero cover art
const driveMadBanner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360" width="800" height="360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#091326"/>
      <stop offset="50%" stop-color="#0e2340"/>
      <stop offset="100%" stop-color="#040812"/>
    </linearGradient>
    <linearGradient id="truck" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="800" height="360" fill="url(#bg)"/>
  <!-- Mountain / Hill tracks -->
  <path d="M0 290 Q 200 240 400 270 T 800 220 L 800 360 L 0 360 Z" fill="#1e293b"/>
  <path d="M0 310 Q 250 270 500 300 T 800 280 L 800 360 L 0 360 Z" fill="#0f172a"/>
  <!-- Bridge Obstacle Blocks -->
  <rect x="220" y="240" width="60" height="20" rx="3" fill="#334155"/>
  <rect x="300" y="220" width="60" height="20" rx="3" fill="#334155"/>
  <rect x="380" y="200" width="60" height="20" rx="3" fill="#334155"/>
  <!-- 4x4 Offroad Monster Truck -->
  <g transform="translate(420, 110) rotate(-12)">
    <!-- Chassis -->
    <rect x="40" y="50" width="120" height="40" rx="8" fill="url(#truck)"/>
    <rect x="70" y="20" width="70" height="35" rx="6" fill="#0284c7"/>
    <!-- Windows -->
    <polygon points="76,48 100,28 132,28 132,48" fill="#bae6fd" opacity="0.85"/>
    <!-- Big Monster Wheels -->
    <circle cx="50" cy="100" r="32" fill="#0f172a" stroke="#475569" stroke-width="8"/>
    <circle cx="50" cy="100" r="14" fill="#94a3b8"/>
    <circle cx="150" cy="100" r="32" fill="#0f172a" stroke="#475569" stroke-width="8"/>
    <circle cx="150" cy="100" r="14" fill="#94a3b8"/>
    <!-- Suspension springs -->
    <line x1="50" y1="70" x2="50" y2="90" stroke="#f59e0b" stroke-width="5"/>
    <line x1="150" y1="70" x2="150" y2="90" stroke="#f59e0b" stroke-width="5"/>
    <!-- Flame exhaust -->
    <path d="M30 65 Q 10 60 5 75 Q 15 70 30 72 Z" fill="url(#accent)"/>
  </g>
  <!-- Speed lines -->
  <line x1="180" y1="130" x2="350" y2="130" stroke="#00f2fe" stroke-width="3" stroke-dasharray="20,15" opacity="0.4"/>
  <line x1="220" y1="150" x2="380" y2="150" stroke="#00f2fe" stroke-width="2" stroke-dasharray="30,10" opacity="0.3"/>
</svg>`;

writeFileSync(join(gamesDir, "drivemad-hero.svg"), driveMadBanner, "utf8");
console.log("Generated Drive Mad hero banner!");
