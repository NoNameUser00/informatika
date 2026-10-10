// Упаковка офлайн-сборок в обычные приложения (Neutralino):
// нативное окно + свой сервер внутри, Python и терминал не нужны.
// Запуск: node scripts/offline-pack.mjs student|teacher (после offline-build).
// Выход: app-<role>-windows/ (Informatika-*.exe, двойной клик)
//        app-<role>-rosa/ (бинарь Linux, chmod +x один раз).
// Каталоги app-*/ в репо НЕ коммитятся — раздаются архивами/флешкой.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const role = process.argv[2];
if (role !== 'student' && role !== 'teacher') {
  console.error('нужна роль: node scripts/offline-pack.mjs student|teacher');
  process.exit(1);
}

const DIST = `dist-offline-${role}`;
if (!existsSync(DIST)) throw new Error(`сначала собери: npm run build:offline-${role}`);

const BIN = {
  windows: 'tools/neutralino/bin/neutralino-win_x64.exe',
  rosa: 'tools/neutralino/bin/neutralino-linux_x64',
};
for (const [os, p] of Object.entries(BIN)) {
  if (!existsSync(p)) throw new Error(`нет бинаря ${os}: ${p}`);
}

const TITLE = role === 'student' ? 'Информатика — ученик' : 'Информатика — учитель';
const PORT = role === 'student' ? 8100 : 8101;
const APP_ID = role === 'student' ? 'ru.school.informatika.student' : 'ru.school.informatika.teacher';

function config() {
  return {
    applicationId: APP_ID,
    version: '0.1.0',
    defaultMode: 'window',
    documentRoot: '/resources/',
    url: '/',
    port: PORT,
    enableServer: true,
    enableNativeAPI: true,
    nativeAllowList: ['app.*', 'os.*', 'filesystem.writeBinaryFile', 'debug.log'],
    window: {
      title: TITLE,
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 640,
      center: true,
    },
  };
}

for (const os of ['windows', 'rosa']) {
  const dir = `app-${role}-${os}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(DIST, `${dir}/resources`, { recursive: true });
  mkdirSync(`${dir}/resources/js`, { recursive: true });
  copyFileSync('offline/neutralino.js', `${dir}/resources/js/neutralino.js`);
  const exe = os === 'windows'
    ? (role === 'student' ? 'Informatika-uchenik.exe' : 'Informatika-uchitel.exe')
    : (role === 'student' ? 'Informatika-uchenik' : 'Informatika-uchitel');
  copyFileSync(BIN[os], `${dir}/${exe}`);
  writeFileSync(`${dir}/neutralino.config.json`, JSON.stringify(config(), null, 2) + '\n');
  const readme = os === 'windows'
    ? 'Запуск: двойной клик по exe. Нужен WebView2 (обычно уже стоит в Windows 10/11).\n'
    : 'Запуск: один раз chmod +x ./Informatika-*, дальше двойной клик или ./Informatika-* в терминале.\nНужен WebKitGTK (обычно есть в Rosa OS).\n';
  writeFileSync(`${dir}/ЗАПУСК.txt`, readme);
  console.log(`APP OK: ${dir}/ (${exe})`);
}
