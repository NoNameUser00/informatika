import { useCallback, useEffect, useRef, useState } from 'react';

// Доска разборов: рисуй столбики, схемы, блок-схемы — скачай PNG в работу.
// Всё локально в браузере (Excalidraw, MIT), на сервер ничего не уходит.
// Импорт динамический: Excalidraw не переживает SSR, только клиент.
export default function Board({ id, height = 480 }: { id: string; height?: number }) {
  const [mod, setMod] = useState<any>(null);
  const apiRef = useRef<any>(null);
  const [scene, setScene] = useState<{ elements: readonly any[]; appState: any; files: any }>({
    elements: [],
    appState: {},
    files: {},
  });
  const [status, setStatus] = useState('');

  // Стабильная ссылка обязательна: новый onChange каждый рендер зацикливает Excalidraw.
  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    setScene({ elements, appState, files });
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      const m = await import('@excalidraw/excalidraw');
      await import('@excalidraw/excalidraw/index.css');
      if (!dead) setMod(m);
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Пересчёт координат Excalidraw (курсор/указка): после монтирования
  // и при ресайзе окна. Скролл и ресайз контейнера библиотека ловит сама.
  useEffect(() => {
    if (!mod) return;
    const refresh = () => {
      try {
        apiRef.current?.refresh?.();
      } catch { /* доска ещё не готова */ }
    };
    const raf = requestAnimationFrame(() => setTimeout(refresh, 50));
    window.addEventListener('resize', refresh);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', refresh);
    };
  }, [mod]);

  async function savePng() {
    setStatus('');
    try {
      if (scene.elements.length === 0) {
        setStatus('Доска пустая — нарисуй что-нибудь.');
        return;
      }
      const blob = await mod.exportToBlob({
        elements: scene.elements as any,
        appState: { ...scene.appState, exportBackground: true },
        files: scene.files,
        mimeType: 'image/png',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStatus('Сохранено в загрузки.');
    } catch {
      setStatus('Не вышло — попробуй ещё раз.');
    }
  }

  if (!mod) return <div className="card">Гружу доску…</div>;
  const { Excalidraw } = mod;

  return (
    <div>
      <div style={{ height, border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden' }}>
        <Excalidraw
          langCode="ru-RU"
          onChange={handleChange}
          excalidrawAPI={(api: any) => {
            apiRef.current = api;
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn secondary" style={{ width: 'auto' }} onClick={savePng}>
          Скачать PNG
        </button>
        {status && <span className="muted">{status}</span>}
      </div>
    </div>
  );
}
