const fs = require('fs');
const path = require('path');

const gamesDataRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const games = JSON.parse(gamesDataRaw.replace('var CLASH_GAMES = ', '').replace(/;\s*$/, ''));
const files = games.map(g => g.url.replace('/games/', ''));

let fixable = 0;
let unfixable = 0;
const unfixableList = [];

for (const f of files) {
  const filePath = path.join(__dirname, '..', 'games', f);
  try {
    const c = fs.readFileSync(filePath, 'utf8');
    if (c.includes('player.load') && c.includes('$1')) {
      const m = c.match(/<embed[^>]+src=["']([^"']+\.swf)["']/i) || c.match(/<param[^>]+value=["']([^"']+\.swf)["']/i);
      if (m && m[1]) {
        fixable++;
      } else {
        unfixable++;
        unfixableList.push(f);
      }
    }
  } catch(e) {}
}

console.log('DollarOne fixable ruffle games:', fixable, 'Unfixable:', unfixable);
if (unfixableList.length > 0) {
  console.log('Unfixable games:', unfixableList);
}
