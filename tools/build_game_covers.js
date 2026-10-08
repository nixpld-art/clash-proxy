import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const selenitePath = path.join(__dirname, 'selenite_games.json');
const gamesDataPath = path.join(__dirname, '..', 'games-data.js');
const outputPath = path.join(__dirname, '..', 'public', 'game_covers.json');

const selenite = JSON.parse(fs.readFileSync(selenitePath, 'utf8'));
const raw = fs.readFileSync(gamesDataPath, 'utf8');
const clashGames = JSON.parse(raw.replace(/^\s*var\s+CLASH_GAMES\s*=\s*/, '').replace(/;\s*$/, ''));

const nameToUrl = new Map();
const dirToUrl = new Map();

selenite.forEach(g => {
  const url = `https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/${g.directory}/${g.image}`;
  const normName = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normDir = g.directory.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!nameToUrl.has(normName)) nameToUrl.set(normName, url);
  if (!dirToUrl.has(normDir)) dirToUrl.set(normDir, url);
});

const manualCovers = {
  'slope': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/slope/slope4.jpeg',
  'slope 2': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/slope2/slope-2-logo.png',
  'slope 3': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/slope3/cover.png',
  '1v1.lol': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/1v1lol/splash.png',
  'drive mad': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/drivemad/icons/icon-128.png',
  'retro bowl': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/retrobowl/img/icon.jpg',
  'retro bowl college': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/retrobowlcollege/unnamed.png',
  'subway surfers': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/subway-surfers-ny/NewYorkIcon.png',
  'cookie clicker': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/cookieclicker/img/perfectCookie.png',
  'bitlife': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/bitlife/bitlife.png',
  'eaglercraft': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/eaglercraft/image.png',
  'eaglercraft 1.5.2': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/eaglercraft/image.png',
  'eaglercraft 1.8.8': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/eaglercraft/image.png',
  'eaglercraft 1.12.2': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/eaglercraft/image.png',
  'geometry dash': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/gdlite/logo.png',
  'geometry dash lite': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/gdlite/logo.png',
  'moto x3m': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/motox3m/splash.jpg',
  'moto x3m winter': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/motox3m-winter/download.jpeg',
  'moto x3m pool party': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/motox3m-pool/splash.jpg',
  'moto x3m spooky land': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/motox3m-spooky/icon.png',
  'crossy road': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/crossyroad/chicken.png',
  'paper.io 2': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/paperio2/cover.png',
  'paper.io': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/paperio/icon.png',
  'basket random': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/basketrandom/test.png',
  'soccer random': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/soccerrandom/cover.png',
  'volley random': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/volleyrandom/cover.png',
  'boxing random': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/boxingrandom/cover.png',
  'smash karts': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/smashkarts/cover.png',
  'tunnel rush': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/tunnelrush/cover.png',
  'rooftop snipers': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/rooftopsnipers/cover.png',
  'drift hunters': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/drifthunters/cover.png',
  'getting over it': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/gettingoverit/cover.png',
  'snow rider 3d': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/snowrider3d/cover.png',
  'happy wheels': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/happywheels/cover.png',
  'super mario 64': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/sm64/cover.png',
  'five nights at freddys': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/fnaf/cover.png',
  'fnaf': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/fnaf/cover.png',
  'flappy bird': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/flappybird/cover.png',
  '2048': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/2048/cover.png',
  'bad ice cream': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/badicecream/cover.png',
  'duck life': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/ducklife/cover.png',
  'duck life 2': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/ducklife2/cover.png',
  'duck life 3': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/ducklife3/cover.png',
  'duck life 4': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/ducklife4/cover.png',
  'vex 3': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/vex3/cover.png',
  'vex 4': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/vex4/cover.png',
  'vex 5': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/vex5/cover.png',
  'vex 6': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/vex6/cover.png',
  'vex 7': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/vex7/cover.png',
  'worlds hardest game': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/hardestgame/cover.png',
  'baldis basics': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/baldisbasics/cover.png',
  'run 3': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/run3/cover.png',
  'temple run 2': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/templerun2/cover.png',
  'among us': 'https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/amongus/cover.png'
};

const finalMap = {};
for (const [k, v] of Object.entries(manualCovers)) {
  finalMap[k] = v;
}

selenite.forEach(g => {
  const url = `https://gitlab.com/skysthelimit.dev/selenite/-/raw/main/semag/${g.directory}/${g.image}`;
  finalMap[g.name.toLowerCase()] = url;
  finalMap[g.directory.toLowerCase()] = url;
});

let matched = 0;
clashGames.forEach(g => {
  const titleLow = (g.title || '').toLowerCase().trim();
  const kTitle = titleLow.replace(/[^a-z0-9]/g, '');
  const fname = (g.url || '').split('/').pop().replace(/\.html$/i, '');
  const kFile = fname.replace(/^cl/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (manualCovers[titleLow]) {
    finalMap[g.title] = manualCovers[titleLow];
    matched++;
    return;
  }

  let url = nameToUrl.get(kTitle) || dirToUrl.get(kFile) || nameToUrl.get(kFile);
  if (!url) {
    for (const [k, cUrl] of nameToUrl.entries()) {
      if (k.length > 5 && (kTitle === k || (kTitle.length > 5 && kTitle.includes(k)))) {
        url = cUrl;
        break;
      }
    }
  }

  if (url) {
    finalMap[g.title] = url;
    if (fname) finalMap[fname] = url;
    matched++;
  }
});

fs.writeFileSync(outputPath, JSON.stringify(finalMap, null, 2), 'utf8');
console.log(`Generated public/game_covers.json with ${Object.keys(finalMap).length} covers!`);
