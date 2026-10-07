// Единый реестр уроков пилота (порядок = уроки 1-6 по docs/curriculum-8-ss.md).
export interface LessonMeta {
  id: string;
  title: string;
  file: string;
}
export const LESSONS_8: LessonMeta[] = [
  { id: 'numsys-01-intro', title: 'Общие сведения: позиционные и непозиционные системы', file: 'numsys-01-intro.md' },
  { id: 'numsys-02-binary', title: 'Двоичная система: веса разрядов и переводы 10↔2', file: 'numsys-02-binary.md' },
  { id: 'numsys-03-octal', title: 'Восьмеричная система и триады', file: 'numsys-03-octal.md' },
  { id: 'numsys-04-hex', title: 'Шестнадцатеричная система и тетрады', file: 'numsys-04-hex.md' },
  { id: 'numsys-05-arith', title: 'Арифметика в двоичной системе', file: 'numsys-05-arith.md' },
  { id: 'numsys-06-review', title: 'Обобщение: ловушки переводов и смешанный тренажер', file: 'numsys-06-review.md' },
  { id: 'logic-01-utterances', title: 'Высказывания', file: 'logic-01-utterances.md' },
  { id: 'logic-02-operations', title: 'Логические операции И, ИЛИ, НЕ', file: 'logic-02-operations.md' },
  { id: 'logic-03-truth-tables', title: 'Логические выражения и таблицы истинности', file: 'logic-03-truth-tables.md' },
  { id: 'logic-04-elements', title: 'Логические элементы и основы компьютера', file: 'logic-04-elements.md' },
  { id: 'alg-01-performers', title: 'Алгоритмы и исполнители', file: 'alg-01-performers.md' },
  { id: 'alg-02-notation', title: 'Способы записи алгоритмов', file: 'alg-02-notation.md' },
  { id: 'alg-03-branching', title: 'Ветвление: полная и неполная формы', file: 'alg-03-branching.md' },
  { id: 'alg-04-loops', title: 'Повторение: циклы', file: 'alg-04-loops.md' },
  { id: 'py-01-basics', title: 'Python: программа, присваивание, ввод и вывод', file: 'py-01-basics.md' },
  { id: 'py-02-branching', title: 'Python: ветвление if-else', file: 'py-02-branching.md' },
  { id: 'py-03-loops', title: 'Python: циклы while и for', file: 'py-03-loops.md' },
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
];
