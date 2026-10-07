// Сценарий 45-минутного урока «py-02-branching»: if/else → условия → максимум.
import type { PlayLesson } from './registry';

export const PY_02_PLAY: PlayLesson = {
  id: 'py-02-branching',
  no: 16,
  title: 'Python: ветвление if-else',
  minutes: 45,
  steps: [
    {
      kind: 'theory',
      title: 'Условный оператор',
      body: [
        'if условие: → отступ 4 пробела → действие. Иначе — else: с отступом.',
        'Отступы — часть языка: они показывают границы веток. Ломаешь отступ — ломаешь программу.',
        'После if обязательно двоеточие. В условии = превращается в ==.',
      ],
      mono: ['if x >= 0:', '    print(x)', 'else:', '    print(-x)'],
    },
    {
      kind: 'theory',
      title: 'Условия — это логика',
      body: [
        'Сравнения: ==, !=, >, <, >=, <=. Связки: and (И), or (ИЛИ), not (НЕ) — прямо как в логике.',
        '(x >= 0) and (x <= 10) истинно, только если оба сравнения верны.',
      ],
    },
    {
      kind: 'key',
      title: 'Ключевое: if и отступы',
      body: [
        'if …: / else: + отступ 4 пробела.',
        'В условии: == (сравнить), and/or/not.',
      ],
      writeDown: 'if/else с двоеточием и отступом 4. = положить, == сравнить.',
    },
    {
      kind: 'example',
      title: 'Пример: максимум из трёх без max',
      intro: 'Два неполных if подряд, чемпион переживает.',
      mono: ['a, b, c = 3, 7, 5', 'y = a', 'if b > y:', '    y = b', 'if c > y:', '    y = c'],
      lines: [
        'Старт: чемпион y = a = 3.',
        'b = 7 > 3 — чемпион меняется: y = 7.',
        'c = 5 > 7? Нет — чемпион остаётся 7.',
        'Ответ: 7.',
      ],
    },
    {
      kind: 'task',
      title: 'Задание 1',
      taskKind: 'numeric',
      prompt: 'Что выведет программа-пример при a, b, c = 3, 7, 5? Запишите только число.',
      expected: 7,
      base: 10,
      hint: 'Погоняй чемпиона по шагам.',
    },
    {
      kind: 'task',
      title: 'Задание 2',
      taskKind: 'choice',
      prompt: 'Чему равно (x >= 0) and (x <= 1) при x = 0?',
      options: [
        { id: 'A', text: 'Истина' },
        { id: 'B', text: 'Ложь' },
      ],
      correct: 'A',
      hint: 'Проверь оба сравнения.',
    },
    {
      kind: 'task',
      title: 'Задание 3',
      taskKind: 'choice',
      prompt: 'Какая запись условия верна?',
      options: [
        { id: 'A', text: 'if x = 5:' },
        { id: 'B', text: 'if x == 5:' },
        { id: 'C', text: 'if x := 5:' },
        { id: 'D', text: 'if x === 5:' },
      ],
      correct: 'B',
      hint: 'Одно = кладёт, два — сравнивают.',
    },
  ],
};
