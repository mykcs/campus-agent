const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const root = path.resolve('dist');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const reader = fs.readFileSync(path.join(root, 'agent/index.html'), 'utf8');
const assets = [...new Set([home, reader].flatMap(html => [...html.matchAll(/<link\b[^>]*href="(\/_astro\/[^"]+\.css)"[^>]*>/g)].map(m => m[1])))].sort();
assert.ok(assets.length, 'Astro must emit external Tailwind CSS');
const compiled = assets.map(asset => fs.readFileSync(path.join(root,asset.slice(1)), 'utf8')).join('\n');
assert.match(compiled, /\.gap-campus-24\s*\{/);
assert.match(compiled, /var\(--space-24\)/);
assert.match(compiled, /\.min-w-0\s*\{/);
assert.match(compiled, /\.min-h-screen\s*\{/);
for (const html of [home,reader]) {
  assert.match(html, /<link\b[^>]*href="\/_astro\/[^"]+\.css"/);
  assert.doesNotMatch(html, /<style\b|<script\b(?![^>]*\bsrc=)/i, 'CSP requires external script and style');
}
const file = path.join(root, 'sw.js');
const sw = fs.readFileSync(file, 'utf8');
const manifest = JSON.stringify(assets);
assert.ok(sw.includes('/* BUILD_ASSETS */ []'), 'service worker asset marker absent');
const revision = createHash('sha256');
for (const name of ['index.html','styles.css','app.js','source-core.js','push-settings.js','display-date.js','taskboard-core.js','taskboard.js','icon.svg','sw.js',...assets.map(a=>a.slice(1))]) {
  revision.update(name).update(fs.readFileSync(path.join(root,name)));
}
const cacheRevision=revision.digest('hex').slice(0,16);
assert.ok(sw.includes('/* BUILD_REVISION */ "development"'));
fs.writeFileSync(file, sw.replace('/* BUILD_ASSETS */ []', manifest).replace('/* BUILD_REVISION */ "development"', JSON.stringify(cacheRevision)));
console.log('External compiled styles cached by PWA shell:', manifest);
