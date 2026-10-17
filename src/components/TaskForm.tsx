import { useMemo, useState } from 'react';
import { LESSONS_7, LESSONS_8, LESSONS_9, LESSONS_10, LESSONS_11, type LessonMeta } from '../data/lessons';
import bankIndex from '../data/bank-index.json';
import { checkDraft } from '../lib/tasks/check-draft.mjs';

type TaskType = 'single_choice' | 'numeric_base' | 'matching' | 'code_run';

interface Option { id: string; text: string; }

interface Draft {
  type: TaskType;
  bankFile: string;
  cls: number;
  topic: string;
  subtopic: string;
  prompt: string;
  points: number;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  cognitive_level: 'remember' | 'apply' | 'analyze';
  lesson: string;
  fgos_subject: string;
  fgos_meta: string;
  // single_choice
  options: Option[];
  answer: string; // id of correct option
  explanation: string;
  common_errors: string;
  // numeric_base
  base: number;
  placeholder: string;
  accepted: string;
  answer_text: string;
  // matching
  left: string[];
  right: string[];
  answer_map: Record<string, string>;
  // code_run
  template: string;
  solution_code: string;
  expected_stdout: string;
}

const ALL_LESSONS: LessonMeta[] = [...LESSONS_7, ...LESSONS_8, ...LESSONS_9, ...LESSONS_10, ...LESSONS_11];

function nextIdFor(bankFile: string): string {
  const bank = (bankIndex as any).banks.find((b: any) => b.file === bankFile);
  if (!bank) return '';
  return `inf-${bank.class}-${bank.token}-${String(bank.nextId).padStart(3, '0')}`;
}

function yamlEscape(s: string): string {
  return JSON.stringify(s);
}

function buildYaml(d: Draft): string {
  const id = nextIdFor(d.bankFile);
  const base = `  - id: ${id}
  class: ${d.cls}
  topic: ${yamlEscape(d.topic)}
  subtopic: ${yamlEscape(d.subtopic)}
  type: ${d.type}
  difficulty: ${d.difficulty}
  cognitive_level: ${d.cognitive_level}
  points: ${d.points}
  lesson: ${yamlEscape(d.lesson)}
  fgos_requirement: 1.1
  fgos_element: 1.1
  fgos: { subject: [${d.fgos_subject}], meta: [${d.fgos_meta}] }
  prompt: ${yamlEscape(d.prompt)}`;

  if (d.type === 'single_choice') {
    const opts = d.options.map((o) => `{ id: ${o.id}, text: ${yamlEscape(o.text)} }`).join(', ');
    const errs = d.common_errors.split('\n').map((s) => s.trim()).filter(Boolean);
    const errsYaml = errs.length ? `[${errs.map(yamlEscape).join(', ')}]` : '[]';
    return `${base}
  student_view: { options: [${opts}] }
  auto_check: { method: exact_option }
  teacher_only: { answer: "${d.answer}", answer_text: ${yamlEscape(d.answer_text)}, explanation: ${yamlEscape(d.explanation)}, common_errors: ${errsYaml} }`;
  }

  if (d.type === 'numeric_base') {
    const vals = d.accepted.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    return `${base}
  student_view: { base: ${d.base}, placeholder: ${yamlEscape(d.placeholder)} }
  auto_check: { method: numeric_base, base: ${d.base} }
  teacher_only: { accepted_values_decimal: [${vals.join(', ')}], answer_text: ${yamlEscape(d.answer_text)}, explanation: ${yamlEscape(d.explanation)} }`;
  }

  if (d.type === 'matching') {
    const left = d.left.map(yamlEscape).join(', ');
    const right = d.right.map(yamlEscape).join(', ');
    const map = Object.entries(d.answer_map).map(([k, v]) => `${yamlEscape(k)}: ${yamlEscape(v)}`).join(', ');
    return `${base}
  student_view: { left: [${left}], right: [${right}] }
  auto_check: { method: matching }
  teacher_only: { answer_map: { ${map} }, explanation: ${yamlEscape(d.explanation)} }`;
  }

  // code_run
  return `${base}
  student_view: { language: python, template: ${yamlEscape(d.template)} }
  auto_check: { method: code_stdout, timeout_s: 5 }
  teacher_only: { solution_code: ${yamlEscape(d.solution_code)}, expected_stdout: ${yamlEscape(d.expected_stdout)}, explanation: ${yamlEscape(d.explanation)} }`;
}

