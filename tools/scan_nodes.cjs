const fs = require('fs');

async function main() {
  const nodes = [
    '0.Buc0gXUX.js', '1.C5I5e0ro.js', '2.C9etD9rG.js', '3.BHwsOVp3.js',
    '4.DPIiwVs6.js', '5.s2-pSvnn.js', '6.DOpHNjJO.js', '7.B1wACx6R.js',
    '8.BTFiMstp.js', '9.CvrWCKRI.js', '10.B2OhR_Ew.js', '11.Dsvkcb-l.js',
    '12.DU8rsw66.js', '13.BZPz_Qp0.js'
  ];

  for (const node of nodes) {
    const url = `https://galxy.it.com/_app/immutable/nodes/${node}`;
    const res = await fetch(url);
    const text = await res.text();
    console.log(`Node ${node}: status ${res.status}, length ${text.length}`);
    if (text.includes('game') || text.includes('Game') || text.includes('play') || text.includes('json') || text.includes('http')) {
      console.log(`  -> matches in ${node}:`);
      // Find strings mentioning games or urls
      const matches = text.match(/"([^"\\]|\\.)*"/g) || [];
      const interesting = matches.map(s => s.slice(1, -1)).filter(s => 
        s.includes('game') || s.includes('Game') || s.includes('json') || s.includes('http') || s.startsWith('/')
      );
      console.log(`     Sample strings:`, interesting.slice(0, 15));
    }
  }
}

main().catch(console.error);
