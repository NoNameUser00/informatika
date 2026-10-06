// PROTOTYPE (throwaway): три варианта главной, переключаются через ?variant=a|b|c.
// Вопрос: «как выглядит главная по design-brief?» A=Khan, B=карточки, C=золотой путь.
import PrototypeSwitcher, { useVariant } from './PrototypeSwitcher';
import { GRADES, PATH_8 } from './demo-data';

const VARIANTS = [
  { key: 'a', name: 'Khan — строгая навигация' },
  { key: 'b', name: 'Карточки — крупные плитки' },
  { key: 'c', name: 'Duolingo — золотой путь' },
];

export default function HomePrototype({ base }: { base: string }) {
  const [v, go] = useVariant(VARIANTS.map((x) => x.key));
  return (
    <>
      {v === 'a' && <HomeA base={base} />}
      {v === 'b' && <HomeB base={base} />}
      {v === 'c' && <HomeC base={base} />}
      <PrototypeSwitcher variants={VARIANTS} current={v} onChange={go} />
    </>
  );
}

/* A — Khan: тёмно-синий, цвет класса = навигация, один смысл на страницу. */
function HomeA({ base }: { base: string }) {
  const current = PATH_8.find((n) => n.state === 'current')!;
  const doneCount = PATH_8.filter((n) => n.state === 'done').length;
  return (
    <div className="ha">
      <header className="ha-top">
        <span className="ha-logo">Информатика</span>
        <nav>
          <a href={`${base}8/`}>8 класс</a>
          <a href={`${base}teacher/`}>Учителю</a>
        </nav>
      </header>
      <section className="ha-hero">
        <p className="ha-kicker">8 класс · Системы счисления</p>
        <h1>Продолжи с урока 3</h1>
        <p className="ha-sub">
          Пройдено {doneCount} из {PATH_8.length} шагов · дальше — восьмеричная система и триады
        </p>
        <a className="ha-cta" href={`${base}8/`}>
          {current.title} →
        </a>
      </section>
      <main className="ha-main">
        <h2>Класс → тема → урок</h2>
        {GRADES.map((g) => (
          <a
            key={g.n}
            className="ha-row"
            href={`${base}${g.n}/`}
            style={{ borderLeftColor: g.color }}
          >
            <span className="ha-grade" style={{ background: g.color }}>
              {g.n}
            </span>
            <span className="ha-rowbody">
              <strong>{g.n} класс</strong>
              <small>{g.topics}</small>
            </span>
            <span className="ha-status">{g.status}</span>
          </a>
        ))}
      </main>
    </div>
  );
}

/* B — Яндекс.Учебник: светлая, крупные плитки с эмодзи, минимум текста. */
function HomeB({ base }: { base: string }) {
  return (
    <div className="hb">
      <section className="hb-hero">
        <div className="hb-mascot" aria-hidden="true">
          💻
        </div>
        <div>
          <h1>Информатика — это интересно!</h1>
          <p>Выбери свой класс и начни играть и учиться</p>
          <a className="hb-cta" href={`${base}8/`}>
            Начать учиться
          </a>
        </div>
      </section>
      <main className="hb-grid">
        {GRADES.map((g) => (
          <a
            key={g.n}
            className={'hb-tile' + (g.n === '8' ? ' hot' : '')}
            href={`${base}${g.n}/`}
            style={{ ['--tile' as string]: g.color }}
          >
            <span className="hb-emoji" aria-hidden="true">
              {g.emoji}
            </span>
            <strong>{g.n} класс</strong>
            <small>{g.status}</small>
          </a>
        ))}
      </main>
      <p className="hb-note">8 класс · Системы счисления · Логика · 60 заданий в тренажёре</p>
    </div>
  );
}

/* C — Duolingo: золотой путь 8 класса, streak, один CTA «Продолжить». */
function HomeC({ base }: { base: string }) {
  const current = PATH_8.find((n) => n.state === 'current')!;
  return (
    <div className="hc">
      <header className="hc-streak">
        <span title="Серия дней">🔥 5</span>
        <span title="Монеты">💎 120</span>
        <span className="hc-class">8 класс</span>
      </header>
      <main className="hc-path">
        {PATH_8.map((n) => (
          <div key={n.id} className={`hc-node ${n.state}`}>
            <span className="hc-dot" aria-hidden="true">
              {n.state === 'done' ? '★' : n.state === 'current' ? '▶' : '🔒'}
            </span>
            <span className="hc-title">{n.title}</span>
          </div>
        ))}
      </main>
      <footer className="hc-footer">
        <a className="hc-cta" href={`${base}8/`}>
          Продолжить: {current.title} →
        </a>
      </footer>
    </div>
  );
}
