const fs = require('fs');
const path = require('path');

const gamesDataRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const games = JSON.parse(gamesDataRaw.replace('var CLASH_GAMES = ', '').replace(/;\s*$/, ''));

const editmysite = games.filter(g => {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'games', g.url.replace('/games/', '')), 'utf8').includes('editmysite.com');
  } catch(e) { return false; }
});

async function main() {
  console.log('Testing', editmysite.length, 'editmysite games...');
  for (const g of editmysite) {
    const c = fs.readFileSync(path.join(__dirname, '..', 'games', g.url.replace('/games/', '')), 'utf8');
    const regex = /https?:\/\/[0-9a-zA-Z\-_]+\.preview\.editmysite\.com\/[^\s"']+/g;
    let match;
    const urls = [];
    while ((match = regex.exec(c)) !== null) {
      urls.push(match[0]);
    }
    if (urls.length === 0) continue;
    let anyOk = false;
    for (const u of urls.slice(0, 2)) {
      try {
        const res = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        if (res.ok) { anyOk = true; break; }
      } catch (err) {}
    }
    console.log(g.title, anyOk ? 'OK' : '404/DEAD');
  }
}

main().catch(console.error);
