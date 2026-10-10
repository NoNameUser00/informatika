import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Статика под GitHub Pages. base: при деплое проекта вида user.github.io/<repo>/ —
// раскомментировать и подставить имя репозитория. Дизайн — позже по docs/design-source.md.
// Офлайн-сборки (школьные ПК, локальный сервер в корне): OFFLINE_ROLE=student|teacher -> base '/'.
const OFFLINE = process.env.OFFLINE_ROLE === 'student' || process.env.OFFLINE_ROLE === 'teacher';
export default defineConfig({
  output: 'static',
  base: OFFLINE ? '/' : '/informatika/',
  integrations: [react()],
});
