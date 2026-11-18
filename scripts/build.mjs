import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'assets'), { recursive: true });

await build({
  entryPoints: [resolve(root, 'game.js')],
  outfile: resolve(dist, 'assets/game.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  loader: { '.png': 'file' },
  assetNames: '[name]-[hash]',
  legalComments: 'eof',
});

const html = await readFile(resolve(root, 'index.html'), 'utf8');
const appHtml = html.replace('<script type="module" src="/game.js"></script>', '<script type="module" src="./assets/game.js"></script>');
if (appHtml === html) throw new Error('Could not rewrite the game entry script for the offline build.');
await writeFile(resolve(dist, 'index.html'), appHtml);
await cp(resolve(root, 'styles.css'), resolve(dist, 'styles.css'));
await mkdir(resolve(dist, 'THIRD_PARTY_LICENSES'), { recursive: true });
await cp(resolve(root, 'node_modules/three/LICENSE'), resolve(dist, 'THIRD_PARTY_LICENSES/three.txt'));
console.log('Built offline WebGL game into dist/');
