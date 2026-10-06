const fs = require('fs');
const path = require('path');

const gamesDataRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const games = JSON.parse(gamesDataRaw.replace('var CLASH_GAMES = ', '').replace(/;\s*$/, ''));

const nonArchive = games.filter(g => {
  try {
    return !fs.readFileSync(path.join(__dirname, '..', 'games', g.url.replace('/games/', '')), 'utf8').includes('archive.org');
  } catch(e) { return false; }
});
console.log('Total non-archive games:', nonArchive.length);

const broken = [];
const working = [];

for (const g of nonArchive) {
  const f = g.url.replace('/games/', '');
  const filePath = path.join(__dirname, '..', 'games', f);
  try {
    const c = fs.readFileSync(filePath, 'utf8');
    if (c.length < 50) {
      broken.push({ id: g.id, title: g.title, reason: 'Too small' });
      continue;
    }
    if (c.includes('{bypass') || (c.includes('id="fr"') && c.includes('src=""'))) {
      broken.push({ id: g.id, title: g.title, reason: 'Broken template' });
      continue;
    }
    if (c.includes('Error 404') || c.includes('404 Not Found') || c.includes('That’s an error')) {
      broken.push({ id: g.id, title: g.title, reason: '404 content' });
      continue;
    }
    working.push(g);
  } catch(e) {
    broken.push({ id: g.id, title: g.title, reason: 'Missing file' });
  }
}

console.log('Working non-archive games:', working.length);
console.log('Broken non-archive games:', broken.length);
if (broken.length > 0) {
  console.log('Broken list:', broken);
}
