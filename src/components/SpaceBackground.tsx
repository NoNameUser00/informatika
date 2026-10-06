// ЕДИНЫЙ фон сайта «варп-полёт»: звёзды летят от центра наружу, планеты
// дрейфуют медленно, чёрные дыры — очень редко. Canvas 2D, без зависимостей.
// Панель управления (пауза + ползунки звёзд/скорости) встроена; настройки
// хранятся в localStorage и общие для всех страниц. prefers-reduced-motion —
// старт на паузе.
import { useEffect, useRef, useState } from 'react';

interface Star {
  angle: number;
  dist: number;
  speed: number;
  size: number;
  tw: number;
  warm: boolean;
}

interface Body {
  kind: 'planet' | 'hole';
  x: number;
  y: number;
  r: number;
  vx: number;
  hue: number;
  ring: boolean;
  rot: number;
}

interface Prefs {
  paused: boolean;
  count: number;
  speed: number;
}

const KEY = 'inf-space-v1';
const MIN_COUNT = 100;
const MAX_COUNT = 600;
const MIN_SPEED = 10;
const MAX_SPEED = 300;
const DEFAULT_SPEED = 100; // = старая 1.0×

function loadPrefs(): Prefs {
  const fallback: Prefs = {
    paused:
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    count: 350,
    speed: DEFAULT_SPEED,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    let speed = typeof v.speed === 'number' ? v.speed : fallback.speed;
    if (speed < MIN_SPEED) speed *= 100; // миграция со старой шкалы 0.2–3
    return {
      paused: typeof v.paused === 'boolean' ? v.paused : fallback.paused,
      count:
        typeof v.count === 'number'
          ? Math.min(MAX_COUNT, Math.max(MIN_COUNT, v.count))
          : fallback.count,
      speed: Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)),
    };
  } catch {
    return fallback;
  }
}

