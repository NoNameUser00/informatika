// Плавающая доска: кнопка-открывашка слева внизу + окно с Board поверх
// контента на ЛЮБОЙ странице. Доска грузится только после открытия.
import { useEffect, useState } from 'react';
import Board from './Board';

export default function BoardFloat() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="board-fab"
          onClick={() => setOpen(true)}
          aria-label="Открыть доску для черновиков"
          title="Доска для черновиков"
        >
          <span aria-hidden="true">🎨</span> <span className="board-fab-label">Доска</span>
        </button>
      )}
      {open && (
        <div className="board-window" role="dialog" aria-label="Доска для черновиков">
          <div className="board-head">
            <strong>Доска-черновик</strong>
            <button
              type="button"
              className="board-close"
              onClick={() => setOpen(false)}
              aria-label="Закрыть доску"
              title="Закрыть (Esc)"
            >
              ✕ Закрыть
            </button>
          </div>
          <div className="board-body">
            <Board id="float-board" height={420} />
          </div>
        </div>
      )}
    </>
  );
}
