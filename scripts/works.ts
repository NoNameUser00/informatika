// Декларация проверочных и контрольных работ.
//
// Привязка заданий к работе — по номеру КТП урока, а не по банку-файлу:
// банк может содержать уроки из разных разделов КТП (например, bank-7media
// несёт звук с КТП 18 и презентации с КТП 28), но в работу попадает только то,
// что пройдено в её разделе.
//
// ЧТО ТРЕБУЕТСЯ ОТ БАНКА (проверяет make-checks.ts, иначе сборка падает):
//   контрольная — пул 60 заданий (36 basic / 18 intermediate / 6 advanced),
//                 в варианте 20 заданий: треть пула каждого раздела;
//   проверочная — из того же пула, срез basic+intermediate, в варианте 10 заданий;
//   вариантов 30, детерминированный seed (mulberry32 + fnv1a).
//
// Номера КТП в sections — это ДИАПАЗОНЫ пройденных уроков, а не номера тем.

/** Итоговая контрольная по КТП: номер урока в каждом классе. */
export const FINAL_KTP = { 7: 32, 8: 30, 9: 28, 10: 27, 11: 26 };

const INSTR_NUM = 'В ответе запишите только само число. Основание системы счисления (₂, ₈, ₁₀, ₁₆) указывать не нужно.';
const INSTR = 'Отвечайте точно. В числовых ответах запишите только число.';
const INSTR_CODE = 'Отвечайте точно. Код задаётся в поле ответа, запускается кнопкой. В числовых ответах запишите только число.';

// Банки класса — чтобы works-конфиг не дублировал списки путей.
const B7 = ['data/tasks/7/information/bank-7inf.yaml', 'data/tasks/7/base/bank-7base.yaml', 'data/tasks/7/media/bank-7media.yaml'];
const B8 = ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml', 'data/tasks/8/logic/bank-logic.yaml',
  'data/tasks/8/algorithms/bank-algo.yaml', 'data/tasks/8/code-run/bank-code.yaml'];
const B9 = ['data/tasks/9/spreadsheets/bank-9sheet.yaml', 'data/tasks/9/arrays/bank-9arr.yaml',
  'data/tasks/9/graphs/bank-9graph.yaml', 'data/tasks/9/extra/bank-9extra.yaml'];
const B10 = ['data/tasks/10/base/bank-10base.yaml', 'data/tasks/10/ss/bank-10ss.yaml',
  'data/tasks/10/logic/bank-10logic.yaml', 'data/tasks/10/media/bank-10media.yaml'];
const B11 = ['data/tasks/11/data/bank-11data.yaml', 'data/tasks/11/db/bank-11db.yaml',
  'data/tasks/11/algo/bank-11algo.yaml', 'data/tasks/11/net/bank-11net.yaml', 'data/tasks/11/graph/bank-11graph.yaml'];

// Диапазоны КТП, которые покрывает работа. Тима: [с, по] включительно.
const R = (...pairs: Array<[number, number]>) => pairs.map(([a, b]) => ({ from: a, to: b }));

