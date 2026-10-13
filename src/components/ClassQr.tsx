// QR-код класса: сканируешь — попадаешь на главную с подставленным кодом.
// node-qrcode, только клиент (dynamic import, чтобы не тянуть в главный бандл).
import { useEffect, useState } from 'react';

export default function ClassQr({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || src) return;
    let alive = true;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = `${window.location.origin}${import.meta.env.BASE_URL}?class=${encodeURIComponent(code)}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 });
        if (alive) setSrc(dataUrl);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'не вышло построить QR');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, src, code]);

  return (
    <span>
      {' '}
      <button type="button" className="btn secondary" onClick={() => setOpen(!open)}>
        {open ? 'Скрыть QR' : 'QR-код класса'}
      </button>
      {open && (
        <span>
          {src ? (
            <img src={src} width={220} height={220} alt={`QR-код вступления в класс, код ${code}`} />
          ) : (
            <span className="muted">{error || 'Строю…'}</span>
          )}
        </span>
      )}
    </span>
  );
}
