// Реестр уроков. Нумерация — по КТП (material/ktp/*.xlsx -> src/data/ktp.ts, 36 уроков в классе).
// Правило: одна страница урока = ровно один урок КТП. Даже если тема соседних уроков совпадает.
// Поле `ktp` проставляется по мере разбивки: урок без `ktp` ещё не отвязан от КТП (показывается
// порядковый номер по реестру), урок с `ktp` показывает «Урок N. <тема КТП>» и «Урок N из 36».
import { KTP } from './ktp';

export interface LessonMeta {
  id: string;
  title: string;
  file: string;
  /** Номер урока в КТП, 1..36. */
  ktp?: number;
}

/** Урок КТП по номеру (для заголовков страниц и хлебных крошек). */
export function ktpLesson(grade: string, n: number | undefined) {
  if (n == null) return undefined;
  return KTP[grade]?.find((l) => l.n === n);
}

/** Сколько уроков в КТП у класса (всегда 36) — для «Урок N из 36». */
export const KTP_TOTAL = 36;

export const LESSONS_8: LessonMeta[] = [
  { id: 'numsys-01-intro', ktp: 1, title: 'Общие сведения: позиционные и непозиционные системы', file: 'numsys-01-intro.md' },
  { id: 'numsys-02-binary', ktp: 2, title: 'Двоичная система: веса разрядов и переводы 10↔2', file: 'numsys-02-binary.md' },
  { id: 'numsys-03-octal', ktp: 3, title: 'Восьмеричная система и триады', file: 'numsys-03-octal.md' },
  { id: 'numsys-04-hex', ktp: 4, title: 'Шестнадцатеричная система и тетрады', file: 'numsys-04-hex.md' },
  { id: 'numsys-05-arith', ktp: 5, title: 'Арифметика в двоичной системе', file: 'numsys-05-arith.md' },
  { id: 'numsys-06-review', ktp: 6, title: 'Решение задач: ловушки переводов', file: 'numsys-06-review.md' },
  { id: 'logic-01-utterances', ktp: 7, title: 'Высказывания, операции и приоритет', file: 'logic-01-utterances.md' },
  { id: 'logic-02-operations', ktp: 8, title: 'Истинность составного высказывания', file: 'logic-02-operations.md' },
  { id: 'logic-05-expression', ktp: 9, title: 'Логические выражения и правила записи', file: 'logic-05-expression.md' },
  { id: 'logic-06-laws', ktp: 10, title: 'Законы алгебры логики', file: 'logic-06-laws.md' },
  { id: 'logic-03-truth-tables', ktp: 11, title: 'Таблицы истинности логических выражений', file: 'logic-03-truth-tables.md' },
  { id: 'logic-04-elements', ktp: 12, title: 'Логические элементы и основы компьютера', file: 'logic-04-elements.md' },
  { id: 'alg-01-performers', ktp: 13, title: 'Алгоритмы, исполнители и формы записи', file: 'alg-01-performers.md' },
  { id: 'alg-02-notation', ktp: 14, title: 'Объекты алгоритмов и ручное исполнение', file: 'alg-02-notation.md' },
  { id: 'py-01-basics', ktp: 15, title: 'Общие сведения о языке программирования', file: 'py-01-basics.md' },
  { id: 'py-05-data', ktp: 16, title: 'Типы данных, переменные, ввод и вывод', file: 'py-05-data.md' },
  { id: 'py-06-linear', ktp: 17, title: 'Присваивание и линейные алгоритмы', file: 'py-06-linear.md' },
  { id: 'alg-05-sequence', ktp: 18, title: 'Алгоритмическая конструкция «следование»', file: 'alg-05-sequence.md' },
  { id: 'alg-03-branching', ktp: 19, title: 'Ветвление: полная форма', file: 'alg-03-branching.md' },
  { id: 'alg-06-branching-short', ktp: 20, title: 'Ветвление: неполная форма', file: 'alg-06-branching-short.md' },
  { id: 'alg-07-while', ktp: 21, title: 'Цикл с условием продолжения', file: 'alg-07-while.md' },
  { id: 'alg-08-until', ktp: 22, title: 'Цикл с условием окончания', file: 'alg-08-until.md' },
  { id: 'alg-09-for', ktp: 23, title: 'Цикл с заданным числом повторений', file: 'alg-09-for.md' },
  { id: 'alg-10-pr-branching', ktp: 24, title: 'Практическая работа: ветвления и циклы', file: 'alg-10-pr-branching.md' },
  { id: 'alg-11-design', ktp: 25, title: 'Разработка алгоритмов с циклами и ветвлениями', file: 'alg-11-design.md' },
  { id: 'py-09-linear-pr', ktp: 26, title: 'Практическая работа: линейные алгоритмы', file: 'py-09-linear-pr.md' },
  { id: 'py-02-branching', ktp: 27, title: 'Условный оператор: неполная форма', file: 'py-02-branching.md' },
  { id: 'py-07-condition', ktp: 28, title: 'Условный оператор: полная форма и сложные условия', file: 'py-07-condition.md' },
  { id: 'py-03-loops', ktp: 29, title: 'Python: цикл while и алгоритм Евклида', file: 'py-03-loops.md' },
  { id: 'ss-30-control', ktp: 30, title: 'Итоговая контрольная работа', file: 'ss-30-control.md' },
  { id: 'py-10-for-loops', ktp: 31, title: 'Программирование циклов с заданным числом повторений', file: 'py-10-for-loops.md' },
  { id: 'py-11-for-loops-2', ktp: 32, title: 'Программирование циклов с заданным числом повторений: продолжение', file: 'py-11-for-loops-2.md' },
  { id: 'py-04-strings', ktp: 33, title: 'Обработка символьных данных', file: 'py-04-strings.md' },
  { id: 'py-08-strings-2', ktp: 34, title: 'Обработка символьных данных: продолжение', file: 'py-08-strings-2.md' },
  { id: 'algo-01-results', ktp: 35, title: 'Возможные результаты работы алгоритма', file: 'algo-01-results.md' },
  { id: 'algo-02-inputs', ktp: 36, title: 'Возможные входные данные, приводящие к результату', file: 'algo-02-inputs.md' },
];

