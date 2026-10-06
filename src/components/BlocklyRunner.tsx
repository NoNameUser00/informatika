import { useEffect, useRef, useState } from 'react';
import { compareOutput } from '../lib/pyrun/compare.mjs';
import { runPythonWorker } from '../lib/pyrun/run-worker';

// BlocklyRunner: программу собирают из блоков, Python генерируется и выполняется
// в браузере (Pyodide/WASM в воркере — песочница, зависший код убивает таймаут).
// Импорты Blockly динамические: только клиент.
const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Числа', contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
      ],
    },
    {
      kind: 'category', name: 'Текст', contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_join' },
      ],
    },
    {
      kind: 'category', name: 'Логика', contents: [
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category', name: 'Циклы', contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
      ],
    },
    {
      kind: 'category', name: 'Условия', contents: [
        { kind: 'block', type: 'controls_if' },
      ],
    },
    { kind: 'category', name: 'Переменные', custom: 'VARIABLE' },
  ],
};

export default function BlocklyRunner({
  id,
  initialXml,
  expectedOutput,
}: {
  id: string;
  initialXml?: string;
  expectedOutput?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'running' | 'error'>('idle');
  const [output, setOutput] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const runId = useRef(0);

  useEffect(() => {
    let dead = false;
    (async () => {
      const Blockly = await import('blockly');
      await import('blockly/blocks');
      try {
        const Ru = (await import('blockly/msg/ru')).default;
        Blockly.setLocale(Ru);
      } catch { /* нет локали — останется английский хром */ }
      if (dead || !divRef.current) return;
      const ws = Blockly.inject(divRef.current, { toolbox: TOOLBOX as any });
      if (initialXml) {
        try {
          Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(initialXml), ws);
        } catch { /* битый стартовый XML — пустое поле */ }
      }
      wsRef.current = ws;
    })();
    return () => {
      dead = true;
      wsRef.current?.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    const my = ++runId.current;
    setStatus('loading');
    setOutput('');
    setVerdict(null);
    try {
      const { pythonGenerator } = await import('blockly/python');
      const ws = wsRef.current;
      if (!ws) throw new Error('Поле блоков ещё не готово.');
      const src: string = pythonGenerator.workspaceToCode(ws);
      if (my !== runId.current) return;
      if (!src.trim()) throw new Error('Пусто: собери программу из блоков слева.');
      setCode(src);
      setStatus('running');
      const { out, err } = await runPythonWorker(src);
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
      <p><strong>Собери программу из блоков</strong> — Python соберётся сам и выполнится в твоём браузере.</p>
      <div ref={divRef} id={`${id}-blocks`} aria-label="Поле блоков" style={{ height: 360, width: '100%' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn" style={{ width: 'auto' }} onClick={run} disabled={status === 'loading' || status === 'running'}>
          {status === 'loading' ? 'Гружу…' : status === 'running' ? 'Выполняется…' : 'Собрать и запустить'}
        </button>
        {status === 'error' && <span className="bad">Ошибка — читай вывод ниже.</span>}
        {verdict === true && <span className="ok">Вывод совпал с ожидаемым.</span>}
        {verdict === false && <span className="bad">Вывод не совпал — сравни с ожидаемым.</span>}
      </div>
      {code && (
        <pre aria-label="Собранный Python" style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto', marginTop: 8 }}>{code}</pre>
      )}
      {(output || status === 'running') && (
        <pre role="status" aria-label="Вывод программы" style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto', marginTop: 8 }}>
          {output || '…'}
        </pre>
      )}
      <p className="muted">Blockly (Apache-2.0) + Pyodide (MPL-2.0) с CDN, без изменений.</p>
    </div>
  );
}
