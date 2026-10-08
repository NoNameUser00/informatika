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
  { id: 'alg-03-branching', title: 'Ветвление: полная и неполная формы', file: 'alg-03-branching.md' },
  { id: 'alg-04-loops', title: 'Повторение: циклы', file: 'alg-04-loops.md' },
  { id: 'py-01-basics', title: 'Python: программа, присваивание, ввод и вывод', file: 'py-01-basics.md' },
  { id: 'py-02-branching', title: 'Python: ветвление if-else', file: 'py-02-branching.md' },
  { id: 'py-03-loops', title: 'Python: циклы while и for', file: 'py-03-loops.md' },
  { id: 'py-04-strings', title: 'Python: строки и анализ алгоритмов', file: 'py-04-strings.md' },
];

export const LESSONS_7: LessonMeta[] = [
  { id: '7inf-01-info', title: 'Информация, свойства, процессы', file: '7inf-01-info.md' },
  { id: '7inf-02-coding', title: 'Двоичное кодирование', file: '7inf-02-coding.md' },
  { id: '7inf-03-measure', title: 'Измерение информации: вес символа и объём', file: '7inf-03-measure.md' },
  { id: '7inf-04-textvolume', title: 'Объём текста: решаем задачи', file: '7inf-04-textvolume.md' },
  { id: '7pc-01-hardware', title: 'Компьютер: устройства, память, программы', file: '7pc-01-hardware.md' },
  { id: '7pc-02-files', title: 'Файлы: маски, архивы, вирусы', file: '7pc-02-files.md' },
  { id: '7doc-01-text', title: 'Текст: набор, форматирование, структуры', file: '7doc-01-text.md' },
  { id: '7gfx-01-graphics', title: 'Графика: растр и вектор, объём', file: '7gfx-01-graphics.md' },
  { id: '7net-01-internet', title: 'Интернет: поиск, адреса, безопасность', file: '7net-01-internet.md' },
  { id: '7media-01-slides', title: 'Презентации: слайды, дизайн, анимация', file: '7media-01-slides.md' },
  { id: '7gfx-02-editors', title: 'Графические редакторы: растр и вектор', file: '7gfx-02-editors.md' },
  { id: '7soft-01-practice', title: 'ПО и файлы на практике', file: '7soft-01-practice.md' },
  { id: '7code-01-sound', title: 'Звук и скорость передачи', file: '7code-01-sound.md' },
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
