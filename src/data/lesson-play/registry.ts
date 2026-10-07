// Реестр уроков с полными 45-минутными сценариями (плеер LessonPlay).
import { NUMSYS_01_PLAY } from './numsys-01-intro';
import { NUMSYS_02_PLAY } from './numsys-02-binary';
import { NUMSYS_03_PLAY } from './numsys-03-octal';
import { NUMSYS_04_PLAY } from './numsys-04-hex';
import { NUMSYS_05_PLAY } from './numsys-05-arith';
import { NUMSYS_06_PLAY } from './numsys-06-review';
import { LOGIC_01_PLAY } from './logic-01-utterances';
import { LOGIC_02_PLAY } from './logic-02-operations';
import { LOGIC_03_PLAY } from './logic-03-truth-tables';
import { LOGIC_04_PLAY } from './logic-04-elements';
import { ALG_01_PLAY } from './alg-01-performers';
import { ALG_02_PLAY } from './alg-02-notation';
import { ALG_03_PLAY } from './alg-03-branching';
import { ALG_04_PLAY } from './alg-04-loops';
import { INF7_01_PLAY } from './7inf-01-info';
import { INF7_02_PLAY } from './7inf-02-coding';
import { INF7_03_PLAY } from './7inf-03-measure';
import { INF7_04_PLAY } from './7inf-04-textvolume';
import { PC7_01_PLAY } from './7pc-01-hardware';
import { PC7_02_PLAY } from './7pc-02-files';
import { DOC7_01_PLAY } from './7doc-01-text';
import { GFX7_01_PLAY } from './7gfx-01-graphics';
import { NET7_01_PLAY } from './7net-01-internet';
import { SHEET9_01_PLAY } from './9sheet-01-base';
import { SHEET9_02_PLAY } from './9sheet-02-refs';
import { SHEET9_03_PLAY } from './9sheet-03-analysis';
import { ARR9_01_PLAY } from './9arr-01-basics';
import { ARR9_02_PLAY } from './9arr-02-search';
import { GRAPH9_01_PLAY } from './9graph-01-graphs';
import { ROBOT9_01_PLAY } from './9robot-01-control';
import { MODEL9_01_PLAY } from './9model-01-models';
import { NET9_01_PLAY } from './9net-01-internet';
import { PY_01_PLAY } from './py-01-basics';
import { PY_02_PLAY } from './py-02-branching';
import { PY_03_PLAY } from './py-03-loops';

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
  /** Баннер в финале: следующий урок — проверочная/контрольная (slug маршрута). */
  nextCheck?: { kind: 'proverka' | 'control'; title: string; slug: string };
}

const REGISTRY: Record<string, PlayLesson> = {
  'numsys-01-intro': NUMSYS_01_PLAY,
  'numsys-02-binary': NUMSYS_02_PLAY,
  'numsys-03-octal': NUMSYS_03_PLAY,
  'numsys-04-hex': NUMSYS_04_PLAY,
  'numsys-05-arith': NUMSYS_05_PLAY,
  'numsys-06-review': NUMSYS_06_PLAY,
  'logic-01-utterances': LOGIC_01_PLAY,
  'logic-02-operations': LOGIC_02_PLAY,
  'logic-03-truth-tables': LOGIC_03_PLAY,
  'logic-04-elements': LOGIC_04_PLAY,
  'alg-01-performers': ALG_01_PLAY,
  'alg-02-notation': ALG_02_PLAY,
  'alg-03-branching': ALG_03_PLAY,
  'alg-04-loops': ALG_04_PLAY,
  '7inf-01-info': INF7_01_PLAY,
  '7inf-02-coding': INF7_02_PLAY,
  '7inf-03-measure': INF7_03_PLAY,
  '7inf-04-textvolume': INF7_04_PLAY,
  '7pc-01-hardware': PC7_01_PLAY,
  '7pc-02-files': PC7_02_PLAY,
  '7doc-01-text': DOC7_01_PLAY,
  '7gfx-01-graphics': GFX7_01_PLAY,
  '7net-01-internet': NET7_01_PLAY,
  '9sheet-01-base': SHEET9_01_PLAY,
  '9sheet-02-refs': SHEET9_02_PLAY,
  '9sheet-03-analysis': SHEET9_03_PLAY,
  '9arr-01-basics': ARR9_01_PLAY,
  '9arr-02-search': ARR9_02_PLAY,
  '9graph-01-graphs': GRAPH9_01_PLAY,
  '9robot-01-control': ROBOT9_01_PLAY,
  '9model-01-models': MODEL9_01_PLAY,
  '9net-01-internet': NET9_01_PLAY,
  'py-01-basics': PY_01_PLAY,
  'py-02-branching': PY_02_PLAY,
  'py-03-loops': PY_03_PLAY,
};

export function hasPlay(id: string): boolean {
  return id in REGISTRY;
}

export function getPlay(id: string): PlayLesson {
  const lesson = REGISTRY[id];
  if (!lesson) throw new Error(`Нет сценария урока: ${id}`);
  return lesson;
}
