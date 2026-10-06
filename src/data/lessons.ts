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
];
