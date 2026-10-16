// Распределение ключей по буквам: сколько заданий в банке указывает на A.
// Нужен, чтобы видеть смещение — ученик, всегда отвечающий «A», должен
// проигрывать, а не выигрывать.
import { loadAllTasks } from './audit-keys.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const all = loadAllTasks().filter(
  (t) => t?.type === 'single_choice' && (!only.length || only.some((o) => t.__file.replace(/\\/g, '/').includes(o))),
);

const byFile = new Map();
for (const t of all) {
  const row = byFile.get(t.__file) ?? { total: 0, letters: {} };
  row.total++;
  row.letters[t.teacher_only.answer] = (row.letters[t.teacher_only.answer] ?? 0) + 1;
  byFile.set(t.__file, row);
}

const global = {};
for (const [, r] of byFile) for (const [l, n] of Object.entries(r.letters)) global[l] = (global[l] ?? 0) + n;

for (const [f, r] of [...byFile].sort()) {
  const parts = f.replace(/\\/g, '/').split('/');
  const share = r.total ? Math.round(((r.letters.A ?? 0) / r.total) * 100) : 0;
  console.log(
    `${parts[2]} ${parts[3].padEnd(14)} всего ${String(r.total).padStart(3)}  ` +
      `A ${String(r.letters.A ?? 0).padStart(3)} (${String(share).padStart(2)}%)  ` +
      `B ${String(r.letters.B ?? 0).padStart(3)}  C ${String(r.letters.C ?? 0).padStart(3)}  D ${String(r.letters.D ?? 0).padStart(3)}`,
  );
}
const gt = all.length;
console.log(
  `\nИТОГО ${gt}: ` +
    `A ${global.A ?? 0} (${Math.round(((global.A ?? 0) / gt) * 100)}%), ` +
    `B ${global.B ?? 0}, C ${global.C ?? 0}, D ${global.D ?? 0}`,
);