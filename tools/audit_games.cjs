const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const gamesDataRaw = fs.readFileSync(path.join(__dirname, '..', 'games-data.js'), 'utf8');
const games = JSON.parse(gamesDataRaw.replace('var CLASH_GAMES = ', '').replace(/;\s*$/, ''));

console.log('Total games in games-data.js:', games.length);

const broken = [];
const valid = [];

for (const game of games) {
  const relFile = decodeURIComponent(game.url.replace(/^\/?games\//, ''));
  const filePath = path.join(GAMES_DIR, relFile);

  if (!fs.existsSync(filePath)) {
    broken.push({ id: game.id, title: game.title, reason: 'File does not exist: ' + relFile });
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.length < 50) {
    broken.push({ id: game.id, title: game.title, reason: 'File too small (<50 bytes)' });
    continue;
  }

  // Check for unrendered template variables
  if (content.includes('${bypassurl}') || content.includes('${default_url}') || content.includes('${bypassUrl}')) {
    broken.push({ id: game.id, title: game.title, reason: 'Unrendered template variable in file' });
    continue;
  }

  // Check for empty iframe src
  if (content.includes('id="fr"') && content.includes('src=""')) {
    broken.push({ id: game.id, title: game.title, reason: 'Empty iframe src' });
    continue;
  }

  // Check for error pages
  if (content.includes('Error 404') || content.includes('404 Not Found') || content.includes('That’s an error')) {
    broken.push({ id: game.id, title: game.title, reason: 'Contains 404 / error content' });
    continue;
  }

  valid.push({ game, filePath, content });
}

console.log('Audit complete:');
console.log('Valid games:', valid.length);
console.log('Broken/Invalid games:', broken.length);
if (broken.length > 0) {
  console.log('Broken sample:', broken.slice(0, 10));
}
