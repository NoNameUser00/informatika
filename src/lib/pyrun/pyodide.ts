// Общий загрузчик Pyodide (CDN, немодифицированный, MPL-2.0) для PyRunner/BlocklyRunner.
// Выполняется только в браузере; импортировать можно откуда угодно, грузится лениво.

const PYODIDE_JS = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/';

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<any>;
  }
}

let pyPromise: Promise<any> | null = null;

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-pyodide="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.pyodide = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Не загрузился Pyodide с CDN. Проверь интернет.'));
    document.head.appendChild(s);
  });
}

export function ensurePyodide(): Promise<any> {
  if (!pyPromise) {
    pyPromise = (async () => {
      await loadScriptOnce(PYODIDE_JS);
      if (!window.loadPyodide) throw new Error('CDN вернул не то: нет loadPyodide.');
      return window.loadPyodide({ indexURL: PYODIDE_BASE });
    })();
  }
  return pyPromise;
}

export async function runPython(code: string): Promise<{ out: string; err: string }> {
  const py = await ensurePyodide();
  let out = '';
  let err = '';
  py.setStdout({ batched: (s: string) => { out += s + '\n'; } });
  py.setStderr({ batched: (s: string) => { err += s + '\n'; } });
  await py.runPythonAsync(code);
  return { out, err };
}
