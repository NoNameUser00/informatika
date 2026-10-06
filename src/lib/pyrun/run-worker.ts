// Запуск Python в воркере с лимитом времени. Почему не interrupt:
// настоящий interrupt требует SharedArrayBuffer + заголовки COOP/COEP,
// которых GitHub Pages не отдаёт. Поэтому зависший код убиваем таймаутом:
// воркер терминируется (вкладка жива), следующий запуск поднимает свежий.
import { runPython as runMainThread } from './pyodide';

export const RUN_TIMEOUT_MS = 10000;

interface RunResult {
  out: string;
  err: string;
  timedOut: boolean;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: RunResult) => void; timer: ReturnType<typeof setTimeout> }>();

function getWorker(): Worker {
  if (!worker) {
    // Classic-воркер (не module!): только classic умеет importScripts для Pyodide.
    worker = new Worker(new URL('./worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent) => {
      const { id, out, err } = e.data as { id: number; out: string; err: string };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      clearTimeout(p.timer);
      p.resolve({ out, err, timedOut: false });
    };
    worker.onerror = () => {
      // Воркеры запрещены (CSP) — сбрасываем, дальше fallback в главном потоке.
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.resolve({ out: '', err: '__FALLBACK__', timedOut: false });
      }
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

export async function runPythonWorker(code: string, timeoutMs = RUN_TIMEOUT_MS): Promise<RunResult> {
  let w: Worker;
  try {
    w = getWorker();
  } catch {
    const r = await runMainThread(code);
    return { ...r, timedOut: false };
  }
  const id = ++seq;
  const resultPromise = new Promise<RunResult>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      if (worker) {
        worker.terminate();
        worker = null;
      }
      resolve({
        out: '',
        err: `Превышен лимит времени (${Math.round(timeoutMs / 1000)} с) — проверь циклы, дальше вкладка бы зависла.`,
        timedOut: true,
      });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
  });
  w.postMessage({ id, code });
  const result = await resultPromise;
  if (result.err === '__FALLBACK__') {
    const r = await runMainThread(code);
    return { ...r, timedOut: false };
  }
  return result;
}
