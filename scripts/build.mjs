import { mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await rm(`${root}/dist`, { recursive: true, force: true });
await mkdir(`${root}/dist`, { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'scoring.js', 'records.js', 'challenge.js', 'icon.svg', 'data', 'THIRD_PARTY_NOTICES.md']) {
  await cp(`${root}/${file}`, `${root}/dist/${file}`, { recursive: true });
}
console.log('Static site built in dist/');
