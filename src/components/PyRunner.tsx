import { useRef, useState } from 'react';
import { compareOutput } from '../lib/pyrun/compare.mjs';
import { runPython } from '../lib/pyrun/pyodide';

// PyRunner: код ученика выполняется В БРАУЗЕРЕ (Pyodide/WASM) — это и есть песочница:
// нет доступа к DOM/cookie/сети кроме fetch браузера, нет сервера для проверки.
// Pyodide грузится лениво с CDN по первой кнопке, немодифицированным (MPL-2.0).
// Ограничение v1: выполнение в главном потоке — бесконечный цикл заморозит вкладку.
// В прод-код не пускать без воркера + interrupt; только тренажер/практика, не контрольная.

export default function PyRunner({
  id,
  initialCode,
  expectedOutput,
}: {
  id: string;
  initialCode: string;
  expectedOutput?: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'running' | 'error'>('idle');
  const [output, setOutput] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const runId = useRef(0);

  async function run() {
    const my = ++runId.current;
    setStatus('loading');
    setOutput('');
    setVerdict(null);
    try {
      setStatus('running');
      const { out, err } = await runPython(code);
      if (my !== runId.current) return;
      if (err) {
        setStatus('error');
        setOutput(err);
      } else {
        setStatus('ready');
        setOutput(out);
        if (expectedOutput !== undefined) setVerdict(compareOutput(out, expectedOutput));
      }
    } catch (e: any) {
      if (my !== runId.current) return;
      setStatus('error');
      setOutput(String(e?.message ?? e));
    }
  }

  return (
    <div className="card">
      <label htmlFor={`${id}-code`}>Код Python (выполняется в твоём браузере, на сервер не уходит)</label>
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
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn" style={{ width: 'auto' }} onClick={run} disabled={status === 'loading' || status === 'running'}>
          {status === 'loading' ? 'Гружу Python…' : status === 'running' ? 'Выполняется…' : 'Запустить'}
        </button>
        {status === 'error' && <span className="bad">Ошибка — читай вывод ниже.</span>}
        {verdict === true && <span className="ok">Вывод совпал с ожидаемым.</span>}
        {verdict === false && <span className="bad">Вывод не совпал — сравни с ожидаемым.</span>}
      </div>
      {(output || status === 'running') && (
        <pre role="status" aria-label="Вывод программы" style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto', marginTop: 8 }}>
          {output || '…'}
        </pre>
      )}
      <p className="muted">Pyodide (MPL-2.0) с CDN, без изменений. Первая загрузка ~10 МБ, дальше из кэша.</p>
    </div>
  );
}
