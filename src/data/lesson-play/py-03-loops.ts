// Сценарий 45-минутного урока «py-03-loops»: while → for → Евклид.
import type { PlayLesson } from './registry';

export const PY_03_PLAY: PlayLesson = {
  id: 'py-03-loops',
  no: 17,
  title: 'Python: циклы while и for',
  minutes: 45,
  steps: [
    {
      kind: 'theory',
      title: 'while True + break',
      body: [
        'Бесконечный цикл с выходом внутри: крутимся, пока не встретим break.',
        'Классика: подсчёт цифр — укорачиваем число (n //= 10), считаем шаги, на нуле выходим.',
        '// — целочисленное деление (отбросить последнюю цифру), % — остаток (взять её).',
      ],
      mono: ['n, k = 9876, 0', 'while True:', '    n //= 10', '    k += 1', '    if n == 0:', '        break'],
    },
    {
      kind: 'theory',
      title: 'for по range',
      body: [
        'Когда число повторов известно — for: for i in range(1, 4) даст 1, 2, 3.',
        'Правая граница НЕ входит! range(1, 4) — это 1, 2, 3.',
      ],
    },
    {
      kind: 'key',
      title: 'Ключевое: два цикла',
      body: [
        'while True + break — выход по условию внутри (считаем цифры, Евклид).',
        'for i in range(a, b) — ровно b−a повторов.',
        '// отбрасывает цифру, % забирает её.',
      ],
      mono: ['while True: ... if ...: break', 'for i in range(1, 4):  # 1, 2, 3', 'n //= 10 — отбросить, n % 10 — взять'],
      writeDown: 'range(a,b): a..b−1. // и % — цифры числа. break выходит.',
    },
    {
      kind: 'example',
      title: 'Пример: сумма цифр 12345',
      intro: 'Добавляем к счётчику цифр накопитель суммы.',
      mono: ['n, s = 12345, 0', 'while n:', '    s += n % 10', '    n //= 10'],
      lines: [
        'Итерация: забираем последнюю цифру (n % 10) в сумму, отбрасываем её (n //= 10).',
        '5 → s=5, 4 → s=9, 3 → s=12, 2 → s=14, 1 → s=15. n стало 0 — выход.',
        'Ответ: 15.',
      ],
    },
    {
      kind: 'task',
      title: 'Задание 1',
      taskKind: 'numeric',
      prompt: 'Сколько цифр в числе 9876? Запишите только число.',
      expected: 4,
      base: 10,
      hint: 'Сколько раз можно отбросить цифру, пока не ноль?',
    },
    {
      kind: 'task',
      title: 'Задание 2',
      taskKind: 'numeric',
      prompt: 'Чему равна сумма цифр числа 12345? Запишите только число.',
      expected: 15,
      base: 10,
      hint: '1+2+3+4+5.',
    },
    {
      kind: 'task',
      title: 'Задание 3',
      taskKind: 'choice',
      prompt: 'Какие значения даст range(1, 4)?',
      options: [
        { id: 'A', text: '1, 2, 3' },
        { id: 'B', text: '1, 2, 3, 4' },
        { id: 'C', text: '0, 1, 2, 3' },
        { id: 'D', text: '4, 3, 2, 1' },
      ],
      correct: 'A',
      hint: 'Правая граница не входит.',
    },
  ],
};
