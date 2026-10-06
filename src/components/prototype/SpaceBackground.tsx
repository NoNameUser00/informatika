// PROTOTYPE (throwaway): фон «варп-полёт» — звёзды летят от центра наружу (как в референсе,
// но реже и медленнее), планеты дрейфуют медленно, дыры очень редко. Кнопка паузы.
// Уважает prefers-reduced-motion: стартует на паузе.
import { useEffect, useRef, useState } from 'react';

interface Star {
  angle: number;
  dist: number; // 0..1 от центра (1 = край экрана)
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

const STAR_N = 120; // реже, чем в референсе
const WARP = 0.055; // медленно: долей радиуса в секунду

export default function SpaceBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

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
    const stars: Star[] = Array.from({ length: STAR_N }, () => ({
      angle: rnd(0, Math.PI * 2),
      dist: Math.random(),
      speed: rnd(0.5, 1.4),
      size: rnd(0.6, 2.2),
      tw: rnd(0, Math.PI * 2),
      warm: Math.random() < 0.18,
    }));
    let bodies: Body[] = [
      { kind: 'planet', x: 0.85, y: 0.1, r: 46, vx: -0.002, hue: 20, ring: true, rot: 0.5 },
    ];
    let nextPlanet = 20000;
    let nextHole = 70000;
    let last = performance.now();

    const spawnBody = (kind: 'planet' | 'hole') => {
      const r = kind === 'planet' ? rnd(18, 60) : rnd(26, 44);
      bodies.push({
        kind,
        x: rnd(0.05, 0.95),
        y: -0.15,
        r,
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

    const paint = (t: number) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#020617');
      bg.addColorStop(0.55, '#0b1445');
      bg.addColorStop(1, '#101c5e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.42;
      const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));

      for (const b of bodies) (b.kind === 'planet' ? drawPlanet : drawHole)(b, t);

      for (const s of stars) {
        const r = s.dist * maxR;
        const px = cx + Math.cos(s.angle) * r;
        const py = cy + Math.sin(s.angle) * r;
        // шлейф назад к центру, длина растёт со скоростью и расстоянием
        const back = Math.min(0.96, s.dist - (0.012 + s.dist * 0.05) * s.speed);
        const br = back * maxR;
        const qx = cx + Math.cos(s.angle) * br;
        const qy = cy + Math.sin(s.angle) * br;
        const a = 0.25 + s.dist * 0.75 * (0.72 + 0.28 * Math.sin(t / 800 + s.tw));
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
      if (pausedRef.current) {
        last = now;
        return; // стоим: кадр остаётся на canvas
      }
      const dt = Math.min(80, now - last);
      last = now;
      const t = now;
      const fall = dt / 1000;

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

      // планеты — медленно дрейфуют вниз (мы пролетаем мимо не спеша)
      for (const b of bodies) {
        b.y += fall * (b.kind === 'hole' ? 0.006 : 0.01);
        b.x += b.vx * fall;
      }
      bodies = bodies.filter((b) => b.y < 1.3);

      // варп: звёзды ускоряются от центра наружу
      for (const s of stars) {
        s.dist += WARP * s.speed * (0.25 + s.dist * 1.6) * fall;
        if (s.dist > 1) {
          s.dist = rnd(0, 0.08);
          s.angle = rnd(0, Math.PI * 2);
          s.speed = rnd(0.5, 1.4);
        }
      }

      paint(t);
    };

    paint(performance.now());
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="px-space" aria-hidden="true" />
      <PauseButton paused={paused} onToggle={() => setPaused(!paused)} />
    </>
  );
}

function PauseButton({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="px-pause"
      onClick={onToggle}
      aria-pressed={paused}
      aria-label={paused ? 'Запустить анимацию фона' : 'Остановить анимацию фона'}
      title={paused ? 'Запустить фон' : 'Остановить фон'}
    >
      {paused ? '▶ Полёт' : '⏸ Пауза'}
    </button>
  );
}
