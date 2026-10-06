// Невидимый остров: фиксирует «где остановился» при открытии урока.
import { useEffect } from 'react';
import { progressStore } from '../lib/progress/store.mjs';

export default function RecordVisit({
  grade,
  lesson,
  title,
  href,
}: {
  grade: string;
  lesson: string;
  title: string;
  href: string;
}) {
  useEffect(() => {
    progressStore.record({ grade, lesson, title, href });
  }, [grade, lesson, title, href]);
  return null;
}
