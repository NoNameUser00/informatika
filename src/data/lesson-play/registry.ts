// Реестр уроков с полными 45-минутными сценариями (плеер LessonPlay).
import { NUMSYS_01_PLAY } from './numsys-01-intro';
import { NUMSYS_02_PLAY } from './numsys-02-binary';
import { NUMSYS_03_PLAY } from './numsys-03-octal';
import { NUMSYS_04_PLAY } from './numsys-04-hex';
import { NUMSYS_05_PLAY } from './numsys-05-arith';
import { NUMSYS_06_PLAY } from './numsys-06-review';

export type PlayStep =
  | { kind: 'theory'; title: string; body: string[]; mono?: string[] }
  | { kind: 'key'; title: string; body: string[]; writeDown: string; mono?: string[] }
  | { kind: 'example'; title: string; intro: string; lines: string[]; mono?: string[] }
  | {
      kind: 'task';
      title: string;
      taskKind: 'numeric' | 'choice';
      prompt: string;
      expected?: number;
      base?: number;
      options?: { id: string; text: string }[];
      correct?: string;
      hint: string;
    };

export interface PlayLesson {
  id: string;
  no: number;
  title: string;
  minutes: number;
  steps: PlayStep[];
}

const REGISTRY: Record<string, PlayLesson> = {
  'numsys-01-intro': NUMSYS_01_PLAY,
  'numsys-02-binary': NUMSYS_02_PLAY,
  'numsys-03-octal': NUMSYS_03_PLAY,
  'numsys-04-hex': NUMSYS_04_PLAY,
  'numsys-05-arith': NUMSYS_05_PLAY,
  'numsys-06-review': NUMSYS_06_PLAY,
};

export function hasPlay(id: string): boolean {
  return id in REGISTRY;
}

export function getPlay(id: string): PlayLesson {
  const lesson = REGISTRY[id];
  if (!lesson) throw new Error(`Нет сценария урока: ${id}`);
  return lesson;
}
