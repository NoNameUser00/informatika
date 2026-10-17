// Сканер ключей, которые аудит-гейт не ловит по одной причине.
//
// Слабое место findConflicts: если пояснение перечисляет ВСЕ варианты, веса у
// всех равны и противоречие не видно. Так вышло с inf-11-net-070: там
// пояснение честно объясняло, что распознаванием изображений занимается
// компьютерное зрение, а ключ указывал на обработку естественного языка —
// и гейт оставался зелёным, потому что «Обработка естественного языка» тоже
// встречается в пояснении.
//
// Здесь ловим более узкий и более надёжный признак: ПОЯСНЕНИЕ ОПРЕДЕЛЯЕТ
// вариант формулой «<текст варианта> — это …». Определение есть у верного
// ответа; у отвлекающего его быть не должно. Если определяется не тот вариант,
// который стоит в ключе, — это кандидат в неверный ключ.
//
// Проверка ничего не чинит и ничего не утверждает: это список на разбор глазами.
//
// Известное ложное срабатывание: inf-11-algo-039. Там пояснение говорит
// «O(log n) не применим, потому что…» — то есть прямо отвергает вариант, и
// формулировка «<вариант> — это …» в нём случайна. Такое и должно всплывать
// на разбор, а не чиниться автоматически.
import { loadAllTasks } from './audit-keys.mjs';

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const rows = [];
for (const t of loadAllTasks()) {
  if (t?.type !== 'single_choice') continue;
  const options = t.student_view?.options ?? [];
  const answer = t.teacher_only?.answer;
  const expl = norm(t.teacher_only?.explanation ?? '');
  if (!expl) continue;

  for (const o of options) {
    const name = norm(o.text);
    if (name.length < 4) continue; // короткие варианты дают ложные срабатывания
    // «<текст варианта> — это …»: после нормализации тире becomes space
    if (!expl.includes(name + ' это ')) continue;
    if (o.id === answer) continue;
    rows.push({
      id: t.id,
      file: t.__file,
      prompt: t.prompt,
      answer,
      answerText: options.find((x) => x.id === answer)?.text,
      defined: o.id,
      definedText: o.text,
      explanation: t.teacher_only?.explanation ?? '',
    });
  }
}

const out = [];
out.push(`scanned single_choice with explanation`);
out.push(`candidates where explanation defines a NON-keyed option: ${rows.length}`);
out.push('');
for (const r of rows) {
  out.push(`${r.id}  (${r.file})`);
  out.push(`  ${r.prompt}`);
  out.push(`  ключ ${r.answer} -> «${r.answerText}»`);
  out.push(`  пояснение определяет ${r.defined} -> «${r.definedText}»`);
  out.push(`  ${r.explanation}`);
  out.push('');
}
console.log(out.join('\n'));