// Gera um HTML único (Aetheria.html) que roda com duplo clique, sem servidor.
// Uso: node scripts/build-single.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpBundle = resolve(root, 'dist/.bundle.js');

console.log('• Empacotando src/main.js com esbuild…');
execFileSync('npx', ['--yes', 'esbuild', 'src/main.js',
  '--bundle', '--minify', '--format=iife', '--legal-comments=none',
  `--outfile=${tmpBundle}`], { cwd: root, stdio: 'inherit' });

let js = readFileSync(tmpBundle, 'utf8');
// segurança: evita fechar o <script> por acidente
js = js.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(resolve(root, 'src/ui/style.css'), 'utf8');
let html = readFileSync(resolve(root, 'index.html'), 'utf8');

// remove link de CSS externo, importmap e módulo; injeta tudo inline
html = html.replace(/<link rel="stylesheet" href="src\/ui\/style\.css">\s*/, `<style>\n${css}\n</style>\n`);
html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>\s*/, '\n');
html = html.replace(/\s*<script type="module" src="src\/main\.js"><\/script>/, `\n  <script>\n${js}\n  </script>`);

mkdirSync(resolve(root, 'dist'), { recursive: true });
const out = resolve(root, 'dist/Aetheria.html');
writeFileSync(out, html);
mkdirSync(resolve(root, 'release'), { recursive: true });
copyFileSync(out, resolve(root, 'release/Aetheria.html'));
writeFileSync(resolve(root, 'dist/.bundle.js'), '');
console.log(`✓ Gerado: ${out}`);
console.log(`✓ Cópia:  release/Aetheria.html`);
console.log(`  Tamanho: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
