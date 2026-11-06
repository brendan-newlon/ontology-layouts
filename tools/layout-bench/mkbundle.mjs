// Concatenate the layout code, models and experiments into one module so it runs at native speed (vm contexts are ~20x slower).
import fs from 'node:fs';
const rd = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const head = `import fs from 'node:fs';\nconst window = {}; const document = {};\nconst fetch = async (p) => ({ text: async () => fs.readFileSync(new URL('../..' + p, import.meta.url), 'utf8') });\n`;
const body = [rd('base_layout.js'), rd('models.js'), rd('models2.js'), rd('models3.js').replace(/const SMALL_KEYS[^\n]*/, ''), rd('models4.js'), rd('engines2.js'), rd('engines3.js')].join('\n');
fs.writeFileSync(new URL('_bundle.mjs', import.meta.url), head + body + '\nconst OURS = window.OURS;\nexport { MODELS, OURS, EXP, EXP3, x2Leaves, _ogClSegBox };\n');
