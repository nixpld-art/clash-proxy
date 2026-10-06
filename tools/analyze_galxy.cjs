const fs = require('fs');

async function main() {
  const appJsRes = await fetch('https://galxy.it.com/_app/immutable/entry/app.BvzzPbiY.js');
  const appJs = await appJsRes.text();
  console.log('appJs length:', appJs.length);

  const startJsRes = await fetch('https://galxy.it.com/_app/immutable/entry/start.B3o-lW5j.js');
  const startJs = await startJsRes.text();
  console.log('startJs length:', startJs.length);

  // Find all js imports or strings in startJs and appJs
  const regex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  const imports = new Set();
  while ((match = regex.exec(appJs)) !== null) {
    imports.add(match[1]);
  }
  while ((match = regex.exec(startJs)) !== null) {
    imports.add(match[1]);
  }
  console.log('Dynamic imports:', Array.from(imports));

  // Also search for games json or games api or routes
  const strings = appJs.match(/"([^"\\]|\\.)*"/g) || [];
  const candidateUrls = strings
    .map(s => s.slice(1, -1))
    .filter(s => s.includes('game') || s.includes('json') || s.includes('/api/') || s.includes('route'));
  console.log('Candidate strings in appJs:', candidateUrls.slice(0, 30));
}

main().catch(console.error);
