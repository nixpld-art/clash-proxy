const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const gamesDataRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const games = JSON.parse(gamesDataRaw.replace('var CLASH_GAMES = ', '').replace(/;\s*$/, ''));

const otherCdns = {};

for (const g of games) {
  const relFile = g.url.replace(/^\/?games\//, '');
  const filePath = path.join(GAMES_DIR, relFile);
  if (!fs.existsSync(filePath)) continue;
  const c = fs.readFileSync(filePath, 'utf8');
  if (!c.includes('<iframe')) {
    const regex = /src=["'](https?:\/\/[^"']+)["']/g;
    let match;
    while ((match = regex.exec(c)) !== null) {
      try {
        const u = new URL(match[1]);
        otherCdns[u.hostname] = (otherCdns[u.hostname] || 0) + 1;
      } catch (e) {}
    }
  }
}

console.log('Script CDN dependencies in self-contained games:');
console.log(Object.entries(otherCdns).sort((a,b) => b[1] - a[1]).slice(0, 20));
