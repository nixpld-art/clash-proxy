const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'games-data.js');
const GAMES_DIR = path.join(__dirname, '..', 'games');

// Target count: 6,500 total verified games
const TARGET_TOTAL = 6500;

const raw = fs.readFileSync(DATA_FILE, 'utf8');
const gamesList = JSON.parse(raw.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, '').replace(/;\s*$/, ''));

console.log(`[Init] Starting with ${gamesList.length} verified existing games.`);

const existingNorm = new Set();
for (const g of gamesList) {
  if (g && g.title) {
    existingNorm.add(normalizeTitle(g.title));
  }
}

function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanTitle(t) {
  let s = String(t || '').trim();
  s = s.replace(/\s*\(MS-DOS\)/gi, '')
       .replace(/\s*\(DOS\)/gi, '')
       .replace(/\s*\(Arcade\)/gi, '')
       .replace(/\s*\(\d{4}\)/g, '')
       .replace(/\s*\[.*?\]/g, '')
       .replace(/_/g, ' ')
       .replace(/\s+/g, ' ')
       .trim();
  if (s.endsWith(', The')) s = 'The ' + s.slice(0, -5);
  if (s.endsWith(', A')) s = 'A ' + s.slice(0, -3);
  return s.trim();
}

function slugify(identifier) {
  let s = 'cl' + identifier.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
  if (!s || s === 'cl') s = 'clg' + Date.now().toString(36);
  return s;
}

function generateLoaderHtml(title, targetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')} - Clash Games</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0b0d14; }
    iframe { width:100%; height:100%; border:none; display:block; }
  </style>
</head>
<body>
  <iframe src="/classic/${targetUrl}" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; gamepad; focus-without-user-activation *"></iframe>
</body>
</html>`;
}

function addGame(title, targetUrl, category) {
  const cleaned = cleanTitle(title);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 70) return false;
  const norm = normalizeTitle(cleaned);
  if (existingNorm.has(norm)) return false;

  const fileName = `${slugify(norm)}.html`;
  const filePath = path.join(GAMES_DIR, fileName);

  try {
    const html = generateLoaderHtml(cleaned, targetUrl);
    fs.writeFileSync(filePath, html, 'utf8');
    existingNorm.add(norm);
    gamesList.push({
      title: cleaned,
      url: `/games/${fileName}`,
      cat: category || 'Arcade',
      id: `clean_${gamesList.length + 1}`
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function harvest3kh0() {
  console.log('[Harvest] Scanning 3kh0 GitHub Pages...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/3kh0/3kh0-lite/main/config/games.json');
    if (!res.ok) return;
    const list = await res.json();
    let count = 0;
    for (const item of list) {
      if (gamesList.length >= TARGET_TOTAL) break;
      if (!item.title || !item.link) continue;
      const url = `https://3kh0.github.io/${item.link}`;
      if (addGame(item.title, url, 'Action')) count++;
    }
    console.log(`[Harvest] 3kh0 added ${count} games (Total: ${gamesList.length})`);
  } catch (e) {
    console.error('3kh0 error:', e.message);
  }
}

async function harvestInternetArcade() {
  console.log('[Harvest] Scanning Internet Arcade Collection...');
  let count = 0;
  for (let page = 1; page <= 6; page++) {
    if (gamesList.length >= TARGET_TOTAL) break;
    try {
      const url = `https://archive.org/advancedsearch.php?q=collection%3A(internetarcade)+AND+emulator%3A*&fl[]=identifier,title,downloads&sort[]=downloads+desc&rows=300&page=${page}&output=json`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const docs = data.response?.docs || [];
      for (const doc of docs) {
        if (gamesList.length >= TARGET_TOTAL) break;
        if (!doc.title || !doc.identifier) continue;
        const targetUrl = `https://archive.org/embed/${doc.identifier}`;
        if (addGame(doc.title, targetUrl, 'Arcade')) count++;
      }
      console.log(`[Harvest] Internet Arcade page ${page}: Total games now ${gamesList.length}`);
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error('Internet Arcade error:', e.message);
    }
  }
  console.log(`[Harvest] Internet Arcade finished. Added ${count} games.`);
}

async function harvestDosGames() {
  console.log('[Harvest] Scanning MS-DOS Games Collection...');
  let count = 0;
  for (let page = 1; page <= 12; page++) {
    if (gamesList.length >= TARGET_TOTAL) break;
    try {
      const url = `https://archive.org/advancedsearch.php?q=collection%3A(softwarelibrary_msdos_games)+AND+emulator%3A*&fl[]=identifier,title,downloads&sort[]=downloads+desc&rows=300&page=${page}&output=json`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const docs = data.response?.docs || [];
      for (const doc of docs) {
        if (gamesList.length >= TARGET_TOTAL) break;
        if (!doc.title || !doc.identifier) continue;
        const targetUrl = `https://archive.org/embed/${doc.identifier}`;
        if (addGame(doc.title, targetUrl, 'Retro')) count++;
      }
      console.log(`[Harvest] MS-DOS Games page ${page}: Total games now ${gamesList.length}`);
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error('MS-DOS Games error:', e.message);
    }
  }
  console.log(`[Harvest] MS-DOS Games finished. Added ${count} games.`);
}

async function main() {
  await harvest3kh0();
  await harvestInternetArcade();
  await harvestDosGames();

  console.log(`\n[Done] Total Games in Library: ${gamesList.length}`);
  
  // Save games-data.js
  const outputJs = 'var CLASH_GAMES = ' + JSON.stringify(gamesList, null, 2) + ';\n';
  fs.writeFileSync(DATA_FILE, outputJs, 'utf8');
  console.log('[Success] Saved updated library to games-data.js');

  const files = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.html'));
  console.log(`Verified files in games/: ${files.length}`);
  console.log(`Verified unique titles: ${existingNorm.size}`);
}

main().catch(console.error);
