// Коды работ (test_code из checks-JSON) -> куда вести учителя.
// Слаг — страница работы; для 7inf страницы называются control-info / proverka-info.
export interface WorkMeta {
  grade: string;
  slug: string;
  title: string;
}

export const WORKS: Record<string, WorkMeta> = {
  'numsys-proverka-v1': { grade: '8', slug: 'proverka-ss', title: 'Проверочная: Системы счисления' },
  'numsys-control-v1': { grade: '8', slug: 'control-ss', title: 'Контрольная: Системы счисления' },
  'logic-proverka-v1': { grade: '8', slug: 'proverka-logic', title: 'Проверочная: Логика' },
  'logic-control-v1': { grade: '8', slug: 'control-logic', title: 'Контрольная: Логика' },
  'algo-proverka-v1': { grade: '8', slug: 'proverka-algo', title: 'Проверочная: Алгоритмы' },
  'algo-control-v1': { grade: '8', slug: 'control-algo', title: 'Контрольная: Алгоритмы' },
  'grade7-proverka-v1': { grade: '7', slug: 'proverka-info', title: 'Проверочная: Информация' },
  'grade7-control-v1': { grade: '7', slug: 'control-info', title: 'Контрольная: Информация' },
  'grade7base-proverka-v1': { grade: '7', slug: 'proverka-7base', title: 'Проверочная: Компьютер и софт' },
  'grade7base-control-v1': { grade: '7', slug: 'control-7base', title: 'Контрольная: Компьютер и софт' },
  'sheet9-proverka-v1': { grade: '9', slug: 'proverka-9sheet', title: 'Проверочная: Таблицы' },
  'sheet9-control-v1': { grade: '9', slug: 'control-9sheet', title: 'Контрольная: Таблицы' },
  'arr9-proverka-v1': { grade: '9', slug: 'proverka-9arr', title: 'Проверочная: Массивы' },
  'arr9-control-v1': { grade: '9', slug: 'control-9arr', title: 'Контрольная: Массивы' },
  'graph9-proverka-v1': { grade: '9', slug: 'proverka-9graph', title: 'Проверочная: Графы' },
  'graph9-control-v1': { grade: '9', slug: 'control-9graph', title: 'Контрольная: Графы' },
  'extra9-proverka-v1': { grade: '9', slug: 'proverka-9extra', title: 'Проверочная: Роботы и модели' },
  'extra9-control-v1': { grade: '9', slug: 'control-9extra', title: 'Контрольная: Роботы, модели, интернет' },
  'base10-proverka-v1': { grade: '10', slug: 'proverka-10base', title: 'Проверочная: Железо и информация' },
  'base10-control-v1': { grade: '10', slug: 'control-10base', title: 'Контрольная: Железо и информация' },
  'adv10-proverka-v1': { grade: '10', slug: 'proverka-10adv', title: 'Проверочная: СС и логика' },
  'adv10-control-v1': { grade: '10', slug: 'control-10adv', title: 'Контрольная: СС и логика' },
  'media10-proverka-v1': { grade: '10', slug: 'proverka-10media', title: 'Проверочная: Документы' },
  'media10-control-v1': { grade: '10', slug: 'control-10media', title: 'Контрольная: Документы и мультимедиа' },
  'base11-proverka-v1': { grade: '11', slug: 'proverka-11base', title: 'Проверочная: Данные и БД' },
  'base11-control-v1': { grade: '11', slug: 'control-11base', title: 'Контрольная: Данные и БД' },
  'algo11-proverka-v1': { grade: '11', slug: 'proverka-11algo', title: 'Проверочная: Алгоритмы 11' },
  'algo11-control-v1': { grade: '11', slug: 'control-11algo', title: 'Контрольная: Алгоритмы 11' },
  'net11-proverka-v1': { grade: '11', slug: 'proverka-11net', title: 'Проверочная: Сети и безопасность' },
  'net11-control-v1': { grade: '11', slug: 'control-11net', title: 'Контрольная: Сети и безопасность' },
  'grade7media-proverka-v1': { grade: '7', slug: 'proverka-7media', title: 'Проверочная: Мультимедиа' },
  'grade7media-control-v1': { grade: '7', slug: 'control-7media', title: 'Контрольная: Мультимедиа и практика' },
  'graph11-proverka-v1': { grade: '11', slug: 'proverka-11graph', title: 'Проверочная: Графы и игры' },
  'graph11-control-v1': { grade: '11', slug: 'control-11graph', title: 'Контрольная: Графы и игры' },
};