export const LESSONS_7: LessonMeta[] = [
  { id: '7inf-01-info', ktp: 1, title: 'Информация и информационные процессы', file: '7inf-01-info.md' },
  { id: '7inf-05-discrete', ktp: 2, title: 'Дискретность данных', file: '7inf-05-discrete.md' },
  { id: '7pc-03-types', ktp: 3, title: 'Типы компьютеров и тенденции развития', file: '7pc-03-types.md' },
  { id: '7pc-01-hardware', ktp: 4, title: 'Компьютер и его устройства', file: '7pc-01-hardware.md' },
  { id: '7pc-02-software', ktp: 5, title: 'Программное обеспечение и его классификация', file: '7pc-02-software.md' },
  { id: '7pc-02-files', ktp: 6, title: 'Файловая система и типы файлов', file: '7pc-02-files.md' },
  { id: '7soft-01-practice', ktp: 7, title: 'Практическая работа: размеры файлов и операции с файлами', file: '7soft-01-practice.md' },
  { id: '7pc-04-safe', ktp: 8, title: 'Защита от вирусов и архиваторы', file: '7pc-04-safe.md' },
  { id: '7inf-02-coding', ktp: 9, title: 'Знаки, языки и двоичный алфавит', file: '7inf-02-coding.md' },
  { id: '7inf-06-codes', ktp: 10, title: 'Кодирование и декодирование текстов', file: '7inf-06-codes.md' },
  { id: '7inf-03-measure', ktp: 11, title: 'Измерение информации и кодировки', file: '7inf-03-measure.md' },
  { id: '7inf-07-volume', ktp: 12, title: 'Информационный объём сообщения', file: '7inf-07-volume.md' },
  { id: '7inf-08-units', ktp: 13, title: 'Единицы измерения информации и переводы', file: '7inf-08-units.md' },
  { id: '7inf-04-textvolume', ktp: 14, title: 'Информационный объём текста: решение задач', file: '7inf-04-textvolume.md' },
  { id: '7inf-09-textvolume-2', ktp: 15, title: 'Информационный объём текста: решение задач (продолжение)', file: '7inf-09-textvolume-2.md' },
  { id: '7gfx-03-color', ktp: 16, title: 'Кодирование графической информации и цвет', file: '7gfx-03-color.md' },
  { id: '7gfx-01-graphics', ktp: 17, title: 'Объём растрового изображения и форматы', file: '7gfx-01-graphics.md' },
  { id: '7code-01-sound', ktp: 18, title: 'Кодирование звука и видео', file: '7code-01-sound.md' },
  { id: '7net-02-speed', ktp: 19, title: 'Скорость передачи данных', file: '7net-02-speed.md' },
  { id: '7net-01-internet', ktp: 20, title: 'Интернет, Всемирная паутина и поисковые запросы', file: '7net-01-internet.md' },
  { id: '7net-03-safety', ktp: 21, title: 'Адреса веб-ресурсов, сетевой этикет и безопасность', file: '7net-03-safety.md' },
  { id: '7doc-01-text', ktp: 22, title: 'Текстовый документ и правила набора', file: '7doc-01-text.md' },
  { id: '7doc-02-format', ktp: 23, title: 'Практическая работа: клавиатурное письмо', file: '7doc-02-format.md' },
  { id: '7doc-03-styles', ktp: 24, title: 'Практическая работа: форматирование документа', file: '7doc-03-styles.md' },
  { id: '7doc-04-lists', ktp: 25, title: 'Списки и таблицы', file: '7doc-04-lists.md' },
  { id: '7doc-05-objects', ktp: 26, title: 'Практическая работа: формулы, таблицы, изображения', file: '7doc-05-objects.md' },
  { id: '7doc-06-citations', ktp: 27, title: 'Практическая работа: цитаты и ссылки на источники', file: '7doc-06-citations.md' },
  { id: '7media-01-slides', ktp: 28, title: 'Мультимедиа и компьютерные презентации', file: '7media-01-slides.md' },
  { id: '7media-02-multi', ktp: 29, title: 'Многостраничная презентация и анимация', file: '7media-02-multi.md' },
  { id: '7media-03-links', ktp: 30, title: 'Гиперссылки и аудиовизуальные данные', file: '7media-03-links.md' },
  { id: '7gfx-02-editors', ktp: 31, title: 'Виды компьютерной графики и редакторы', file: '7gfx-02-editors.md' },
  { id: '7inf-10-control', ktp: 32, title: 'Итоговая контрольная работа', file: '7inf-10-control.md' },
  { id: '7inf-11-errors', ktp: 33, title: 'Анализ контрольной и работа над ошибками', file: '7inf-11-errors.md' },
  { id: '7gfx-04-raster', ktp: 34, title: 'Растровые рисунки', file: '7gfx-04-raster.md' },
  { id: '7doc-07-vector', ktp: 35, title: 'Векторная графика средствами текстового процессора', file: '7doc-07-vector.md' },
  { id: '7gfx-05-vector', ktp: 36, title: 'Практическая работа: векторный графический редактор', file: '7gfx-05-vector.md' },
];

