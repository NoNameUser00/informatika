import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

// Статика под GitHub Pages. base: при деплое проекта вида user.github.io/<repo>/ —
// раскомментировать и подставить имя репозитория. Дизайн — позже по docs/design-source.md.
// Офлайн-сборки (школьные ПК, локальный сервер в корне): OFFLINE_ROLE=student|teacher -> base '/'.
// PWA — только онлайн: уроки и тренажёры кэшируются, API Supabase и CDN — никогда.
const OFFLINE = process.env.OFFLINE_ROLE === 'student' || process.env.OFFLINE_ROLE === 'teacher';
export default defineConfig({
  output: 'static',
  base: OFFLINE ? '/' : '/informatika/',
  integrations: [
    react(),
    ...(OFFLINE
      ? []
      : [
          AstroPWA({
            registerType: 'autoUpdate',
            manifest: {
              name: 'Информатика — школьный тренажёр',
              short_name: 'Информатика',
              description: 'Теория, тренажёры и проверочные по информатике, 7–11 классы',
              theme_color: '#020617',
              background_color: '#020617',
              display: 'standalone',
              scope: '/informatika/',
              start_url: '/informatika/',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              navigateFallback: '/informatika/index.html',
              navigateFallbackDenylist: [/^\/api\//, /submit-attempt/],
              globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,ttf,json}'],
              runtimeCaching: [
                {
                  // Бэкенд и CDN — мимо кэша всегда (ключи и свежие данные).
                  urlPattern: ({ url }) =>
                    url.hostname.endsWith('.supabase.co') ||
                    url.hostname === 'cdn.jsdelivr.net' ||
                    url.pathname.includes('/functions/'),
                  handler: 'NetworkOnly',
                },
              ],
            },
          }),
        ]),
  ],
});
