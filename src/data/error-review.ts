// Шаблон «Работа над ошибками» после контрольных.
// Закрывает КТП 7 №33 и 10 №28, применим к любой контрольной.
// Ловушки — из разделов «Частые ошибки» конспектов src/content/lessons/*.
export interface ErrorTrap {
  /** Текст ловушки + правило. */
  text: string;
  /** Класс урока для повторения (для ссылки). */
  grade: string;
  /** id урока из src/data/lessons.ts. */
  lessonId: string;
}

export interface ControlReview {
  /** Код работы, как в src/data/checks/control-*.json (без префикса control-). */
  code: string;
  grade: string;
  title: string;
  /** Slug страницы контрольной. */
  slug: string;
  traps: ErrorTrap[];
}

/** Протокол разбора: единый шаблон на любой класс. */
export const REVIEW_PROTOCOL: string[] = [
  'Выгрузи журнал кнопкой «Экспорт CSV» и посчитай ошибки по заданиям — бери топ-3.',
  'Классифицируй каждую: невнимательность, пробел в теории или неверный приём.',
  'Разбери топ-3 у доски по шаблону «ловушка → правило → перепроверка» (доска выше).',
  'Задай адресную доработку: тренажёр + урок из списка ниже.',
  'Перепроверь через неделю облегчённой проверочной. Итог подтверждает учитель.',
];

