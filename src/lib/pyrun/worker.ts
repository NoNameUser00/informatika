// Воркер Python (Pyodide/WASM): выполнение кода ученика ВНЕ главного потока —
// вкладка не виснет даже на бесконечном цикле (его добьёт таймаут снаружи).
// Без импортов: Pyodide подтягивается importScripts с CDN в рантайме.
// Протокол: { id, code } -> { id, ok, out, err }.
declare function importScripts(...urls: string[]): void;

const workerSelf = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
};

const PYODIDE_JS = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/';

let py: any = null;

async function ensure(): Promise<any> {
  if (!py) {
    importScripts(PYODIDE_JS);
    const g = globalThis as Record<string, unknown>;
    if (typeof g['loadPyodide'] !== 'function') throw new Error('CDN вернул не то: нет loadPyodide.');
    py = await (g['loadPyodide'] as (opts: { indexURL: string }) => Promise<unknown>)({
      indexURL: PYODIDE_BASE,
    });
  }
  return py;
}

workerSelf.onmessage = async (e: MessageEvent) => {
  const { id, code } = e.data as { id: number; code: string };
  try {
    const p = await ensure();
    let out = '';
    let err = '';
    p.setStdout({ batched: (s: string) => { out += s + '\n'; } });
    p.setStderr({ batched: (s: string) => { err += s + '\n'; } });
    await p.runPythonAsync(code);
    workerSelf.postMessage({ id, ok: true, out, err });
  } catch (ex) {
    const msg = ex instanceof Error ? ex.message : String(ex);
    workerSelf.postMessage({ id, ok: false, out: '', err: msg });
  }
};
