// Builds the static GitHub Pages demo in _site/ from the portal's frontend.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const output = path.join(root, '_site');

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), output, { recursive: true });

const config = { mode: 'demo', commit: (process.env.GITHUB_SHA ?? 'local').slice(0, 7) };
fs.writeFileSync(path.join(output, 'config.js'), `window.PORTAL_CONFIG = ${JSON.stringify(config)};\n`);

console.log(`Built the GitHub Pages demo for commit ${config.commit} in _site/`);
