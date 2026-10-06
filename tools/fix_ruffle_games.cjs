const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const files = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.html'));

let fixed = 0;
let failed = 0;

for (const f of files) {
  const filePath = path.join(GAMES_DIR, f);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('player.load("$1")') || content.includes("player.load('$1')")) {
    // Find the SWF URL
    let swfUrl = null;
    const embedMatch = content.match(/<embed[^>]+src=["']([^"']+\.swf)["']/i);
    if (embedMatch) {
      swfUrl = embedMatch[1];
    } else {
      const paramMatch = content.match(/<param[^>]+value=["']([^"']+\.swf)["']/i);
      if (paramMatch) {
        swfUrl = paramMatch[1];
      }
    }

    if (swfUrl) {
      content = content.replace('player.load("$1")', 'player.load(' + JSON.stringify(swfUrl) + ')');
      content = content.replace("player.load('$1')", 'player.load(' + JSON.stringify(swfUrl) + ')');
      fs.writeFileSync(filePath, content, 'utf8');
      fixed++;
    } else {
      failed++;
      console.log('Could not find SWF URL in:', f);
    }
  }
}

console.log('Fixed Ruffle games:', fixed);
console.log('Failed Ruffle games:', failed);