export const LESSONS_9: LessonMeta[] = [
  { id: '9sheet-01-base', title: 'Таблицы: интерфейс, формулы, режимы', file: '9sheet-01-base.md' },
  { id: '9sheet-02-refs', title: 'Ссылки: относительные, абсолютные, смешанные', file: '9sheet-02-refs.md' },
  { id: '9sheet-03-analysis', title: 'Анализ данных: условия, сортировка, диаграммы', file: '9sheet-03-analysis.md' },
  { id: '9arr-01-basics', title: 'Массивы: хранение и обработка', file: '9arr-01-basics.md' },
  { id: '9arr-02-search', title: 'Поиск и сортировка: максимум, перебор', file: '9arr-02-search.md' },
  { id: '9graph-01-graphs', title: 'Графы: элементы, матрицы, пути', file: '9graph-01-graphs.md' },
  { id: '9robot-01-control', title: 'Управление, сигналы, роботы', file: '9robot-01-control.md' },
  { id: '9model-01-models', title: 'Модели и моделирование', file: '9model-01-models.md' },
  { id: '9net-01-internet', title: 'Интернет: адреса, DNS, безопасность', file: '9net-01-internet.md' },
];

export const LESSONS_10: LessonMeta[] = [
  { id: '10hw-01-pc', title: 'Компьютер: устройство, конфигурация, ПО', file: '10hw-01-pc.md' },
  { id: '10info-01-measure', title: 'Измерение информации: Шеннон и алфавит', file: '10info-01-measure.md' },
  { id: '10ss-01-systems', title: 'Системы счисления: P-ичные, дроби, память', file: '10ss-01-systems.md' },
  { id: '10logic-01-ops', title: 'Логика: пять операций, предикаты', file: '10logic-01-ops.md' },
  { id: '10logic-02-transform', title: 'Уравнения, нормальные формы, схемы', file: '10logic-02-transform.md' },
  { id: '10media-01-docs', title: 'Документы, графика, мультимедиа', file: '10media-01-docs.md' },
];

export const LESSONS_11: LessonMeta[] = [
  { id: '11data-01-analysis', title: 'Анализ данных в таблицах', file: '11data-01-analysis.md' },
  { id: '11db-01-databases', title: 'Реляционные базы данных', file: '11db-01-databases.md' },
  { id: '11algo-01-analysis', title: 'Анализ алгоритмов и исполнитель Автомат', file: '11algo-01-analysis.md' },
  { id: '11algo-02-advanced', title: 'Сортировки, матрицы, строки, рекурсия', file: '11algo-02-advanced.md' },
  { id: '11net-01-networks', title: 'Сети: пакеты, топологии, маски, DNS', file: '11net-01-networks.md' },
  { id: '11safe-01-security', title: 'Безопасность и искусственный интеллект', file: '11safe-01-security.md' },
  { id: '11graph-01-graphs', title: 'Графы и деревья: пути и оптимум', file: '11graph-01-graphs.md' },
  { id: '11graph-02-games', title: 'Игры с полной информацией: стратегии', file: '11graph-02-games.md' },
];
