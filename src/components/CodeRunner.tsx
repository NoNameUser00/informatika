// Встроенный запуск кода внутри задания тренажёра: редактор + кнопка,
// вердикт уходит наверх через onResult (тренажёр ставит баллы).
import { useRef, useState } from 'react';
import { compareOutput } from '../lib/pyrun/compare.mjs';
import { RUN_TIMEOUT_MS, runPythonWorker } from '../lib/pyrun/run-worker';

export default function CodeRunner({
  id,
  template,
  expected,
  onResult,
  quiet = false,
}: {
  id: string;
  template: string;
  expected: string;
  onResult: (ok: boolean, code: string) => void;
  /** Тихий режим ученика: вердикт «совпало/нет» скрыт, виден только вывод. */
  quiet?: boolean;
}) {
  const [code, setCode] = useState(template);
  const [status, setStatus] = useState<'idle' | 'running' | 'error' | 'done'>('idle');
  const [output, setOutput] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const runId = useRef(0);

  async function run() {
    const my = ++runId.current;
    setStatus('running');
    setOutput('');
    setVerdict(null);
    try {
      const { out, err } = await runPythonWorker(code);
      if (my !== runId.current) return;
      if (err) {
        setStatus('error');
        setOutput(err);
        setVerdict(false);
        onResult(false, code);
      } else {
        setStatus('done');
        setOutput(out);
        const ok = compareOutput(out, expected);
        setVerdict(ok);
        onResult(ok, code);
      }
    } catch (e: unknown) {
      if (my !== runId.current) return;
      setStatus('error');
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(msg);
      setVerdict(false);
      onResult(false, code);
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-code`}>Код Python (выполняется в твоём браузере, лимит {RUN_TIMEOUT_MS / 1000} c)</label>
      <textarea
        id={`${id}-code`}
        rows={6}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <p>
        <button
          type="button"
          className="btn secondary"
          style={{ width: 'auto' }}
          onClick={run}
          disabled={status === 'running'}
        >
          {status === 'running' ? 'Выполняется…' : 'Запустить и проверить'}
        </button>
      </p>
      {status === 'error' && <p className="bad" role="status">Ошибка — читай вывод ниже.</p>}
      {!quiet && verdict === true && <p className="ok" role="status">Вывод совпал с ожидаемым — задание засчитано.</p>}
      {!quiet && verdict === false && status === 'done' && (
        <p className="bad" role="status">Вывод не совпал — сравни с ожидаемым и попробуй ещё.</p>
      )}
      {quiet && verdict !== null && status === 'done' && (
        <p className="muted" role="status">Запущено. Ответ записан — дальше.</p>
      )}
      {(output || status === 'running') && (
        <pre role="status" aria-label="Вывод программы" style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
          {output || '…'}
        </pre>
      )}
    </div>
  );
}
