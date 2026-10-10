// Сборка офлайн-версий: ученической (без ключей) и учительской (с ключами).
// Запуск: node scripts/offline-build.mjs student|teacher
// - student: вырезка ключей (scripts/offline-strip.mjs) -> сборка ->
//   восстановление данных (git checkout) -> лаунчеры в dist;
// - teacher: сборка как есть (полные банки + страница проверки файлов).
// Дистрибутивы (dist-offline-*) в репо НЕ коммитятся — раздаются файлами.
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, rmSync } from 'node:fs';

const role = process.argv[2];
if (role !== 'student' && role !== 'teacher') {
  console.error('нужна роль: node scripts/offline-build.mjs student|teacher');
  process.exit(1);
}

const OUT = `dist-offline-${role}`;
const BACKUP = 'node_modules/.cache/offline-data-backup';
const run = (cmd, env = {}) =>
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

try {
  if (role === 'student') {
    // Байтовая копия (не git checkout): окончания строк обязаны пережить сборку.
    rmSync(BACKUP, { recursive: true, force: true });
    cpSync('src/data', BACKUP, { recursive: true });
    run('node scripts/offline-strip.mjs');
  }
  run(`npx astro build --outDir ${OUT}`, { OFFLINE_ROLE: role, PUBLIC_OFFLINE_ROLE: role });
} finally {
  if (role === 'student') {
    // Данные обязаны вернуться независимо от успеха сборки.
    rmSync('src/data', { recursive: true, force: true });
    cpSync(BACKUP, 'src/data', { recursive: true });
    rmSync(BACKUP, { recursive: true, force: true });
    console.log('RESTORE OK: src/data возвращены побайтово');
  }
}

if (!existsSync(OUT)) throw new Error(`нет каталога сборки: ${OUT}`);
if (role === 'student') {
  // Утечка ключей = брак всей сборки.
  run(`node scripts/offline-audit.mjs ${OUT}`);
}
for (const f of ['start-windows.bat', 'start-rosa.sh', role === 'student' ? 'README-student.md' : 'README-teacher.md']) {
  copyFileSync(`offline/${f}`, `${OUT}/${f}`);
}
console.log(`OFFLINE OK: ${OUT}/ (+ лаунчеры Windows/Rosa)`);
