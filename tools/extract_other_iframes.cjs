const fs = require('fs');
const path = require('path');

const gamesDataRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const games = JSON.parse(gamesDataRaw.replace('var CLASH_GAMES = ', '').replace(/;\s*$/, ''));
const files = games.map(g => ({ file: g.url.replace('/games/', ''), title: g.title, id: g.id }));

const otherIframe = [];
for (const item of files) {
  try {
    const c = fs.readFileSync(path.join(__dirname, '..', 'games', item.file), 'utf8');
    if (c.includes('<iframe') && !c.includes('archive.org')) {
      const m = c.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      otherIframe.push({ ...item, src: m ? m[1] : null });
    }
  } catch(e) {}
}

console.log('Total non-archive iframe games:', otherIframe.length);
fs.writeFileSync(path.join(__dirname, 'other_iframes.json'), JSON.stringify(otherIframe, null, 2));
