const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const files = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.html'));

console.log('Total HTML files in games/:', files.length);

let iframeClassicCount = 0;
let iframeExternalCount = 0;
let selfContainedCount = 0;
let emptyOrErrorCount = 0;
let targetDomains = {};

for (const f of files) {
  const content = fs.readFileSync(path.join(GAMES_DIR, f), 'utf8');
  if (content.length < 50 || content.includes('Error 404') || content.includes('That’s an error')) {
    emptyOrErrorCount++;
    continue;
  }

  const iframeMatch = content.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    const src = iframeMatch[1];
    if (src.startsWith('/classic/')) {
      iframeClassicCount++;
      const target = src.slice('/classic/'.length);
      try {
        const u = new URL(target.startsWith('http') ? target : 'https://' + target);
        targetDomains[u.hostname] = (targetDomains[u.hostname] || 0) + 1;
      } catch {
        targetDomains['invalid-url'] = (targetDomains['invalid-url'] || 0) + 1;
      }
    } else {
      iframeExternalCount++;
      try {
        const u = new URL(src.startsWith('http') ? src : 'https://' + src);
        targetDomains[u.hostname] = (targetDomains[u.hostname] || 0) + 1;
      } catch {
        targetDomains['other-src'] = (targetDomains['other-src'] || 0) + 1;
      }
    }
  } else {
    selfContainedCount++;
  }
}

console.log('Summary of game files:');
console.log('  Self-contained (HTML/JS games):', selfContainedCount);
console.log('  Iframe with /classic/:', iframeClassicCount);
console.log('  Iframe external/direct:', iframeExternalCount);
console.log('  Empty or 404:', emptyOrErrorCount);
console.log('\nTop iframe target domains:');
const sortedDomains = Object.entries(targetDomains).sort((a, b) => b[1] - a[1]);
console.log(sortedDomains.slice(0, 25));
