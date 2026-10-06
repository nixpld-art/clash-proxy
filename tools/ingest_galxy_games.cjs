const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const galxy = JSON.parse(fs.readFileSync(path.join(__dirname, 'galxy_verified_working.json'), 'utf8'));

console.log('Generating loaders for all', galxy.length, 'verified games from galxy.it.com...');

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateGameHtml(game) {
  const targetUrl = 'https://galxy.it.com/books/gmes/' + game.file_name;
  const escapedTitle = (game.title || 'Game').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle} - Clash Games</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0b0d14; }
    iframe { width:100%; height:100%; border:none; display:block; }
  </style>
</head>
<body>
  <iframe src="${targetUrl}" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; gamepad; clipboard-write; encrypted-media; focus-without-user-activation *"></iframe>
</body>
</html>
`;
}

// Upgrades for existing broken/outdated versions
const upgradeMap = {
  'tunnel rush': 'cltunnelrush.html',
  'there is no game': 'clthereisnofile.html',
  'burger and frights': 'clburgerandfrights.html',
  'slither.io': 'clslitherio.html',
  'volley random': 'clvolleyrandom.html',
  'mountain bike racer': 'clmountainbikeracer.html',
  'soccer random': 'clsoccerrandomgood.html',
  'tiny fishing': 'cltinyfishing.html'
};

const mapTagToCat = (tags) => {
  if (!tags || tags.length === 0) return 'Arcade';
  const t = tags.map(x => x.toLowerCase());
  if (t.includes('emulated') || t.includes('retro')) return 'Retro';
  if (t.includes('racing')) return 'Racing';
  if (t.includes('puzzle')) return 'Puzzle';
  if (t.includes('shooter') || t.includes('action')) return 'Action';
  if (t.includes('sports')) return 'Sports';
  if (t.includes('rhythm')) return 'Music';
  if (t.includes('strategy') || t.includes('simulation')) return 'Strategy';
  if (t.includes('platformer')) return 'Arcade';
  return 'Arcade';
};

const ingestedList = [];

for (const g of galxy) {
  const normTitle = g.title.toLowerCase().trim();
  let filename = '';

  if (upgradeMap[normTitle]) {
    filename = upgradeMap[normTitle];
  } else {
    const slug = slugify(g.title);
    filename = 'clgalxy_' + slug + '.html';
  }

  const filePath = path.join(GAMES_DIR, filename);
  fs.writeFileSync(filePath, generateGameHtml(g), 'utf8');

  ingestedList.push({
    title: g.title,
    url: '/games/' + filename,
    cat: mapTagToCat(g.tags),
    thumb: g.thumb ? ('https://galxy.it.com/books/' + g.thumb) : null,
    source: 'galxy.it.com'
  });
}

console.log('Ingested', ingestedList.length, 'games from galxy.it.com');
fs.writeFileSync(path.join(__dirname, 'galxy_ingested.json'), JSON.stringify(ingestedList, null, 2));
