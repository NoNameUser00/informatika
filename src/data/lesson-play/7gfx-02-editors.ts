import type { PlayLesson } from './registry';

export const GFX7_02_PLAY: PlayLesson = {
  id: '7gfx-02-editors', no: 11, title: 'Графические редакторы: растр и вектор', minutes: 45,
  nextCheck: { kind: 'proverka', title: 'Проверочная: Мультимедиа', slug: 'proverka-7media' },
  steps: [
    { kind: 'theory', title: 'Два редактора', body: ['Растр: кисть, заливка, ластик, пипетка. Правь копию!', 'Вектор: линии, фигуры, кривые, группировка.', 'JPEG — фото, PNG — схемы, GIF — 256 цветов и анимация, SVG — веб.'] },
    { kind: 'key', title: 'Ключевое: выбор', body: ['Фото — JPEG, схемы — PNG, анимация — GIF, веб — SVG.', 'Оригинал не трогаем!'], writeDown: 'JPEG/PNG/GIF/SVG по назначению. Копия для правок.' },
    { kind: 'example', title: 'Пример: куда сохранить?', intro: 'Три файла — три формата.', lines: ['Фото с похода — JPEG (потери незаметны).', 'Схема подключения — PNG (текст чёткий).', 'Моргающий баннер — GIF (анимация).', 'Ответ: формат следует из содержимого.'] },
    { kind: 'task', title: 'Задание 1', taskKind: 'choice', prompt: 'Чем взять цвет с картинки в растровом редакторе?', options: [{ id: 'A', text: 'Пипеткой' }, { id: 'B', text: 'Ластиком' }, { id: 'C', text: 'Кистью' }, { id: 'D', text: 'Заливкой' }], correct: 'A', hint: 'Берёт — пипетка, кладёт — заливка.' },
  ],
};