export default function SpaceBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [prefs, setPrefs] = useState<Prefs>(() =>
    typeof window === 'undefined' ? { paused: false, count: 350, speed: DEFAULT_SPEED } : loadPrefs(),
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const patch = (p: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const makeStar = (): Star => ({
      angle: rnd(0, Math.PI * 2),
      dist: Math.random(),
      speed: rnd(0.5, 1.4),
      size: rnd(0.6, 2.2),
      tw: rnd(0, Math.PI * 2),
      warm: Math.random() < 0.18,
    });
    let stars: Star[] = [];
    const syncStars = () => {
      const want = Math.round(prefsRef.current.count);
      while (stars.length < want) stars.push(makeStar());
      if (stars.length > want) stars = stars.slice(0, want);
    };
    syncStars();

    const bodies: Body[] = [
      { kind: 'planet', x: 0.85, y: 0.1, r: 46, vx: -0.002, hue: 20, ring: true, rot: 0.5 },
    ];
    let nextPlanet = 20000;
    let nextHole = 70000;
    let last = performance.now();

    const spawnBody = (kind: 'planet' | 'hole') => {
      bodies.push({
        kind,
        x: rnd(0.05, 0.95),
        y: -0.15,
        r: kind === 'planet' ? rnd(18, 60) : rnd(26, 44),
        vx: rnd(-0.003, 0.003),
        hue: [210, 20, 150, 35, 280][Math.floor(Math.random() * 5)],
        ring: kind === 'planet' && Math.random() < 0.5,
        rot: rnd(0, Math.PI * 2),
      });
    };

    const drawPlanet = (b: Body, t: number) => {
      const x = b.x * w;
      const y = b.y * h;
      const g = ctx.createRadialGradient(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.1, x, y, b.r);
      g.addColorStop(0, `hsl(${b.hue} 80% 72%)`);
      g.addColorStop(0.55, `hsl(${b.hue} 60% 42%)`);
      g.addColorStop(1, `hsl(${b.hue} 70% 16%)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(2,6,23,.45)';
      ctx.beginPath();
      ctx.arc(x + b.r * 0.28, y + b.r * 0.3, b.r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      if (b.ring) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.4 + Math.sin(t / 5000 + b.rot) * 0.05);
        ctx.strokeStyle = 'rgba(226,232,240,.55)';
        ctx.lineWidth = Math.max(2, b.r * 0.09);
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 1.7, b.r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawHole = (b: Body, t: number) => {
      const x = b.x * w;
      const y = b.y * h;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.5 + Math.sin(t / 7000 + b.rot) * 0.08);
      const disc = ctx.createRadialGradient(0, 0, b.r * 0.7, 0, 0, b.r * 1.9);
      disc.addColorStop(0, 'rgba(249,115,22,.0)');
      disc.addColorStop(0.45, 'rgba(249,115,22,.85)');
      disc.addColorStop(0.62, 'rgba(168,85,247,.5)');
      disc.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 1.9, b.r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, b.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(186,230,253,.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, b.r * 0.78, 0, Math.PI * 2);
      ctx.stroke();
    };

    const paint = (t: number, speedRaw: number) => {
      const k = speedRaw / 100; // 0.1…3, дефолт 1
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#01030a');
      bg.addColorStop(0.55, '#050a20');
      bg.addColorStop(1, '#0a1330');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.42;
      const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
      // Хвост растёт со скоростью нелинейно: на первых делениях почти
      // точки, на максимуме — до ~четверти радиуса, но не на весь экран.
      const trailK = Math.pow(k, 1.4);
      const glow = 0.55 + Math.min(0.45, k * 0.15);

      for (const b of bodies) (b.kind === 'planet' ? drawPlanet : drawHole)(b, t);

      for (const s of stars) {
        const r = s.dist * maxR;
        const px = cx + Math.cos(s.angle) * r;
        const py = cy + Math.sin(s.angle) * r;
        const back = Math.min(0.96, s.dist - (0.003 + s.dist * 0.035) * s.speed * trailK);
        const br = back * maxR;
        const qx = cx + Math.cos(s.angle) * br;
        const qy = cy + Math.sin(s.angle) * br;
        const a = Math.min(1, (0.25 + s.dist * 0.75 * (0.72 + 0.28 * Math.sin(t / 800 + s.tw))) * glow);
        ctx.strokeStyle = s.warm
          ? `rgba(253,230,200,${a.toFixed(3)})`
          : `rgba(226,232,240,${a.toFixed(3)})`;
        ctx.lineWidth = s.size * (0.5 + s.dist);
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(px, py);
        ctx.stroke();
        if (s.dist > 0.55) {
          ctx.fillStyle = s.warm ? '#fde68a' : '#fff';
          ctx.globalAlpha = Math.min(1, a + 0.15);
          ctx.beginPath();
          ctx.arc(px, py, s.size * 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const p = prefsRef.current;
      if (p.paused) {
        last = now;
        return;
      }
      const dt = Math.min(80, now - last);
      last = now;
      const t = now;
      const fall = dt / 1000;
      syncStars();

      nextPlanet -= dt;
      nextHole -= dt;
      if (nextPlanet <= 0) {
        if (bodies.length < 3) spawnBody('planet');
        nextPlanet = rnd(20000, 35000);
      }
      if (nextHole <= 0) {
        if (!bodies.some((b) => b.kind === 'hole') && bodies.length < 3) spawnBody('hole');
        nextHole = rnd(70000, 110000);
      }

      for (const b of bodies) {
        b.y += fall * (b.kind === 'hole' ? 0.006 : 0.01);
        b.x += b.vx * fall;
      }
      for (let i = bodies.length - 1; i >= 0; i--) {
        if (bodies[i].y > 1.3) bodies.splice(i, 1);
      }

      for (const s of stars) {
        s.dist += 0.055 * s.speed * (0.25 + s.dist * 1.6) * fall * (p.speed / 100);
        if (s.dist > 1) Object.assign(s, makeStar(), { dist: rnd(0, 0.08) });
      }

      paint(t, p.speed);
    };

    paint(performance.now(), prefsRef.current.speed);
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas className="space-canvas" ref={ref} aria-hidden="true" />
      <div className="space-panel" role="group" aria-label="Управление фоном">
        <button
          type="button"
          className="space-pause"
          onClick={() => patch({ paused: !prefs.paused })}
          aria-pressed={prefs.paused}
          aria-label={prefs.paused ? 'Запустить анимацию фона' : 'Остановить анимацию фона'}
        >
          {prefs.paused ? '▶ Старт' : '⏸ Пауза'}
        </button>
        <label className="space-slider">
          <span>Звёзды · {Math.round(prefs.count)}</span>
          <input
            type="range"
            min={MIN_COUNT}
            max={MAX_COUNT}
            step={10}
            value={Math.round(prefs.count)}
            onChange={(e) => patch({ count: Number(e.target.value) })}
            aria-label="Количество звёзд"
          />
        </label>
        <label className="space-slider">
          <span>Скорость · {Math.round(prefs.speed)}</span>
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={10}
            value={Math.round(prefs.speed)}
            onChange={(e) => patch({ speed: Number(e.target.value) })}
            aria-label="Скорость полёта"
          />
        </label>
      </div>
    </>
  );
}
