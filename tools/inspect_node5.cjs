const fs = require('fs');

async function main() {
  const res = await fetch('https://galxy.it.com/_app/immutable/nodes/5.s2-pSvnn.js');
  const code = await res.text();
  
  // Find where gmes.json is used
  const idx = code.indexOf('gmes.json');
  if (idx !== -1) {
    console.log('Context around gmes.json:');
    console.log(code.slice(Math.max(0, idx - 300), Math.min(code.length, idx + 500)));
  }

  // Also check books page HTML
  const booksRes = await fetch('https://galxy.it.com/books');
  const booksHtml = await booksRes.text();
  console.log('\nBooks HTML length:', booksHtml.length);
  console.log(booksHtml.slice(0, 1500));
}

main().catch(console.error);
