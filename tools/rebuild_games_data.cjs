const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const files = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.html'));

console.log('Total HTML files in games/:', files.length);

const oldGamesRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const oldGames = JSON.parse(oldGamesRaw.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, '').replace(/;\s*$/, ''));
const oldMap = new Map();
for (const g of oldGames) {
  const fn = decodeURIComponent(g.url.replace(/^\/games\//, ''));
  oldMap.set(fn, g);
}

const galxyIngested = JSON.parse(fs.readFileSync(path.join(__dirname, 'galxy_ingested.json'), 'utf8'));
const galxyMap = new Map();
for (const g of galxyIngested) {
  const fn = decodeURIComponent(g.url.replace(/^\/games\//, ''));
  galxyMap.set(fn, g);
}

// Popular keywords for priority scoring
const POPULAR_KEYWORDS = [
  "eaglercraft", "minecraft", "1v1.lol", "retro bowl", "subway surfers", 
  "slope", "bitlife", "cookie clicker", "geometry dash", "smash karts", 
  "basketball stars", "super mario", "tetris", "crossy road", "fnaf", 
  "five nights", "paper.io", "the oregon trail", "doom", "moto x3m", 
  "monkey mart", "sonic", "pac-man", "flappy bird", "run 3", "happy wheels", 
  "drift hunters", "drive mad", "ovo", "tunnel rush", "space invaders", 
  "street fighter", "mortal kombat", "galaga", "out run", "zelda", 
  "pokemon", "roblox", "prince of persia", "wolfenstein 3d", "simcity", 
  "aladdin", "metal gear", "bad ice cream", "fireboy and watergirl"
];

function getPopularRank(title) {
  if (!title) return 999999;
  const t = title.toLowerCase();
  for (let i = 0; i < POPULAR_KEYWORDS.length; i++) {
    if (t.includes(POPULAR_KEYWORDS[i])) return i;
  }
  return 999999;
}

function cleanTitle(fn) {
  return fn.replace(/^cl/, '')
    .replace(/\.html$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

const newGamesList = [];
let idCounter = 1;

for (const fn of files) {
  let title = '';
  let cat = 'Other';
  let thumb = null;

  if (galxyMap.has(fn)) {
    const g = galxyMap.get(fn);
    title = g.title;
    cat = g.cat || 'Arcade';
    thumb = g.thumb || null;
  } else if (oldMap.has(fn)) {
    const g = oldMap.get(fn);
    title = g.title;
    cat = g.cat || 'Other';
    thumb = g.thumb || null;
  } else {
    title = cleanTitle(fn);
  }

  newGamesList.push({
    title: title.trim(),
    url: '/games/' + encodeURIComponent(fn),
    cat: cat,
    id: `clash_${idCounter++}`,
    ...(thumb ? { thumb } : {})
  });
}

// Sort with popular games prioritized, then alphabetical
newGamesList.sort((a, b) => {
  const rankA = getPopularRank(a.title);
  const rankB = getPopularRank(b.title);
  if (rankA !== rankB) return rankA - rankB;
  return a.title.localeCompare(b.title);
});

// Re-assign clean sequential IDs
newGamesList.forEach((g, idx) => {
  g.id = `clash_${idx + 1}`;
});

console.log('Rebuilt games list. Total games:', newGamesList.length);
console.log('Top 15 games:');
console.log(newGamesList.slice(0, 15).map(g => ({ title: g.title, url: g.url, cat: g.cat })));

const outputJs = `var CLASH_GAMES = ${JSON.stringify(newGamesList, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'games-data.js'), outputJs, 'utf8');
console.log('Successfully wrote updated games-data.js!');