export const WORKS = [
  // ─────────────────────────── 7 класс ───────────────────────────
  {
    file: 'proverka-7inf', code: 'grade7-proverka-v1', grade: '7', kind: 'proverka',
    title: 'Проверочная: Информация и кодирование', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Свойства информации, КТП 1–2', ktp: R([1, 2]) },
      { title: 'Знаки и кодирование текста, КТП 9–10', ktp: R([9, 10]) },
      { title: 'Измерение и объём информации, КТП 11–15', ktp: R([11, 15]) },
      { title: 'Графика, звук, скорость передачи, КТП 16–19', ktp: R([16, 19]) },
    ],
  },
  {
    file: 'control-7inf', code: 'grade7-control-v1', grade: '7', kind: 'control',
    title: 'Контрольная: Информация и кодирование', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Свойства информации, КТП 1–2', ktp: R([1, 2]) },
      { title: 'Знаки и кодирование текста, КТП 9–10', ktp: R([9, 10]) },
      { title: 'Измерение и объём информации, КТП 11–15', ktp: R([11, 15]) },
      { title: 'Графика, звук, скорость передачи, КТП 16–19', ktp: R([16, 19]) },
    ],
  },
  {
    file: 'proverka-7base', code: 'grade7base-proverka-v1', grade: '7', kind: 'proverka',
    title: 'Проверочная: Компьютер, ПО и сеть', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Устройства компьютера, КТП 3–4', ktp: R([3, 4]) },
      { title: 'Программы и файлы, КТП 5–6', ktp: R([5, 6]) },
      { title: 'Практические работы, КТП 7–8', ktp: R([7, 8]) },
      { title: 'Интернет и адреса, КТП 20–21', ktp: R([20, 21]) },
    ],
  },
  {
    file: 'control-7base', code: 'grade7base-control-v1', grade: '7', kind: 'control',
    title: 'Контрольная: Компьютер, ПО и сеть', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Устройства компьютера, КТП 3–4', ktp: R([3, 4]) },
      { title: 'Программы и файлы, КТП 5–6', ktp: R([5, 6]) },
      { title: 'Практические работы, КТП 7–8', ktp: R([7, 8]) },
      { title: 'Интернет и адреса, КТП 20–21', ktp: R([20, 21]) },
    ],
  },
  {
    file: 'proverka-7media', code: 'grade7media-proverka-v1', grade: '7', kind: 'proverka',
    title: 'Проверочная: Документы, презентации, графика', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Текстовые документы, КТП 22–27', ktp: R([22, 27]) },
      { title: 'Мультимедийные презентации, КТП 28–30', ktp: R([28, 30]) },
      { title: 'Компьютерная графика, КТП 31, 34–36', ktp: R([31, 31], [34, 36]) },
    ],
  },
  {
    file: 'control-7media', code: 'grade7media-control-v1', grade: '7', kind: 'control',
    title: 'Контрольная: Документы, презентации, графика', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Текстовые документы, КТП 22–27', ktp: R([22, 27]) },
      { title: 'Мультимедийные презентации, КТП 28–30', ktp: R([28, 30]) },
      { title: 'Компьютерная графика, КТП 31, 34–36', ktp: R([31, 31], [34, 36]) },
    ],
  },
  {
    file: 'proverka-7final', code: 'grade7-final-proverka-v1', grade: '7', kind: 'proverka',
    title: 'Проверочная перед итоговой: 7 класс', instruction: INSTR, banks: B7,
    sections: [
      { title: 'Информация и кодирование, КТП 1–19', ktp: R([1, 2], [9, 19]) },
      { title: 'Компьютер, ПО, сеть, КТП 3–8, 20–21', ktp: R([3, 8], [20, 21]) },
      { title: 'Документы, презентации, графика, КТП 22–31, 34–36', ktp: R([22, 31], [34, 36]) },
    ],
  },
  {
    file: 'control-7final', code: 'grade7-final-v1', grade: '7', kind: 'control',
    title: 'Итоговая контрольная работа: 7 класс', instruction: INSTR, banks: B7, final: true, ktpTo: 31,
    sections: [
      { title: 'Информация и кодирование, КТП 1–2, 9–19', ktp: R([1, 2], [9, 19]) },
      { title: 'Устройства и программы, КТП 3–8', ktp: R([3, 8]) },
      { title: 'Интернет и адреса, КТП 20–21', ktp: R([20, 21]) },
      { title: 'Документы, презентации, графика, КТП 22–31, 34–36', ktp: R([22, 31], [34, 36]) },
    ],
  },

  // ─────────────────────────── 8 класс ───────────────────────────
  {
    file: 'proverka-ss', code: 'numsys-proverka-v1', grade: '8', kind: 'proverka',
    title: 'Проверочная: Системы счисления', instruction: INSTR_NUM, banks: B8,
    sections: [
      { title: 'Позиционные системы и алфавит, КТП 1', ktp: R([1, 1]) },
      { title: 'Двоичная система, КТП 2', ktp: R([2, 2]) },
      { title: 'Восьмеричная и шестнадцатеричная, КТП 3–4', ktp: R([3, 4]) },
      { title: 'Арифметика и решение задач, КТП 5–6', ktp: R([5, 6]) },
    ],
  },
  {
    file: 'control-ss', code: 'numsys-control-v1', grade: '8', kind: 'control',
    title: 'Контрольная: Системы счисления', instruction: INSTR_NUM, banks: B8,
    sections: [
      { title: 'Позиционные системы и алфавит, КТП 1', ktp: R([1, 1]) },
      { title: 'Двоичная система, КТП 2', ktp: R([2, 2]) },
      { title: 'Восьмеричная и шестнадцатеричная, КТП 3–4', ktp: R([3, 4]) },
      { title: 'Арифметика и решение задач, КТП 5–6', ktp: R([5, 6]) },
    ],
  },
  {
    file: 'proverka-logic', code: 'logic-proverka-v1', grade: '8', kind: 'proverka',
    title: 'Проверочная: Логика', instruction: INSTR, banks: B8,
    sections: [
      { title: 'Высказывания и операции, КТП 7–8', ktp: R([7, 8]) },
      { title: 'Логические выражения и законы, КТП 9–10', ktp: R([9, 10]) },
      { title: 'Таблицы истинности, КТП 11', ktp: R([11, 11]) },
      { title: 'Логические элементы, КТП 12', ktp: R([12, 12]) },
    ],
  },
  {
    file: 'control-logic', code: 'logic-control-v1', grade: '8', kind: 'control',
    title: 'Контрольная: Логика', instruction: INSTR, banks: B8,
    sections: [
      { title: 'Высказывания и операции, КТП 7–8', ktp: R([7, 8]) },
      { title: 'Логические выражения и законы, КТП 9–10', ktp: R([9, 10]) },
      { title: 'Таблицы истинности, КТП 11', ktp: R([11, 11]) },
      { title: 'Логические элементы, КТП 12', ktp: R([12, 12]) },
    ],
  },
  {
    file: 'proverka-algo', code: 'algo-proverka-v1', grade: '8', kind: 'proverka',
    title: 'Проверочная: Алгоритмы и программирование', instruction: INSTR_CODE, banks: B8,
    sections: [
      { title: 'Алгоритмы и исполнители, КТП 13–14', ktp: R([13, 14]) },
      { title: 'Основы языка программирования, КТП 15–17', ktp: R([15, 17]) },
      { title: 'Следование, ветвление, циклы, КТП 18–25', ktp: R([18, 25]) },
      { title: 'Программирование циклов и строк, КТП 26–34', ktp: R([26, 34]) },
      { title: 'Анализ результатов алгоритма, КТП 35–36', ktp: R([35, 36]) },
    ],
  },
  {
    file: 'control-algo', code: 'algo-control-v1', grade: '8', kind: 'control',
    title: 'Контрольная: Алгоритмы и программирование', instruction: INSTR_CODE, banks: B8,
    sections: [
      { title: 'Алгоритмы и исполнители, КТП 13–14', ktp: R([13, 14]) },
      { title: 'Основы языка программирования, КТП 15–17', ktp: R([15, 17]) },
      { title: 'Следование, ветвление, циклы, КТП 18–25', ktp: R([18, 25]) },
      { title: 'Программирование циклов и строк, КТП 26–34', ktp: R([26, 34]) },
      { title: 'Анализ результатов алгоритма, КТП 35–36', ktp: R([35, 36]) },
    ],
  },
  {
    file: 'proverka-8final', code: 'grade8-final-proverka-v1', grade: '8', kind: 'proverka',
    title: 'Проверочная перед итоговой: 8 класс', instruction: INSTR_CODE, banks: B8,
    sections: [
      { title: 'Системы счисления, КТП 1–6', ktp: R([1, 6]) },
      { title: 'Логика, КТП 7–12', ktp: R([7, 12]) },
      { title: 'Алгоритмы и программирование, КТП 13–29, 31–36', ktp: R([13, 29], [31, 36]) },
    ],
  },
  {
    file: 'control-8final', code: 'grade8-final-v1', grade: '8', kind: 'control',
    title: 'Итоговая контрольная работа: 8 класс', instruction: INSTR_CODE, banks: B8, final: true, ktpTo: 29,
    sections: [
      { title: 'Системы счисления, КТП 1–6', ktp: R([1, 6]) },
      { title: 'Логика, КТП 7–12', ktp: R([7, 12]) },
      { title: 'Алгоритмы и конструкции, КТП 13–14, 18–25', ktp: R([13, 14], [18, 25]) },
      { title: 'Программирование, КТП 15–17, 26–29', ktp: R([15, 17], [26, 29]) },
      { title: 'Строки и анализ алгоритмов, КТП 31–36', ktp: R([31, 36]) },
    ],
  },

  // ─────────────────────────── 9 класс ───────────────────────────
  {
    file: 'proverka-9sheet', code: 'sheet9-proverka-v1', grade: '9', kind: 'proverka',
    title: 'Проверочная: Электронные таблицы', instruction: INSTR, banks: B9,
    sections: [
      { title: 'Интерфейс и типы данных, КТП 2–3', ktp: R([2, 3]) },
      { title: 'Вычисления и ссылки, КТП 4–5', ktp: R([4, 5]) },
      { title: 'Логические функции и анализ, КТП 6–8', ktp: R([6, 8]) },
      { title: 'Поиск и визуализация, КТП 9–11', ktp: R([9, 11]) },
    ],
  },
  {
    file: 'control-9sheet', code: 'sheet9-control-v1', grade: '9', kind: 'control',
    title: 'Контрольная: Электронные таблицы', instruction: INSTR, banks: B9,
    sections: [
      { title: 'Интерфейс и типы данных, КТП 2–3', ktp: R([2, 3]) },
      { title: 'Вычисления и ссылки, КТП 4–5', ktp: R([4, 5]) },
      { title: 'Логические функции и анализ, КТП 6–8', ktp: R([6, 8]) },
      { title: 'Поиск и визуализация, КТП 9–11', ktp: R([9, 11]) },
    ],
  },
  {
    file: 'proverka-9arr', code: 'arr9-proverka-v1', grade: '9', kind: 'proverka',
    title: 'Проверочная: Массивы и программирование', instruction: INSTR_CODE, banks: B9,
    sections: [
      { title: 'Алгоритмы и структуры данных, КТП 12–13', ktp: R([12, 13]) },
      { title: 'Сумма, количество, среднее, КТП 14', ktp: R([14, 14]) },
      { title: 'Линейный поиск, КТП 15', ktp: R([15, 15]) },
      { title: 'Минимум, максимум, сортировка, КТП 16–17', ktp: R([16, 17]) },
    ],
  },
  {
    file: 'control-9arr', code: 'arr9-control-v1', grade: '9', kind: 'control',
    title: 'Контрольная: Массивы и программирование', instruction: INSTR_CODE, banks: B9,
    sections: [
      { title: 'Алгоритмы и структуры данных, КТП 12–13', ktp: R([12, 13]) },
      { title: 'Сумма, количество, среднее, КТП 14', ktp: R([14, 14]) },
      { title: 'Линейный поиск, КТП 15', ktp: R([15, 15]) },
      { title: 'Минимум, максимум, сортировка, КТП 16–17', ktp: R([16, 17]) },
    ],
  },
  {
    file: 'proverka-9graph', code: 'graph9-proverka-v1', grade: '9', kind: 'proverka',
    title: 'Проверочная: Графы и пути', instruction: INSTR, banks: B9,
    sections: [
      { title: 'Элементы графа, матрицы, КТП 24', ktp: R([24, 24]) },
      { title: 'Списки и деревья, КТП 25', ktp: R([25, 25]) },
      { title: 'Графы в решении задач, КТП 26', ktp: R([26, 26]) },
      { title: 'Число путей в ациклическом графе, КТП 27', ktp: R([27, 27]) },
    ],
  },
  {
    file: 'control-9graph', code: 'graph9-control-v1', grade: '9', kind: 'control',
    title: 'Контрольная: Графы и пути', instruction: INSTR, banks: B9,
    sections: [
      { title: 'Элементы графа, матрицы, КТП 24', ktp: R([24, 24]) },
      { title: 'Списки и деревья, КТП 25', ktp: R([25, 25]) },
      { title: 'Графы в решении задач, КТП 26', ktp: R([26, 26]) },
      { title: 'Число путей в ациклическом графе, КТП 27', ktp: R([27, 27]) },
    ],
  },
  {
    file: 'proverka-9extra', code: 'extra9-proverka-v1', grade: '9', kind: 'proverka',
    title: 'Проверочная: Управление, модели и Интернет', instruction: INSTR, banks: B9,
    sections: [
      { title: 'Управление и роботизированные системы, КТП 18–19', ktp: R([18, 19]) },
      { title: 'Модели и моделирование, КТП 20–23', ktp: R([20, 23]) },
      { title: 'Интернет и безопасность, КТП 29–31', ktp: R([29, 31]) },
      { title: 'Интернет-сервисы и веб, КТП 32–36', ktp: R([32, 36]) },
    ],
  },
  {
    file: 'control-9extra', code: 'extra9-control-v1', grade: '9', kind: 'control',
    title: 'Контрольная: Управление, модели и Интернет', instruction: INSTR, banks: B9,
    sections: [
      { title: 'Управление и роботизированные системы, КТП 18–19', ktp: R([18, 19]) },
      { title: 'Модели и моделирование, КТП 20–23', ktp: R([20, 23]) },
      { title: 'Интернет и безопасность, КТП 29–31', ktp: R([29, 31]) },
      { title: 'Интернет-сервисы и веб, КТП 32–36', ktp: R([32, 36]) },
    ],
  },
  {
    file: 'proverka-9final', code: 'grade9-final-proverka-v1', grade: '9', kind: 'proverka',
    title: 'Проверочная перед итоговой: 9 класс', instruction: INSTR_CODE, banks: B9,
    sections: [
      { title: 'Электронные таблицы, КТП 2–11', ktp: R([2, 11]) },
      { title: 'Программирование, КТП 12–17', ktp: R([12, 17]) },
      { title: 'Управление и моделирование, КТП 18–27', ktp: R([18, 27]) },
      { title: 'Интернет и сервисы, КТП 29–36', ktp: R([29, 36]) },
    ],
  },
  {
    file: 'control-9final', code: 'grade9-final-v1', grade: '9', kind: 'control',
    title: 'Итоговая контрольная работа: 9 класс', instruction: INSTR_CODE, banks: B9, final: true, ktpTo: 27,
    sections: [
      { title: 'Электронные таблицы, КТП 2–11', ktp: R([2, 11]) },
      { title: 'Программирование, КТП 12–17', ktp: R([12, 17]) },
      { title: 'Управление и роботизированные системы, КТП 18–19', ktp: R([18, 19]) },
      { title: 'Модели, графы и пути, КТП 20–27', ktp: R([20, 27]) },
    ],
  },

  // ─────────────────────────── 10 класс ───────────────────────────
  {
    file: 'proverka-10base', code: 'base10-proverka-v1', grade: '10', kind: 'proverka',
    title: 'Проверочная: Железо и информационные процессы', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Устройство компьютера и ПО, КТП 1–4', ktp: R([1, 4]) },
      { title: 'Файлы, лицензии, ПО, КТП 5–6', ktp: R([5, 6]) },
      { title: 'Измерение информации, КТП 7–9', ktp: R([7, 9]) },
      { title: 'Передача и скорость данных, КТП 10–11', ktp: R([10, 11]) },
    ],
  },
  {
    file: 'control-10base', code: 'base10-control-v1', grade: '10', kind: 'control',
    title: 'Контрольная: Железо и информационные процессы', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Устройство компьютера и ПО, КТП 1–4', ktp: R([1, 4]) },
      { title: 'Файлы, лицензии, ПО, КТП 5–6', ktp: R([5, 6]) },
      { title: 'Измерение информации, КТП 7–9', ktp: R([7, 9]) },
      { title: 'Передача и скорость данных, КТП 10–11', ktp: R([10, 11]) },
    ],
  },
  {
    file: 'proverka-10adv', code: 'adv10-proverka-v1', grade: '10', kind: 'proverka',
    title: 'Проверочная: Системы счисления и логика', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Системы счисления, КТП 12–13', ktp: R([12, 13]) },
      { title: 'Арифметика и представление чисел, КТП 14–15', ktp: R([14, 15]) },
      { title: 'Кодирование текста, графики, звука, КТП 16–19', ktp: R([16, 19]) },
      { title: 'Операции и выражения, КТП 20–21', ktp: R([20, 21]) },
      { title: 'Законы и нормальные формы, КТП 22–24', ktp: R([22, 24]) },
      { title: 'Уравнения, диаграммы, элементы, КТП 25–26', ktp: R([25, 26]) },
    ],
  },
  {
    file: 'control-10adv', code: 'adv10-control-v1', grade: '10', kind: 'control',
    title: 'Контрольная: Системы счисления и логика', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Системы счисления, КТП 12–13', ktp: R([12, 13]) },
      { title: 'Арифметика и представление чисел, КТП 14–15', ktp: R([14, 15]) },
      { title: 'Кодирование текста, графики, звука, КТП 16–19', ktp: R([16, 19]) },
      { title: 'Операции и выражения, КТП 20–21', ktp: R([20, 21]) },
      { title: 'Законы и нормальные формы, КТП 22–24', ktp: R([22, 24]) },
      { title: 'Уравнения, диаграммы, элементы, КТП 25–26', ktp: R([25, 26]) },
    ],
  },
  {
    file: 'proverka-10media', code: 'media10-proverka-v1', grade: '10', kind: 'proverka',
    title: 'Проверочная: Текстовый процессор и мультимедиа', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Текстовый процессор и стили, КТП 29–30', ktp: R([29, 30]) },
      { title: 'Верстка и формулы, КТП 31', ktp: R([31, 31]) },
      { title: 'Графический редактор, КТП 32–33', ktp: R([32, 33]) },
      { title: 'Трёхмерные модели, КТП 34', ktp: R([34, 34]) },
      { title: 'Мультимедиа и презентации, КТП 35–36', ktp: R([35, 36]) },
    ],
  },
  {
    file: 'control-10media', code: 'media10-control-v1', grade: '10', kind: 'control',
    title: 'Контрольная: Текстовый процессор и мультимедиа', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Текстовый процессор и стили, КТП 29–30', ktp: R([29, 30]) },
      { title: 'Верстка и формулы, КТП 31', ktp: R([31, 31]) },
      { title: 'Графический редактор, КТП 32–33', ktp: R([32, 33]) },
      { title: 'Трёхмерные модели, КТП 34', ktp: R([34, 34]) },
      { title: 'Мультимедиа и презентации, КТП 35–36', ktp: R([35, 36]) },
    ],
  },
  {
    file: 'proverka-10final', code: 'grade10-final-proverka-v1', grade: '10', kind: 'proverka',
    title: 'Проверочная перед итоговой: 10 класс', instruction: INSTR, banks: B10,
    sections: [
      { title: 'Железо и информационные процессы, КТП 1–11', ktp: R([1, 11]) },
      { title: 'Представление информации, КТП 12–19', ktp: R([12, 19]) },
      { title: 'Алгебра логики, КТП 20–26', ktp: R([20, 26]) },
      { title: 'Текст, графика, мультимедиа, КТП 29–36', ktp: R([29, 36]) },
    ],
  },
  {
    file: 'control-10final', code: 'grade10-final-v1', grade: '10', kind: 'control',
    title: 'Итоговая контрольная работа: 10 класс', instruction: INSTR, banks: B10, final: true, ktpTo: 26,
    sections: [
      { title: 'Железо и информационные процессы, КТП 1–11', ktp: R([1, 11]) },
      { title: 'Системы счисления и кодирование, КТП 12–19', ktp: R([12, 19]) },
      { title: 'Алгебра логики, КТП 20–26', ktp: R([20, 26]) },
    ],
  },

  // ─────────────────────────── 11 класс ───────────────────────────
  {
    file: 'proverka-11base', code: 'base11-proverka-v1', grade: '11', kind: 'proverka',
    title: 'Проверочная: Анализ данных и базы данных', instruction: INSTR, banks: B11,
    sections: [
      { title: 'Моделирование и задачи анализа, КТП 1–3', ktp: R([1, 3]) },
      { title: 'Корреляция, уравнения, оптимизация, КТП 4–6', ktp: R([4, 6]) },
      { title: 'Реляционные базы данных, КТП 7', ktp: R([7, 7]) },
      { title: 'Работа с базой данных, КТП 8', ktp: R([8, 8]) },
    ],
  },
  {
    file: 'control-11base', code: 'base11-control-v1', grade: '11', kind: 'control',
    title: 'Контрольная: Анализ данных и базы данных', instruction: INSTR, banks: B11,
    sections: [
      { title: 'Моделирование и задачи анализа, КТП 1–3', ktp: R([1, 3]) },
      { title: 'Корреляция, уравнения, оптимизация, КТП 4–6', ktp: R([4, 6]) },
      { title: 'Реляционные базы данных, КТП 7', ktp: R([7, 7]) },
      { title: 'Работа с базой данных, КТП 8', ktp: R([8, 8]) },
    ],
  },
  {
    file: 'proverka-11algo', code: 'algo11-proverka-v1', grade: '11', kind: 'proverka',
    title: 'Проверочная: Алгоритмы и программирование', instruction: INSTR_CODE, banks: B11,
    sections: [
      { title: 'Анализ алгоритмов и отладка, КТП 9–10', ktp: R([9, 10]) },
      { title: 'Практические работы: цифры, последовательности, перебор, КТП 11–13', ktp: R([11, 13]) },
      { title: 'Сортировки, КТП 14', ktp: R([14, 14]) },
      { title: 'Матрицы, КТП 15', ktp: R([15, 15]) },
      { title: 'Строки и редактирование текста, КТП 16–17', ktp: R([16, 17]) },
      { title: 'Подпрограммы, рекурсия, сложность, КТП 18–19', ktp: R([18, 19]) },
    ],
  },
  {
    file: 'control-11algo', code: 'algo11-control-v1', grade: '11', kind: 'control',
    title: 'Контрольная: Алгоритмы и программирование', instruction: INSTR_CODE, banks: B11,
    sections: [
      { title: 'Анализ алгоритмов и отладка, КТП 9–10', ktp: R([9, 10]) },
      { title: 'Практические работы: цифры, последовательности, перебор, КТП 11–13', ktp: R([11, 13]) },
      { title: 'Сортировки, КТП 14', ktp: R([14, 14]) },
      { title: 'Матрицы, КТП 15', ktp: R([15, 15]) },
      { title: 'Строки и редактирование текста, КТП 16–17', ktp: R([16, 17]) },
      { title: 'Подпрограммы, рекурсия, сложность, КТП 18–19', ktp: R([18, 19]) },
    ],
  },
  {
    file: 'proverka-11graph', code: 'graph11-proverka-v1', grade: '11', kind: 'proverka',
    title: 'Проверочная: Моделирование, графы и игры', instruction: INSTR, banks: B11,
    sections: [
      { title: 'Модели и формализация, КТП 20', ktp: R([20, 20]) },
      { title: 'Графы и деревья, КТП 21', ktp: R([21, 21]) },
      { title: 'Анализ графов: пути, КТП 22', ktp: R([22, 22]) },
      { title: 'Игры двух игроков, КТП 23–24', ktp: R([23, 24]) },
    ],
  },
  {
    file: 'control-11graph', code: 'graph11-control-v1', grade: '11', kind: 'control',
    title: 'Контрольная: Моделирование, графы и игры', instruction: INSTR, banks: B11,
    sections: [
      { title: 'Модели и формализация, КТП 20', ktp: R([20, 20]) },
      { title: 'Графы и деревья, КТП 21', ktp: R([21, 21]) },
      { title: 'Анализ графов: пути, КТП 22', ktp: R([22, 22]) },
      { title: 'Игры двух игроков, КТП 23–24', ktp: R([23, 24]) },
    ],
  },
  {
    file: 'proverka-11net', code: 'net11-proverka-v1', grade: '11', kind: 'proverka',
    title: 'Проверочная: Сети и информационная безопасность', instruction: INSTR, banks: B11,
    sections: [
      { title: 'Сети, протоколы, локальная сеть, КТП 25', ktp: R([25, 25]) },
      { title: 'Интернет, адресация, доменные имена, КТП 26', ktp: R([26, 26]) },
      { title: 'HTML и веб-страница, КТП 27', ktp: R([27, 27]) },
      { title: 'Сервисы, ГИС, цифровая культура, КТП 28', ktp: R([28, 28]) },
      { title: 'Сетевой этикет и поиск, КТП 29', ktp: R([29, 29]) },
      { title: 'Защита информации и ЭП, КТП 30', ktp: R([30, 30]) },
      { title: 'Вредоносное ПО и архив, КТП 31–32', ktp: R([31, 32]) },
      { title: 'Средства искусственного интеллекта, КТП 33–36', ktp: R([33, 36]) },
    ],
  },
  {
    file: 'control-11net', code: 'net11-control-v1', grade: '11', kind: 'control',
    title: 'Контрольная: Сети и информационная безопасность', instruction: INSTR, banks: B11,
    sections: [
      { title: 'Сети, протоколы, локальная сеть, КТП 25', ktp: R([25, 25]) },
      { title: 'Интернет, адресация, доменные имена, КТП 26', ktp: R([26, 26]) },
      { title: 'HTML и веб-страница, КТП 27', ktp: R([27, 27]) },
      { title: 'Сервисы, ГИС, цифровая культура, КТП 28', ktp: R([28, 28]) },
      { title: 'Сетевой этикет и поиск, КТП 29', ktp: R([29, 29]) },
      { title: 'Защита информации и ЭП, КТП 30', ktp: R([30, 30]) },
      { title: 'Вредоносное ПО и архив, КТП 31–32', ktp: R([31, 32]) },
      { title: 'Средства искусственного интеллекта, КТП 33–36', ktp: R([33, 36]) },
    ],
  },
  {
    file: 'proverka-11final', code: 'grade11-final-proverka-v1', grade: '11', kind: 'proverka',
    title: 'Проверочная перед итоговой: 11 класс', instruction: INSTR_CODE, banks: B11,
    sections: [
      { title: 'Анализ данных и базы данных, КТП 1–8', ktp: R([1, 8]) },
      { title: 'Алгоритмы и программирование, КТП 9–19', ktp: R([9, 19]) },
      { title: 'Моделирование, графы и игры, КТП 20–24', ktp: R([20, 24]) },
      { title: 'Сети, КТП 25', ktp: R([25, 25]) },
    ],
  },
  {
    file: 'control-11final', code: 'grade11-final-v1', grade: '11', kind: 'control',
    title: 'Итоговая контрольная работа: 11 класс', instruction: INSTR_CODE, banks: B11, final: true, ktpTo: 25,
    sections: [
      { title: 'Анализ данных и базы данных, КТП 1–8', ktp: R([1, 8]) },
      { title: 'Алгоритмы и программирование, КТП 9–19', ktp: R([9, 19]) },
      { title: 'Моделирование, графы и игры, КТП 20–24', ktp: R([20, 24]) },
      { title: 'Компьютерные сети, КТП 25', ktp: R([25, 25]) },
    ],
  },
];

/** Слоты варианта: контрольная 20 заданий, проверочная 10 (только basic+intermediate). */
export const SLOTS = {
  control: { perVariant: 20, difficulties: ['basic', 'intermediate', 'advanced'] },
  proverka: { perVariant: 10, difficulties: ['basic', 'intermediate'] },
};

/** Пул на работу: 60 заданий = 36 basic + 18 intermediate + 6 advanced. */
export const POOL_QUOTA = { total: 60, basic: 36, intermediate: 18, advanced: 6 };

export const VARIANTS = 30;
