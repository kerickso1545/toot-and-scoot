/* Copy the game into packaging/www/ for Capacitor to bundle.
 *
 * The game at the repo root stays exactly what it has always been: plain
 * files, no build step, editable and refreshable. This script is the only
 * thing that knows the APK exists, and it just copies.
 *
 * Three deliberate differences from the web copy:
 *   - toot-and-scoot.html is copied AS index.html, because a WebView opens
 *     the webDir root. The repo's own index.html (a redirect that exists so
 *     the URL you type on a TV is short) is pointless inside an app.
 *   - The <link rel="manifest"> is dropped. A web app manifest only tells a
 *     browser how to "install" a page; inside a real APK it is dead weight.
 *   - sw.js is NOT copied. Every file is already on the device, so a service
 *     worker would only add a stale-copy risk on app updates. (js/main.js
 *     also declines to register on localhost, which is the APK's origin.)
 *
 * Run: node sync-www.js   (or npm run sync / npm run apk)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(__dirname, 'www');

const DIRS = ['css', 'js', 'vendor', 'icons'];
const GAME_HTML = 'toot-and-scoot.html';

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) n += copyDir(s, d);
    else { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

function main() {
  const game = path.join(ROOT, GAME_HTML);
  if (!fs.existsSync(game)) {
    console.error('Cannot find ' + GAME_HTML + ' at ' + ROOT);
    process.exit(1);
  }

  rmrf(WWW);
  fs.mkdirSync(WWW, { recursive: true });

  const gameHtml = fs.readFileSync(game, 'utf8')
    .split(/\r?\n/)
    .filter(function (line) { return line.indexOf('<link rel="manifest"') === -1; })
    .join('\n');
  fs.writeFileSync(path.join(WWW, 'index.html'), gameHtml);
  console.log('  ' + GAME_HTML + ' -> www/index.html  (manifest link stripped)');

  let total = 1;
  for (const d of DIRS) {
    const src = path.join(ROOT, d);
    if (!fs.existsSync(src)) { console.log('  (skipped missing ' + d + '/)'); continue; }
    const n = copyDir(src, path.join(WWW, d));
    console.log('  ' + d + '/ -> www/' + d + '/  (' + n + ' files)');
    total += n;
  }

  // Guard against the mistake this script exists to prevent: a <script src>
  // that didn't get copied would produce an app which launches to a black
  // screen with no error message anyone can see.
  const refs = [...gameHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(function (m) { return m[1]; })
    .filter(function (r) { return !/^(https?:)?\/\//.test(r) && r.charAt(0) !== '#'; })
    .map(function (r) { return r.split('?')[0]; });

  let missing = 0;
  for (const r of refs) {
    if (!fs.existsSync(path.join(WWW, r))) {
      console.error('  MISSING in www/: ' + r);
      missing++;
    }
  }
  if (missing) {
    console.error('\n' + missing + ' referenced file(s) did not get copied. Fix DIRS above.');
    process.exit(1);
  }

  console.log('\n' + total + ' files staged in www/, all ' + refs.length +
              ' referenced paths present.');
}

main();