export const ERROR_REVIEW: ControlReview[] = [
  { code: 'ss', grade: '8', title: 'Системы счисления', slug: 'control-ss', traps: [
    { text: 'Ведущие нули отбрасываются, нули внутри — нет: 010101100₂ читается без ведущих.', grade: '8', lessonId: 'numsys-06-review' },
    { text: 'Переход 8↔16 — только через двоичную; группировка строго справа.', grade: '8', lessonId: 'numsys-04-hex' },
    { text: 'Буквы A–F: A = 10, а не 1; минимальное основание (123 → 4, 506 → 7, F → 16).', grade: '8', lessonId: 'numsys-01-intro' },
  ] },
  { code: 'logic', grade: '8', title: 'Логика', slug: 'control-logic', traps: [
    { text: 'Приоритет НЕ → И → ИЛИ; скобки решают: ¬(0∨1∧1) = 0.', grade: '8', lessonId: 'logic-02-operations' },
    { text: 'Таблица истинности: 2ⁿ строк, порядок 000–111, столбцы чередуются.', grade: '8', lessonId: 'logic-03-truth-tables' },
    { text: 'Высказывание обязано оцениваться однозначно; вопрос — не высказывание.', grade: '8', lessonId: 'logic-01-utterances' },
  ] },
  { code: 'algo', grade: '8', title: 'Алгоритмы', slug: 'control-algo', traps: [
    { text: 'Вычислитель идёт по командам слева направо (21212 над 1 даёт 15).', grade: '8', lessonId: 'alg-01-performers' },
    { text: 'Присваивание := считает правую часть первой.', grade: '8', lessonId: 'alg-02-notation' },
    { text: 'Цикл обязан приближать выход; деление вычитанием 20/6: q = 3, r = 2.', grade: '8', lessonId: 'alg-04-loops' },
  ] },
  { code: 'info', grade: '7', title: 'Информация', slug: 'control-info', traps: [
    { text: 'K — штуки символов, I — биты: I = K·i.', grade: '7', lessonId: '7inf-03-measure' },
    { text: 'Единицы: /8 — в байты, /1024 — в Кбайт (24576 бит = 3 Кбайт).', grade: '7', lessonId: '7inf-03-measure' },
    { text: 'N = 2^i: таблица 2–256; обратная задача (100 символов → 7 бит).', grade: '7', lessonId: '7inf-02-coding' },
  ] },
  { code: '7base', grade: '7', title: 'Компьютер и софт', slug: 'control-7base', traps: [
    { text: 'Маски: ? — ровно один символ, * — любое число символов.', grade: '7', lessonId: '7pc-02-files' },
    { text: 'Ярлык ≠ файл; корзина очищается — не архив.', grade: '7', lessonId: '7soft-01-practice' },
    { text: 'Группы ПО: системное, прикладное, системы программирования.', grade: '7', lessonId: '7pc-01-hardware' },
  ] },
  { code: '7media', grade: '7', title: 'Мультимедиа и практика', slug: 'control-7media', traps: [
    { text: 'JPEG — фото, PNG — схемы, GIF — 256 цветов; BMP — огромный, без сжатия.', grade: '7', lessonId: '7gfx-02-editors' },
    { text: 'Растр vs вектор; объём растра I = K·i (ч/б 10×10 = 100 бит).', grade: '7', lessonId: '7gfx-01-graphics' },
    { text: 'Правило копии при редактировании; один смысл на слайд.', grade: '7', lessonId: '7media-01-slides' },
  ] },
  { code: '9sheet', grade: '9', title: 'Таблицы', slug: 'control-9sheet', traps: [
    { text: '$ — точечно: =$A2+B$1 при протягивании по B2:J10.', grade: '9', lessonId: '9sheet-02-refs' },
    { text: 'СУММ/МИН/МАКС + СЧЁТЕСЛИ с условием.', grade: '9', lessonId: '9sheet-03-analysis' },
    { text: 'Диаграмма под вопрос: доли — круг, сравнение — столбцы.', grade: '9', lessonId: '9sheet-03-analysis' },
  ] },
  { code: '9arr', grade: '9', title: 'Массивы', slug: 'control-9arr', traps: [
    { text: 'Индексы с 0; последний — len − 1.', grade: '9', lessonId: '9arr-01-basics' },
    { text: 'Накопитель обнулить до цикла; среднее 15/3 = 5.', grade: '9', lessonId: '9arr-01-basics' },
    { text: 'Максимум — старт с первого элемента (imax); [-5, -2, -9] → −2.', grade: '9', lessonId: '9arr-02-search' },
  ] },
  { code: '9graph', grade: '9', title: 'Графы', slug: 'control-9graph', traps: [
    { text: 'Матрица смежности: строка — ОТ, столбец — ДО.', grade: '9', lessonId: '9graph-01-graphs' },
    { text: 'Пути копятся по предшественникам; стартовая вершина = 1 путь.', grade: '9', lessonId: '9graph-01-graphs' },
    { text: 'Не считать пути «на глаз» — только накоплением по DAG.', grade: '9', lessonId: '9graph-01-graphs' },
  ] },
  { code: '9extra', grade: '9', title: 'Роботы, модели, интернет', slug: 'control-9extra', traps: [
    { text: 'Обратная связь идёт ОТ объекта К управлению; датчики — глаза робота.', grade: '9', lessonId: '9robot-01-control' },
    { text: 'Модель ≠ объект; проверка — адекватность (тормозной путь 72 км/ч → 40 м).', grade: '9', lessonId: '9model-01-models' },
    { text: 'IP — 4 числа 0–255; склейка 224.133.133.73 — порядок Б-Г-А-В.', grade: '9', lessonId: '9net-01-internet' },
  ] },
  { code: '10base', grade: '10', title: 'Железо и информация', slug: 'control-10base', traps: [
    { text: 'Магистрали: данных, адреса, управления.', grade: '10', lessonId: '10hw-01-pc' },
    { text: '2^i = N: 16 счетов → 4 бита; 6 бит → поле 8×8.', grade: '10', lessonId: '10info-01-measure' },
    { text: 'Фано: никакое слово — не начало другого; 010110 → АБВ.', grade: '10', lessonId: '10info-01-measure' },
  ] },
  { code: '10adv', grade: '10', title: 'СС и логика', slug: 'control-10adv', traps: [
    { text: 'Дроби: 0,625 → 0,101₂; 0,1 — бесконечная; float не сравнивают через ==.', grade: '10', lessonId: '10ss-01-systems' },
    { text: 'Импликация — только таблица; ⊕ vs ∨ (1⊕1 = 0, а 1∨1 = 1).', grade: '10', lessonId: '10logic-01-ops' },
    { text: 'Уравнение A→B = 0 — единственный вариант A = 1, B = 0; ДНФ/КНФ не путать.', grade: '10', lessonId: '10logic-02-transform' },
  ] },
  { code: '10media', grade: '10', title: 'Документы и мультимедиа', slug: 'control-10media', traps: [
    { text: 'Стили LibreOffice Writer: поменял стиль — поменялось всё; оглавление собирается само.', grade: '10', lessonId: '10media-01-docs' },
    { text: 'JPEG/PNG/SVG — по назначению; 3D — модели из примитивов.', grade: '10', lessonId: '10media-01-docs' },
    { text: 'Один смысл на слайд; рецензирование — правки и сравнение версий.', grade: '10', lessonId: '10media-01-docs' },
  ] },
  { code: '11base', grade: '11', title: 'Данные и БД', slug: 'control-11base', traps: [
    { text: 'Корреляция ≠ причинность (−0,9 — связь, а не вина).', grade: '11', lessonId: '11data-01-analysis' },
    { text: 'Первичный ключ — уникальность строки; внешний — связь таблиц.', grade: '11', lessonId: '11db-01-databases' },
    { text: 'Сортировать весь диапазон, а не один столбец.', grade: '11', lessonId: '11db-01-databases' },
  ] },
  { code: '11algo', grade: '11', title: 'Алгоритмы 11', slug: 'control-11algo', traps: [
    { text: 'Автомат разбирать по шагам (9575 → 1214); обратные: 1610 невозможен.', grade: '11', lessonId: '11algo-01-analysis' },
    { text: 'Сортировка выбором — приём «чемпиона» из 9 класса.', grade: '11', lessonId: '11algo-02-advanced' },
    { text: 'Сложность: n vs n² (100×100 = 10 000 операций).', grade: '11', lessonId: '11algo-02-advanced' },
  ] },
  { code: '11net', grade: '11', title: 'Сети и безопасность', slug: 'control-11net', traps: [
    { text: 'TCP собирает, IP доносит; маршрутизатор выбирает путь пакета.', grade: '11', lessonId: '11net-01-networks' },
    { text: 'Маска читается побитово: 192 = 11000000; 255.0.255.0 невалидна.', grade: '11', lessonId: '11net-01-networks' },
    { text: 'Слои: менеджер паролей, бэкапы в двух местах, подпись, шифрование.', grade: '11', lessonId: '11safe-01-security' },
  ] },
  { code: '11graph', grade: '11', title: 'Графы и игры', slug: 'control-11graph', traps: [
    { text: 'Дерево: связно, без циклов; рёбер на одно меньше, чем вершин.', grade: '11', lessonId: '11graph-01-graphs' },
    { text: 'Пути в DAG — накоплением от старта; кратчайший — минимум сумм весов.', grade: '11', lessonId: '11graph-01-graphs' },
    { text: 'W — есть ход в L; из 7 иди в 8, победа на 2-м ходу.', grade: '11', lessonId: '11graph-02-games' },
  ] },
];
