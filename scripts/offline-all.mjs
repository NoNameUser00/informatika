// Полный конвейер офлайн-версий одной командой: npm run offline:all
// 1) ученический dist (вырезка ключей + аудит) -> 2) ученические zip ->
// 3) учительский dist (OFFLINE_DL=1: карточка скачивания клиента) ->
// 4) упаковка 4 приложений (в учительские встраиваются ученические zip) ->
// 5) общие комплекты в release/ + 6) единый бандл всех четырёх (релиз).
// Дистрибутивы и пакеты в репо не коммитятся, кроме release/*.zip.
import { execSync } from 'node:child_process';

const run = (cmd, env = {}) =>
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

run('node scripts/offline-build.mjs student');
run('node scripts/offline-pack.mjs student');
run('powershell -NoProfile -Command "Remove-Item release/Informatika-uchenik-*.zip -Force -ErrorAction SilentlyContinue; Compress-Archive -Path app-student-windows -DestinationPath release/Informatika-uchenik-windows.zip; Compress-Archive -Path app-student-rosa -DestinationPath release/Informatika-uchenik-rosa.zip"');
run('node scripts/offline-build.mjs teacher', { OFFLINE_DL: '1' });
run('node scripts/offline-pack.mjs teacher');
run('powershell -NoProfile -Command "Remove-Item release/Informatika-uchitel-*.zip -Force -ErrorAction SilentlyContinue; Compress-Archive -Path app-teacher-windows -DestinationPath release/Informatika-uchitel-windows.zip; Compress-Archive -Path app-teacher-rosa -DestinationPath release/Informatika-uchitel-rosa.zip"');
run('python scripts/offline-bundle.py');
console.log('ALL OK: release/ содержит 4 архива + Informatika-all.zip, в учительских встроен клиент');
