import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html',
  'css/app.css',
  'data/defaults.js',
  'data/food-drinks.js',
  'js/formatters.js',
  'js/storage.js',
  'js/state.js',
  'js/calculations.js',
  'js/render/ui.js',
  'js/app.js'
];

for (const file of required) {
  if (!existsSync(resolve(root, file))) throw new Error(`File richiesto mancante: ${file}`);
}

const index = readFileSync(resolve(root, 'index.html'), 'utf8');
for (const source of required.filter(file => file.endsWith('.js'))) {
  if (!index.includes(`src=\"${source}\"`) && !index.includes(`src=\"${source}?`)) throw new Error(`Script non collegato: ${source}`);
  new Function(readFileSync(resolve(root, source), 'utf8'));
}

const publishableFiles = required.filter(file => !file.startsWith('scripts/')).concat('README.md');
for (const file of publishableFiles) {
  const content = readFileSync(resolve(root, file), 'utf8');
  if (/(?:file:\/\/|\/Users\/|[A-Z]:\\\\)/.test(content)) {
    throw new Error(`Percorso locale assoluto rilevato: ${file}`);
  }
}

console.log(`Verifica statica completata: ${required.length} file applicativi collegati e senza errori di sintassi.`);
