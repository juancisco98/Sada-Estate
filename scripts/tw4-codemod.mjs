// Codemod Tailwind v3 → v4: renombra utilities cuya escala/nombre cambió en v4
// para preservar EXACTAMENTE el mismo render visual.
//
// Uso:
//   node scripts/tw4-codemod.mjs --dry    → reporta ocurrencias sin escribir
//   node scripts/tw4-codemod.mjs          → aplica los cambios
//
// Sólo toca tokens exactos dentro de strings de clases: el token debe estar
// precedido por inicio-de-clase (espacio, comilla, backtick o ':') y seguido
// por fin-de-clase (espacio, comilla, backtick). NUNCA matchea variantes
// hifenadas (shadow-lg, rounded-xl, ring-2, blur-md quedan intactas).

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DRY = process.argv.includes('--dry');

// Orden IMPORTANTE: primero las variantes -sm, después las peladas.
const RENAMES = [
  ['shadow-sm', 'shadow-xs'],
  ['shadow', 'shadow-sm'],
  ['drop-shadow-sm', 'drop-shadow-xs'],
  ['drop-shadow', 'drop-shadow-sm'],
  ['rounded-sm', 'rounded-xs'],
  ['rounded', 'rounded-sm'],
  ['blur-sm', 'blur-xs'],
  ['blur', 'blur-sm'],
  ['ring', 'ring-3'], // v3 ring = 3px; v4 ring = 1px
  ['outline-none', 'outline-hidden'],
];

// Boundary: antes = inicio/espacio/comilla/backtick/dos-puntos (variante);
// después = fin/espacio/comilla/backtick. Excluye guion y \w siguientes.
const makeRe = (tok) =>
  new RegExp(`(^|[\\s"'\`:])(${tok.replace(/[-]/g, '\\-')})(?=[\\s"'\`]|$)`, 'g');

const ROOTS = ['components', 'App.tsx', 'index.tsx'];
const EXTS = new Set(['.tsx', '.ts']);

function walk(p, acc) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) walk(join(p, e), acc);
  } else if (EXTS.has(extname(p))) {
    acc.push(p);
  }
  return acc;
}

const files = ROOTS.flatMap((r) => walk(r, []));
const totals = Object.fromEntries(RENAMES.map(([f]) => [f, 0]));
let changedFiles = 0;

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  let out = src;
  for (const [from, to] of RENAMES) {
    out = out.replace(makeRe(from), (_m, pre) => {
      totals[from]++;
      return `${pre}${to}`;
    });
  }
  if (out !== src) {
    changedFiles++;
    if (!DRY) writeFileSync(file, out, 'utf8');
  }
}

console.log(DRY ? '== DRY RUN (sin escribir) ==' : '== APLICADO ==');
for (const [from, to] of RENAMES) {
  if (totals[from]) console.log(`  ${from.padEnd(16)} → ${to.padEnd(18)} ${totals[from]}`);
}
console.log(`  archivos afectados: ${changedFiles} / ${files.length}`);
