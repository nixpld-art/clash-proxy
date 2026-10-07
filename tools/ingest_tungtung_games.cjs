/**
 * Ingest and replace games from tungtung-school.lavachamber.com into Clash Proxy.
 * Rules:
 *  - Games from TungTung that exist on Clash Proxy: replace with TungTung version.
 *  - Exception: Drive Mad is NOT replaced (preserved untouched).
 *  - Games on Clash Proxy that are NOT on TungTung: kept untouched.
 *  - Games on TungTung that are new: added to Clash Proxy.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DATA_FILE = path.join(ROOT, 'games-data.js');

// 1. Read existing Clash Proxy games
const rawClash = fs.readFileSync(DATA_FILE, 'utf8');
const jsonClash = rawClash.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, "").replace(/;\s*$/, "");
const clashGames = JSON.parse(jsonClash);

const clean = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const clashMapByClean = new Map();
const existingFiles = new Set(fs.readdirSync(GAMES_DIR).map(f => f.toLowerCase()));

for (const g of clashGames) {
  if (g && g.title) {
    const cName = clean(g.title);
    if (!clashMapByClean.has(cName)) {
      clashMapByClean.set(cName, g);
    }
  }
}

// 2. Read TungTung catalogs in priority order
const jsonNames = [
  'tung_m630d80d.json', // ports (Truffled) - priority 1
  'tung_m576e992.json', // tglsc - priority 2
  'tung_mc4d5af1.json', // gn-math - priority 3
  'tung_m882f408.json', // seraph - priority 4
  'tung_m8f04680.json', // hydra - priority 5
  'tung_mf113660.json'  // 3kh0 - priority 6
];

const catToClashCat = {
  'ports': 'Arcade',
  'tglsc': 'Arcade',
  'gn-math': 'Puzzle',
  'seraph': 'Action',
  'hydra': 'Action',
  '3kh0': 'Arcade'
};

function detectCategory(title, tungCat) {
  const t = title.toLowerCase();
  if (/kart|race|racer|racing|drift|drive|driver|moto|bike|speed|run|dash|road/i.test(t)) return 'Racing';
  if (/soccer|football|basket|baseball|tennis|golf|box|boxing|hockey|skate|volley/i.test(t)) return 'Sports';
  if (/puzzle|2048|tetris|chess|checkers|soduku|sudoku|logic|match|block|brain|words|math/i.test(t)) return 'Puzzle';
  if (/shoot|gun|war|fight|fighter|combat|strike|kill|zombie|sniper|bullet|battle/i.test(t)) return 'Action';
  if (/mario|sonic|zelda|pokemon|kirby|mega|metroid|pacman|donkey|retro|arcade|classic|8bit/i.test(t)) return 'Retro';
  if (/rpg|quest|adventure|crawl|dungeon|legend|tale|island|story/i.test(t)) return 'Adventure';
  if (/tower|defense|tycoon|idle|clicker|craft|build|sim|strategy/i.test(t)) return 'Strategy';
  if (/jump|platform|climb|hop|fall/i.test(t)) return 'Platformer';
  return catToClashCat[tungCat] || 'Arcade';
}

function slugify(title) {
  let s = 'cl' + (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 36);
  if (!s || s === 'cl') s = 'clgame' + Math.random().toString(36).slice(2, 8);
  return s;
}

function getUniqueFilename(title) {
  let stem = slugify(title);
  let filename = stem + '.html';
  let counter = 2;
  while (existingFiles.has(filename.toLowerCase())) {
    filename = `${stem}${counter}.html`;
    counter++;
  }
  existingFiles.add(filename.toLowerCase());
  return filename;
}

function generateGameHtml(title, targetUrl) {
  const safeTitle = (title || 'Game').replace(/[<>&"']/g, '');
  const jsonUrl = JSON.stringify(targetUrl);

  if (/^https:\/\/cdn\.jsdelivr\.net\//i.test(targetUrl)) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — Clash Games</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0b0d14; }
    iframe { width:100%; height:100%; border:none; display:block; }
  </style>
</head>
<body>
  <iframe id="game-frame" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; gamepad; clipboard-write; encrypted-media; focus-without-user-activation *"></iframe>
  <script>
    (async function() {
      const frame = document.getElementById('game-frame');
      const target = ${jsonUrl};
      try {
        let res;
        try {
          res = await fetch(target);
        } catch (e) {
          res = await fetch('/classic/' + target);
        }
        if (!res.ok) res = await fetch('/classic/' + target);
        const html = await res.text();
        const base = '<base href="' + target.replace(/[^/]*$/, '') + '">';
        let out = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, '$&' + base) : (base + html);
        frame.srcdoc = out;
      } catch (e) {
        frame.src = '/classic/' + target;
      }
    })();
  </script>
</body>
</html>
`;
  } else {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — Clash Games</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0b0d14; }
    iframe { width:100%; height:100%; border:none; display:block; }
  </style>
</head>
<body>
  <iframe id="game-frame" src="${targetUrl.replace(/"/g, '&quot;')}" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; gamepad; clipboard-write; encrypted-media; focus-without-user-activation *"></iframe>
  <script>
    const frame = document.getElementById('game-frame');
    frame.addEventListener('error', function() {
      frame.src = '/classic/' + ${jsonUrl};
    });
  </script>
</body>
</html>
`;
  }
}

// 3. Collect unique TungTung games
const tungUnique = new Map();
for (const jn of jsonNames) {
  const filePath = path.join(ROOT, jn);
  if (!fs.existsSync(filePath)) continue;
  const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const item of list) {
    if (!item || !item.name || !item.url) continue;
    const name = item.name.trim();
    const cName = clean(name);
    if (!cName) continue;

    if (!tungUnique.has(cName)) {
      let fullUrl = item.url;
      if (!/^https?:\/\//i.test(fullUrl)) {
        if (!fullUrl.startsWith('/')) fullUrl = '/' + fullUrl;
        fullUrl = 'https://tungtung-school.lavachamber.com' + fullUrl;
      }
      tungUnique.set(cName, {
        name,
        cleanName: cName,
        url: fullUrl,
        category: item.category || 'other'
      });
    }
  }
}

console.log(`Loaded ${tungUnique.size} unique games from TungTung`);

let replacedCount = 0;
let preservedDriveMad = 0;
let addedCount = 0;
const finalGamesList = [...clashGames];
const existingIndexMap = new Map();
clashGames.forEach((g, idx) => {
  if (g && g.title) {
    existingIndexMap.set(clean(g.title), idx);
  }
});

for (const [cName, tungGame] of tungUnique.entries()) {
  // EXCEPTION: Drive Mad must never be replaced!
  if (cName === 'drivemad') {
    preservedDriveMad++;
    console.log('[Preserved] Drive Mad preserved as Clash native version (not replaced).');
    continue;
  }

  if (existingIndexMap.has(cName)) {
    // REPLACE existing game with TungTung version
    const idx = existingIndexMap.get(cName);
    const existing = finalGamesList[idx];
    const filename = decodeURIComponent(existing.url.replace(/^\/games\//, ''));
    const targetFile = path.join(GAMES_DIR, filename);

    // Overwrite the game file with TungTung version
    const html = generateGameHtml(tungGame.name, tungGame.url);
    fs.writeFileSync(targetFile, html, 'utf8');

    // Update games-data.js entry
    existing.title = tungGame.name;
    existing.cat = detectCategory(tungGame.name, tungGame.category);
    replacedCount++;
  } else {
    // ADD NEW game from TungTung
    const filename = getUniqueFilename(tungGame.name);
    const targetFile = path.join(GAMES_DIR, filename);

    const html = generateGameHtml(tungGame.name, tungGame.url);
    fs.writeFileSync(targetFile, html, 'utf8');

    const newEntry = {
      title: tungGame.name,
      url: `/games/${encodeURIComponent(filename)}`,
      cat: detectCategory(tungGame.name, tungGame.category),
      id: `tung_${finalGamesList.length + 1}`
    };
    finalGamesList.push(newEntry);
    addedCount++;
  }
}

// 4. Save updated games-data.js
const outputCode = 'var CLASH_GAMES = ' + JSON.stringify(finalGamesList, null, 2) + ';\n';
fs.writeFileSync(DATA_FILE, outputCode, 'utf8');

console.log('\n=== INGESTION SUMMARY ===');
console.log(`Total games in library before: ${clashGames.length}`);
console.log(`Existing games replaced with TungTung versions: ${replacedCount}`);
console.log(`Drive Mad preserved: ${preservedDriveMad}`);
console.log(`Clash games kept untouched (not on TungTung): ${clashGames.length - replacedCount}`);
console.log(`New games added from TungTung: ${addedCount}`);
console.log(`Total games in library now: ${finalGamesList.length}`);
