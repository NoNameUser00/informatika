// Реестр уроков с полными 45-минутными сценариями (плеер LessonPlay).
import { NUMSYS_02_PLAY, type PlayLesson } from './numsys-02-binary';

const REGISTRY: Record<string, PlayLesson> = {
  'numsys-02-binary': NUMSYS_02_PLAY,
};

export function hasPlay(id: string): boolean {
  return id in REGISTRY;
}

export function getPlay(id: string): PlayLesson {
  const lesson = REGISTRY[id];
  if (!lesson) throw new Error(`Нет сценария урока: ${id}`);
  return lesson;
}
