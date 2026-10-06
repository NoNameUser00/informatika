// PROTOTYPE (throwaway): анимированный фон «полёт в космосе».
// Звёзды (много), планеты (редко), чёрные дыры (очень редко). Canvas 2D, без зависимостей.
// Уважает prefers-reduced-motion: рисует один статичный кадр.
import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number; // глубина 0..1: размер, скорость, яркость
  tw: number; // фаза мерцания
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

const STAR_N = 220;

export default function SpaceBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * Math.random(), // больше далёких мелких
      tw: rnd(0, Math.PI * 2),
    }));
    let bodies: Body[] = [
      // Одна планета видна сразу (демо), остальные — редко по таймеру.
      { kind: 'planet', x: 0.85, y: 0.1, r: 46, vx: -0.002, hue: 20, ring: true, rot: 0.5 },
    ];
    // Первый кадр: пара далёких звёздных скоплений уже в кадре — пара планет сразу.
    let nextPlanet = 4000;
    let nextHole = 25000;
    let last = performance.now();

    const spawnBody = (kind: 'planet' | 'hole') => {
      const r = kind === 'planet' ? rnd(18, 60) : rnd(26, 44);
      bodies.push({
        kind,
        x: rnd(0, 1),
        y: -0.15,
        r,
        vx: rnd(-0.004, 0.004),
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
      // тень терминатора справа снизу
      ctx.fillStyle = 'rgba(2,6,23,.45)';
      ctx.beginPath();
      ctx.arc(x + b.r * 0.28, y + b.r * 0.3, b.r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      if (b.ring) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.4 + Math.sin(t / 4000 + b.rot) * 0.05);
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
      // аккреционный диск
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.5 + Math.sin(t / 6000 + b.rot) * 0.08);
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
      // тень + тонкое фотонное кольцо
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

    const frame = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      const t = now;

      // глубокий градиент космоса
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#020617');
      bg.addColorStop(0.55, '#0b1445');
      bg.addColorStop(1, '#101c5e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // редкие тела: планеты ~раз в 18–30 c, дыры ~раз в 60–100 c
      nextPlanet -= dt;
      nextHole -= dt;
      if (nextPlanet <= 0) {
        if (bodies.length < 3) spawnBody('planet');
        nextPlanet = rnd(18000, 30000);
      }
      if (nextHole <= 0) {
        if (!bodies.some((b) => b.kind === 'hole') && bodies.length < 3) spawnBody('hole');
        nextHole = rnd(60000, 100000);
      }

      // тела дрейфуют вниз (пролетаем мимо), чуть вбок
      const fall = dt / 1000;
      for (const b of bodies) {
        b.y += fall * (b.kind === 'hole' ? 0.012 : 0.02);
        b.x += b.vx * fall;
      }
      bodies = bodies.filter((b) => b.y < 1.3);
      for (const b of bodies) (b.kind === 'planet' ? drawPlanet : drawHole)(b, t);

      // звёзды: медленный снос по диагонали + мерцание, короткие шлейфы
      const dx = 0.02; // общий снос вправо (полёт под углом)
      const dy = 0.045;
      for (const s of stars) {
        const sp = 0.25 + s.z * 1.6;
        s.x += dx * sp * fall;
        s.y += dy * sp * fall;
        if (s.y > 1.02) {
          s.y = -0.02;
          s.x = Math.random() * 1.1 - 0.05;
        }
        if (s.x > 1.02) s.x = -0.02;
        const px = s.x * w;
        const py = s.y * h;
        const a = 0.2 + s.z * 0.8 * (0.7 + 0.3 * Math.sin(t / 700 + s.tw));
        const trail = 2 + s.z * 9; // короткий шлейф, а не «дождь»
        if (s.z > 0.4) {
          ctx.strokeStyle = `rgba(226,232,240,${(a * 0.45).toFixed(3)})`;
          ctx.lineWidth = 0.6 + s.z * 1.2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - (dx * 300 * sp * trail) / 8, py - (dy * 300 * sp * trail) / 8);
          ctx.stroke();
        }
        if (s.z > 0.72) {
          // яркие — с крестом блика
          ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
          const r = 0.8 + s.z * 1.6;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      frame(last + 16);
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="px-space" aria-hidden="true" />;
}
