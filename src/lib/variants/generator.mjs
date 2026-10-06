// Генератор вариантов контрольной. Чистые функции, детерминированный seed.
// Серверная часть: снапшот + ключи никогда не уходят ученику (только свои вопросы без key).
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// bank: [{id, difficulty, type, points, options?, correct?, answerMap?, left?, right?, key?}]
// template: {id, slots: [{difficulty, count, points_each}], shuffle_questions, shuffle_options}
export function generateVariant(template, bank, variantNumber, salt) {
  const seed = fnv1a(`${template.id}|${variantNumber}|${salt}`);
  const rng = mulberry32(seed);
  const used = new Set();
  const picked = [];

  for (const slot of template.slots) {
    const pool = shuffle(
      bank.filter((t) => t.difficulty === slot.difficulty && !used.has(t.id)),
      rng,
    );
    if (pool.length < slot.count) {
      throw new Error(`Слот ${slot.difficulty}: нужно ${slot.count}, есть ${pool.length} (вариант ${variantNumber})`);
    }
    for (const t of pool.slice(0, slot.count)) {
      used.add(t.id);
      picked.push({ task: t, points: slot.points_each });
    }
  }

  let questions = picked.map(({ task, points }) => {
    const q = { task_id: task.id, type: task.type, points };
    if (task.type === 'single_choice' && template.shuffle_options) {
      const order = shuffle(task.options.map((o) => o.id), rng);
      const correct = task.options.find((o) => o.id === task.correct);
      q.options = order.map((id) => task.options.find((o) => o.id === id));
      q.key = { correct_id: task.correct, correct_text: correct.text, position: order.indexOf(task.correct) + 1 };
    } else if (task.type === 'single_choice') {
      q.options = task.options;
      q.key = { correct_id: task.correct };
    } else if (task.type === 'matching' && template.shuffle_options) {
      q.left = task.left.slice();
      q.right = shuffle(task.right, rng);
      q.key = { answer_map: task.answerMap };
    } else if (task.type === 'matching') {
      q.left = task.left.slice();
      q.right = task.right.slice();
      q.key = { answer_map: task.answerMap };
    } else {
      q.key = { expected: task.expected ?? null, key_text: task.key ?? null };
    }
    return q;
  });

  if (template.shuffle_questions) {
    questions = shuffle(questions, rng);
    questions.forEach((q, i) => { q.position = i + 1; });
  } else {
    questions.forEach((q, i) => { q.position = i + 1; });
  }

  const max_points = questions.reduce((s, q) => s + q.points, 0);
  const snap = { variant_number: variantNumber, seed, questions, max_points };
  const checksum = fnv1a(JSON.stringify(snap)).toString(16).padStart(8, '0');
  return { ...snap, checksum };
}

export function validateVariant(snap, template, bank) {
  const errors = [];
  const byId = new Map(bank.map((t) => [t.id, t]));
  const ids = snap.questions.map((q) => q.task_id);
  if (new Set(ids).size !== ids.length) errors.push('повторы заданий внутри варианта');
  for (const q of snap.questions) if (!byId.has(q.task_id)) errors.push(`нет в банке: ${q.task_id}`);
  for (const slot of template.slots) {
    const n = snap.questions.filter((q) => byId.get(q.task_id)?.difficulty === slot.difficulty).length;
    if (n !== slot.count) errors.push(`слот ${slot.difficulty}: ${n} вместо ${slot.count}`);
  }
  const sum = snap.questions.reduce((s, q) => s + q.points, 0);
  if (sum !== snap.max_points) errors.push('сумма баллов != max_points');
  for (const q of snap.questions) if (!q.key) errors.push(`нет ключа: ${q.task_id}`);
  const positions = snap.questions.map((q) => q.position).sort((a, b) => a - b);
  if (positions.join(',') !== snap.questions.map((_, i) => i + 1).join(',')) errors.push('битые позиции');
  return errors;
}

export function generateAll(template, bank, count, salt) {
  return Array.from({ length: count }, (_, i) => generateVariant(template, bank, i + 1, salt));
}

// Сбалансированная раздача вариантов ученикам (перемешанная колода 1..N)
export function dealVariants(count, studentIds, salt) {
  const rng = mulberry32(fnv1a(`deal|${count}|${salt}`));
  const deck = [];
  for (let i = 0; i < studentIds.length; i++) deck.push((i % count) + 1);
  const shuffled = shuffle(deck, rng);
  return Object.fromEntries(studentIds.map((id, i) => [id, shuffled[i]]));
}