const EMPTY_DRAFT: Draft = {
  type: 'single_choice',
  bankFile: '',
  cls: 8,
  topic: '',
  subtopic: '',
  prompt: '',
  points: 1,
  difficulty: 'basic',
  cognitive_level: 'remember',
  lesson: '',
  fgos_subject: 'inf-8-numsys-represent',
  fgos_meta: 'plan-actions',
  options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }],
  answer: 'A',
  explanation: '',
  common_errors: '',
  base: 2,
  placeholder: '',
  accepted: '',
  answer_text: '',
  left: ['', '', ''],
  right: ['', '', ''],
  answer_map: {},
  template: '',
  solution_code: '',
  expected_stdout: '',
};

export default function TaskForm() {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const banks = (bankIndex as any).banks as { file: string; token: string; class: number; nextId: number }[];
  const lessons = ALL_LESSONS.filter((l) => !draft.cls || l.id.startsWith(String(draft.cls)));

  const result = useMemo(() => checkDraft(draft), [draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function onTypeChange(t: TaskType) {
    setDraft((d) => ({ ...d, type: t }));
  }

  function onGenerate() {
    const yaml = buildYaml(draft);
    setOutput(yaml);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="card">
      <h2>Новое задание</h2>

      <label>Тип
        <select value={draft.type} onChange={(e) => onTypeChange(e.target.value as TaskType)}>
          <option value="single_choice">Тестовое (выбор варианта)</option>
          <option value="numeric_base">Числовой ответ</option>
          <option value="matching">Соответствие</option>
          <option value="code_run">Код</option>
        </select>
      </label>

      <label>Целевой банк
        <select value={draft.bankFile} onChange={(e) => set('bankFile', e.target.value)}>
          <option value="">— выбери банк —</option>
          {banks.map((b) => (
            <option key={b.file} value={b.file}>{b.file} (следующий: inf-{b.class}-{b.token}-{String(b.nextId).padStart(3, '0')})</option>
          ))}
        </select>
      </label>

      <label>Класс
        <input type="number" value={draft.cls} onChange={(e) => set('cls', Number(e.target.value))} />
      </label>
      <label>Тема
        <input value={draft.topic} onChange={(e) => set('topic', e.target.value)} />
      </label>
      <label>Подтема
        <input value={draft.subtopic} onChange={(e) => set('subtopic', e.target.value)} />
      </label>
      <label>Вопрос
        <textarea value={draft.prompt} onChange={(e) => set('prompt', e.target.value)} rows={3} />
      </label>
      <label>Баллы
        <input type="number" value={draft.points} onChange={(e) => set('points', Number(e.target.value))} />
      </label>
      <label>Сложность
        <select value={draft.difficulty} onChange={(e) => set('difficulty', e.target.value as any)}>
          <option value="basic">basic</option>
          <option value="intermediate">intermediate</option>
          <option value="advanced">advanced</option>
        </select>
      </label>
      <label>Когнитивный уровень
        <select value={draft.cognitive_level} onChange={(e) => set('cognitive_level', e.target.value as any)}>
          <option value="remember">remember</option>
          <option value="apply">apply</option>
          <option value="analyze">analyze</option>
        </select>
      </label>
      <label>Урок
        <select value={draft.lesson} onChange={(e) => set('lesson', e.target.value)}>
          <option value="">— выбери урок —</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>{l.id} — {l.title}</option>
          ))}
        </select>
      </label>
      <label>FGOS subject (через запятую)
        <input value={draft.fgos_subject} onChange={(e) => set('fgos_subject', e.target.value)} />
      </label>

      {draft.type === 'single_choice' && (
        <>
          <h3>Варианты</h3>
          {draft.options.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 24 }}>{o.id}.</span>
              <input style={{ flex: 1 }} value={o.text} onChange={(e) => {
                const next = [...draft.options];
                next[i] = { ...next[i], text: e.target.value };
                set('options', next);
              }} />
              <button type="button" onClick={() => set('answer', o.id)} disabled={draft.answer === o.id}>
                {draft.answer === o.id ? '✓ верный' : 'сделать верным'}
              </button>
            </div>
          ))}
          <label>Объяснение (обязательно)
            <textarea value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} rows={3} />
          </label>
          <label>Типичные ошибки (по одной на строку)
            <textarea value={draft.common_errors} onChange={(e) => set('common_errors', e.target.value)} rows={2} />
          </label>
        </>
      )}

      {draft.type === 'numeric_base' && (
        <>
          <label>Основание
            <input type="number" value={draft.base} onChange={(e) => set('base', Number(e.target.value))} />
          </label>
          <label>Подсказка в поле
            <input value={draft.placeholder} onChange={(e) => set('placeholder', e.target.value)} />
          </label>
          <label>Допустимые значения (через запятую, в десятичной)
            <input value={draft.accepted} onChange={(e) => set('accepted', e.target.value)} />
          </label>
          <label>Ключ (answer_text)
            <input value={draft.answer_text} onChange={(e) => set('answer_text', e.target.value)} />
          </label>
          <label>Объяснение (обязательно)
            <textarea value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} rows={3} />
          </label>
        </>
      )}

      {draft.type === 'matching' && (
        <>
          <p className="muted">Заполни левую и правую части по строкам (по одной на строку), затем укажи пары.</p>
          <label>Левая часть (по одной на строку)
            <textarea value={draft.left.join('\n')} onChange={(e) => set('left', e.target.value.split('\n'))} rows={4} />
          </label>
          <label>Правая часть (по одной на строку)
            <textarea value={draft.right.join('\n')} onChange={(e) => set('right', e.target.value.split('\n'))} rows={4} />
          </label>
          <label>Объяснение (обязательно)
            <textarea value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} rows={3} />
          </label>
        </>
      )}

      {draft.type === 'code_run' && (
        <>
          <label>Шаблон
            <textarea value={draft.template} onChange={(e) => set('template', e.target.value)} rows={4} />
          </label>
          <label>Решение (solution_code)
            <textarea value={draft.solution_code} onChange={(e) => set('solution_code', e.target.value)} rows={6} />
          </label>
          <label>Ожидаемый вывод (expected_stdout)
            <textarea value={draft.expected_stdout} onChange={(e) => set('expected_stdout', e.target.value)} rows={3} />
          </label>
          <label>Объяснение (обязательно)
            <textarea value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} rows={3} />
          </label>
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="btn" type="button" onClick={onGenerate}>Собрать YAML</button>
      </div>

      {(result.errors.length > 0 || result.warnings.length > 0) && (
        <div style={{ marginTop: 12 }}>
          {result.errors.length > 0 && (
            <div className="card">
              <strong>Ошибки (блокируют сборку):</strong>
              <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              {result.bypassSnippet && (
                <>
                  <p className="muted">Если уверен, что проверка ошиблась — добавь в allow-лист:</p>
                  <pre>{result.bypassSnippet}</pre>
                </>
              )}
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="card">
              <strong>Предупреждения:</strong>
              <ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {output && (
        <div style={{ marginTop: 12 }}>
          <h3>Готовый YAML</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{output}</pre>
          <button className="btn" type="button" onClick={onCopy}>{copied ? 'Скопировано' : 'Копировать'}</button>
        </div>
      )}
    </div>
  );
}