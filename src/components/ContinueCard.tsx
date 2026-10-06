// Карточка «Вы останавливались»: читает localStorage, рендерит ссылку-продолжение.
// Ничего не рендерит, если истории нет (первый визит).
import { useEffect, useState } from 'react';
import { progressStore } from '../lib/progress/store.mjs';

export default function ContinueCard() {
  const [last, setLast] = useState<null | { title: string; href: string }>(null);
  useEffect(() => {
    setLast(progressStore.read());
  }, []);
  if (!last) return null;
  return (
    <a className="home-continue" href={last.href}>
      <span aria-hidden="true">⏸</span>
      <span>
        Вы останавливались: <strong>{last.title}</strong>
      </span>
      <span className="home-continue-go">Продолжить →</span>
    </a>
  );
}
