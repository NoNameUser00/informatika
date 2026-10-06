import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Статика под GitHub Pages. base: при деплое проекта вида user.github.io/<repo>/ —
// раскомментировать и подставить имя репозитория. Дизайн — позже по docs/design-source.md.
export default defineConfig({
  output: 'static',
  base: '/informatika/',
  integrations: [react()],
});
