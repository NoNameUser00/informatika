// PROTOTYPE (throwaway): общие демо-данные для прототипов главной и урока.
// Только выдуманный прогресс + реальные названия разделов. Ответов контрольных нет.

export interface Grade {
  n: string;
  color: string;
  emoji: string;
  status: string;
  topics: string;
  /** Демо-прогресс для прототипа: где остановился и что дальше. */
  stopped: string;
  next: string;
}

export const GRADES: Grade[] = [
  { n: '7', color: '#16a34a', emoji: '🧩', status: 'Только урок 0', topics: 'ТБ · остальное — в разработке', stopped: 'Урок 0 · Техника безопасности', next: 'Новые темы — скоро' },
  { n: '8', color: '#2563eb', emoji: '💻', status: 'Полный блок', topics: 'ТБ · Системы счисления · Логика', stopped: 'СС · Урок 2 · Двоичная система', next: 'СС · Урок 3 · Восьмеричная и триады' },
  { n: '9', color: '#9333ea', emoji: '🤖', status: 'Только урок 0', topics: 'ТБ · остальное — в разработке', stopped: 'Урок 0 · Техника безопасности', next: 'Новые темы — скоро' },
  { n: '10', color: '#ea580c', emoji: '📊', status: 'Только урок 0', topics: 'ТБ · остальное — в разработке', stopped: 'Урок 0 · Техника безопасности', next: 'Новые темы — скоро' },
  { n: '11', color: '#dc2626', emoji: '🎓', status: 'Только урок 0', topics: 'ТБ · остальное — в разработке', stopped: 'Урок 0 · Техника безопасности', next: 'Новые темы — скоро' },
];

export type NodeState = 'done' | 'current' | 'locked';

export interface PathNode {
  id: string;
  title: string;
  state: NodeState;
}

export const PATH_8: PathNode[] = [
  { id: 'tb', title: 'Урок 0 · Техника безопасности', state: 'done' },
  { id: 'ss1', title: 'СС · Урок 1 · Позиционные и непозиционные', state: 'done' },
  { id: 'ss2', title: 'СС · Урок 2 · Двоичная система', state: 'done' },
  { id: 'ss3', title: 'СС · Урок 3 · Восьмеричная и триады', state: 'current' },
  { id: 'ss4', title: 'СС · Урок 4 · Шестнадцатеричная', state: 'locked' },
  { id: 'ss5', title: 'СС · Урок 5 · Арифметика в 2СС', state: 'locked' },
  { id: 'ss6', title: 'СС · Урок 6 · Обобщение', state: 'locked' },
  { id: 'trainer', title: 'Тренажёр СС · 60 заданий', state: 'locked' },
  { id: 'logic', title: 'Логика · 4 урока + тренажёр', state: 'locked' },
];

// Демо-задание для прототипа урока (тривиальный пример, не из банка контрольных).
export const SAMPLE = {
  lessonNo: 2,
  lessonTitle: 'Двоичная система: веса разрядов',
  concept:
    'Вес каждого разряда — степень двойки. Читаем справа налево: 1, 2, 4, 8, 16, 32, 64, 128.',
  bits: ['128', '64', '32', '16', '8', '4', '2', '1'],
  example: '1011₂ = 8 + 0 + 2 + 1 = 11',
  task: 'Чему равно 1011₂ в десятичной системе?',
  options: ['9', '10', '11', '13'],
  correct: '11',
  praise: 'Верно! 8 + 2 + 1 = 11.',
  hint: 'Подпиши под каждой цифрой её вес и сложи только те, где стоит 1.',
};
