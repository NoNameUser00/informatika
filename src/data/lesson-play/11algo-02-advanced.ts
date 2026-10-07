import type { PlayLesson } from './registry';

export const ALGO11_02_PLAY: PlayLesson = {
  id: '11algo-02-advanced', no: 4, title: 'Сортировки, матрицы, строки, рекурсия', minutes: 45,
  nextCheck: { kind: 'control', title: 'Контрольная: Алгоритмы 11', slug: 'control-11algo' },
  steps: [
    { kind: 'theory', title: 'Четыре инструмента', body: ['Сортировка выбором: минимум из остатка на своё место.', 'Матрица a[i][j]: строка i, столбец j; обход вложенными циклами.', 'Строки: вставка/удаление сдвигают индексы!', 'Рекурсия: самовызов + база, иначе бесконечность.'] },
    { kind: 'key', title: 'Ключевое: счёт', body: ['Вложенные циклы 100×100 = 10 000 действий.', 'Факториал: F(n) = n·F(n−1), F(0) = 1.'], mono: ['100×100 = 10 000', 'F(n) = n·F(n−1)'], writeDown: 'Рекурсия с базой. Сложность растёт с n.' },
    { kind: 'example', title: 'Пример: F(3)', intro: 'Раскрываем факториал.', lines: ['F(3) = 3·F(2).', 'F(2) = 2·F(1), F(1) = 1·F(0) = 1.', 'Собираем: 3·2·1.', 'Ответ: 6.'] },
    { kind: 'task', title: 'Задание 1', taskKind: 'choice', prompt: 'Что обязательно в рекурсии?', options: [{ id: 'A', text: 'Базовый случай-выход' }, { id: 'B', text: 'Громкий звук' }, { id: 'C', text: 'Интернет' }, { id: 'D', text: 'Ничего' }], correct: 'A', hint: 'Иначе вечность.' },
    { kind: 'task', title: 'Задание 2', taskKind: 'numeric', prompt: 'F(n) = n · F(n−1), F(0) = 1. Чему равно F(3)? Запишите только число.', expected: 6, base: 10, hint: '3·2·1.' },
    { kind: 'task', title: 'Задание 3', taskKind: 'numeric', prompt: 'Сколько действий во вложенных циклах 100×100? Запишите только число.', expected: 10000, base: 10, hint: 'n² при n = 100.' },
  ],
};
