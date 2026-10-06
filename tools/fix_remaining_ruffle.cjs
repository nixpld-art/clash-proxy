const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const files = [
  'clakoopasrevenge2.html',
  'clpapascheeseria.html',
  'clpapascupcakeria.html',
  'clpapashotdoggeria.html',
  'clpapasscooperia.html',
  'clpapassushiria.html',
  'clpapaswingeria.html',
  'clworldshardestgame3.html'
];

for (const f of files) {
  const filePath = path.join(GAMES_DIR, f);
  if (!fs.existsSync(filePath)) continue;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  let swfUrl = null;
  for (const l of lines) {
    if (l.includes('.swf')) {
      const idx = l.indexOf('http');
      if (idx !== -1) {
        const quoteIdx1 = l.indexOf('"', idx);
        const quoteIdx2 = l.indexOf('\'', idx);
        let endIdx = l.length;
        if (quoteIdx1 !== -1) endIdx = Math.min(endIdx, quoteIdx1);
        if (quoteIdx2 !== -1 && quoteIdx2 < endIdx) {
          // Check if quote is part of Papa's
          if (!l.slice(idx, endIdx).endsWith('.swf')) {
            // maybe it was quote inside url like Papa's
          }
        }
        // Match up to .swf
        const swfIdx = l.indexOf('.swf', idx);
        if (swfIdx !== -1) {
          swfUrl = l.slice(idx, swfIdx + 4);
          break;
        }
      }
    }
  }

  if (swfUrl) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace('player.load("$1")', 'player.load(' + JSON.stringify(swfUrl) + ')');
    content = content.replace("player.load('$1')", 'player.load(' + JSON.stringify(swfUrl) + ')');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', f, '->', swfUrl);
  } else {
    console.log('Failed for', f);
  }
}
