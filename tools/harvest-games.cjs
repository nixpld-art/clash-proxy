/**
 * Clash Proxy — Comprehensive Multi-Source Game Harvester
 * Scans web repositories and game archives to reach 10,000 unique games.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DATA_FILE = path.join(ROOT, 'games-data.js');

const TARGET_TOTAL = 10000;

// Ensure directory exists
if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });

// 1. Load existing games
let existingList = [];
try {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const jsonStr = raw.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, '').replace(/;\s*$/, '');
  existingList = JSON.parse(jsonStr);
} catch (e) {
  existingList = [];
}

const existingNorm = new Set();
const existingFiles = new Set(fs.readdirSync(GAMES_DIR).map(f => f.toLowerCase()));

for (const g of existingList) {
  if (g && g.title) {
    existingNorm.add(normalizeTitle(g.title));
  }
}

console.log(`[Init] Existing library: ${existingList.length} games (${existingFiles.size} files in games/)`);

function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeTitle(t) {
  return String(t || 'Game')
    .replace(/[<>&"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function slugify(title) {
  let s = 'cl' + title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 36);
  if (!s || s === 'cl') s = 'clgame' + Date.now().toString(36);
  return s;
}

function detectCategory(title) {
  const t = title.toLowerCase();
  if (/kart|race|racer|racing|drift|drive|driver|moto|bike|speed|run|dash|road/i.test(t)) return 'Racing';
  if (/soccer|football|basket|baseball|tennis|golf|box|boxing|hockey|skate|volley/i.test(t)) return 'Sports';
  if (/puzzle|2048|tetris|chess|checkers|soduku|sudoku|logic|match|block|brain|words/i.test(t)) return 'Puzzle';
  if (/shoot|gun|war|fight|fighter|combat|strike|kill|zombie|sniper|bullet|battle/i.test(t)) return 'Action';
  if (/mario|sonic|zelda|pokemon|kirby|mega|metroid|pacman|donkey|retro|arcade|classic|8bit/i.test(t)) return 'Retro';
  if (/rpg|quest|adventure|crawl|dungeon|legend|tale|island|story/i.test(t)) return 'Adventure';
  if (/tower|defense|tycoon|idle|clicker|craft|build|sim|strategy/i.test(t)) return 'Strategy';
  if (/jump|platform|climb|hop|fall/i.test(t)) return 'Platformer';
  return 'Arcade';
}

function getUniqueFilename(title) {
  let stem = slugify(title);
  let filename = stem + '.html';
  let counter = 1;
  while (existingFiles.has(filename.toLowerCase())) {
    filename = `${stem}${counter}.html`;
    counter++;
  }
  existingFiles.add(filename.toLowerCase());
  return filename;
}

function generateIframeGameHtml(title, targetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle(title)} — Clash Proxy</title>
  <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block;background:#000}</style>
</head>
<body>
  <iframe src="/classic/${targetUrl}" allow="autoplay; fullscreen; gamepad; clipboard-write; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>
</body>
</html>
`;
}

function generatePico8GameHtml(title, tid) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle(title)} — Clash Proxy</title>
  <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block;background:#000}</style>
</head>
<body>
  <iframe src="/classic/https://www.lexaloffle.com/bbs/widget.php?pid=${tid}" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
</body>
</html>
`;
}

function addGame(title, htmlContent, category) {
  const norm = normalizeTitle(title);
  if (!norm || norm.length < 2 || existingNorm.has(norm)) return false;

  const filename = getUniqueFilename(title);
  const filePath = path.join(GAMES_DIR, filename);

  fs.writeFileSync(filePath, htmlContent, 'utf8');
  existingNorm.add(norm);

  const newEntry = {
    title: safeTitle(title),
    url: `/games/${encodeURIComponent(filename)}`,
    cat: category || detectCategory(title),
    id: `harvest_${existingList.length + 1}`
  };
  existingList.push(newEntry);
  return true;
}

// -------------------------------------------------------------
// Source 1: skysthelimit.dev/selenite (GitLab)
// -------------------------------------------------------------
async function harvestSelenite() {
  console.log('[Harvest] Scanning Selenite (GitLab)...');
  try {
    const res = await fetch('https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/data/games.json');
    if (!res.ok) return;
    const list = await res.json();
    let count = 0;
    for (const item of list) {
      if (existingList.length >= TARGET_TOTAL) break;
      const title = item.name || item.title;
      if (!title) continue;
      const targetUrl = item.directory
        ? `https://skysthelimit.dev/selenite/semag/${item.directory}/`
        : item.url;
      if (!targetUrl) continue;
      const html = generateIframeGameHtml(title, targetUrl);
      if (addGame(title, html, item.category)) count++;
    }
    console.log(`[Harvest] Selenite added: ${count} unique games (Total: ${existingList.length})`);
  } catch (e) {
    console.log(`[Harvest] Selenite error: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Source 2: swarmintelli/Unblocked-Games-CDN (GitHub)
// -------------------------------------------------------------
async function harvestSwarmintelli() {
  console.log('[Harvest] Scanning Swarmintelli Unblocked Games CDN...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/swarmintelli/Unblocked-Games-CDN/main/games.json');
    if (!res.ok) return;
    const list = await res.json();
    let count = 0;
    for (const item of list) {
      if (existingList.length >= TARGET_TOTAL) break;
      const title = item.name || item.title;
      const targetUrl = item.game_url || item.url;
      if (!title || !targetUrl) continue;
      const html = generateIframeGameHtml(title, targetUrl);
      if (addGame(title, html)) count++;
    }
    console.log(`[Harvest] Swarmintelli added: ${count} unique games (Total: ${existingList.length})`);
  } catch (e) {
    console.log(`[Harvest] Swarmintelli error: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Source 3: UseInterstellar/Interstellar (GitHub)
// -------------------------------------------------------------
async function harvestInterstellar() {
  console.log('[Harvest] Scanning Interstellar games...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/UseInterstellar/Interstellar/main/static/assets/json/games.json');
    if (!res.ok) return;
    const list = await res.json();
    let count = 0;
    for (const item of list) {
      if (existingList.length >= TARGET_TOTAL) break;
      const title = item.name;
      const targetUrl = item.link;
      if (!title || !targetUrl || item.custom || item.blank) continue;
      const html = generateIframeGameHtml(title, targetUrl);
      if (addGame(title, html, item.categories?.[0])) count++;
    }
    console.log(`[Harvest] Interstellar added: ${count} unique games (Total: ${existingList.length})`);
  } catch (e) {
    console.log(`[Harvest] Interstellar error: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Source 4: Radon-Games/Radon-Games (GitHub)
// -------------------------------------------------------------
async function harvestRadon() {
  console.log('[Harvest] Scanning Radon-Games...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/Radon-Games/Radon-Games/main/src/games.json');
    if (!res.ok) return;
    const list = await res.json();
    let count = 0;
    for (const item of list) {
      if (existingList.length >= TARGET_TOTAL) break;
      const title = item.title;
      if (!title || !item.id) continue;
      const targetUrl = `https://radon.games/games/${item.id}`;
      const html = generateIframeGameHtml(title, targetUrl);
      if (addGame(title, html, item.tags?.[0])) count++;
    }
    console.log(`[Harvest] Radon-Games added: ${count} unique games (Total: ${existingList.length})`);
  } catch (e) {
    console.log(`[Harvest] Radon-Games error: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Source 5: 3kh0/3kh0-lite (GitHub)
// -------------------------------------------------------------
async function harvest3kh0() {
  console.log('[Harvest] Scanning 3kh0 lite...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/3kh0/3kh0-lite/main/config/games.json');
    if (!res.ok) return;
    const list = await res.json();
    let count = 0;
    for (const item of list) {
      if (existingList.length >= TARGET_TOTAL) break;
      const title = item.name;
      const targetUrl = item.url ? (item.url.startsWith('http') ? item.url : `https://3kh0.github.io/${item.url}`) : null;
      if (!title || !targetUrl) continue;
      const html = generateIframeGameHtml(title, targetUrl);
      if (addGame(title, html, item.category)) count++;
    }
    console.log(`[Harvest] 3kh0 added: ${count} unique games (Total: ${existingList.length})`);
  } catch (e) {
    console.log(`[Harvest] 3kh0 error: ${e.message}`);
  }
}

// -------------------------------------------------------------
// Source 6: Lexaloffle PICO-8 BBS Cartridges
// -------------------------------------------------------------
async function harvestLexaloffle(maxPages = 260) {
  console.log(`[Harvest] Scanning Lexaloffle PICO-8 BBS (up to ${maxPages} pages)...`);
  let totalPico = 0;
  for (let p = 1; p <= maxPages; p++) {
    if (existingList.length >= TARGET_TOTAL) {
      console.log(`[Harvest] Reached target ${TARGET_TOTAL} games!`);
      break;
    }
    try {
      const res = await fetch(`https://www.lexaloffle.com/bbs/lister.php?use_sub=1&cat=7&sub=2&page=${p}`);
      if (!res.ok) continue;
      const text = await res.text();
      const re = /<div id="pdat_\d+" class="thread_preview">[\s\S]*?<a href="\?tid=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      let pageAdded = 0;
      while ((m = re.exec(text)) !== null) {
        if (existingList.length >= TARGET_TOTAL) break;
        const tid = m[1];
        let title = m[2].replace(/<[^>]+>/g, '').trim();
        title = title.replace(/\s+/g, ' ');
        if (!title || title.length < 2 || title.length > 80) continue;
        if (/comments|replies|spam|post|update/i.test(title)) continue;

        const html = generatePico8GameHtml(title, tid);
        if (addGame(title, html, 'Retro')) {
          pageAdded++;
          totalPico++;
        }
      }
      if (p % 10 === 0 || p === maxPages) {
        console.log(`[Harvest] PICO-8 page ${p}/${maxPages} — Added ${totalPico} unique so far (Total games: ${existingList.length})`);
      }
      // Small pause to be gentle on server
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      // Continue on intermittent error
    }
  }
  console.log(`[Harvest] Lexaloffle PICO-8 added: ${totalPico} unique games (Total: ${existingList.length})`);
}

// -------------------------------------------------------------
// Main Execution & File Persistence
// -------------------------------------------------------------
async function main() {
  console.log('=== Starting Game Harvester ===');
  await harvestSelenite();
  await harvestSwarmintelli();
  await harvestInterstellar();
  await harvestRadon();
  await harvest3kh0();
  await harvestLexaloffle(260);

  console.log(`\n=== Harvesting Completed ===`);
  console.log(`Final Game Count: ${existingList.length}`);

  // Save updated games-data.js
  console.log(`Saving ${existingList.length} games to games-data.js...`);
  const outputJs = `var CLASH_GAMES = ${JSON.stringify(existingList)};\n`;
  fs.writeFileSync(DATA_FILE, outputJs, 'utf8');
  console.log(`[Success] games-data.js updated successfully!`);
}

main().catch(err => {
  console.error('[Error] Fatal harvester failure:', err);
  process.exit(1);
});
