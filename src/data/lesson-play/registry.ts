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
import { MEDIA7_01_PLAY } from './7media-01-slides';
import { GFX7_02_PLAY } from './7gfx-02-editors';
import { SOFT7_01_PLAY } from './7soft-01-practice';
import { CODE7_01_PLAY } from './7code-01-sound';
import { SHEET9_01_PLAY } from './9sheet-01-base';
import { SHEET9_02_PLAY } from './9sheet-02-refs';
import { SHEET9_03_PLAY } from './9sheet-03-analysis';
import { ARR9_01_PLAY } from './9arr-01-basics';
import { ARR9_02_PLAY } from './9arr-02-search';
import { GRAPH9_01_PLAY } from './9graph-01-graphs';
import { ROBOT9_01_PLAY } from './9robot-01-control';
import { MODEL9_01_PLAY } from './9model-01-models';
import { NET9_01_PLAY } from './9net-01-internet';
import { HW10_01_PLAY } from './10hw-01-pc';
import { INFO10_01_PLAY } from './10info-01-measure';
import { SS10_01_PLAY } from './10ss-01-systems';
import { LOGIC10_01_PLAY } from './10logic-01-ops';
import { LOGIC10_02_PLAY } from './10logic-02-transform';
import { MEDIA10_01_PLAY } from './10media-01-docs';
import { DATA11_01_PLAY } from './11data-01-analysis';
import { DB11_01_PLAY } from './11db-01-databases';
import { ALGO11_01_PLAY } from './11algo-01-analysis';
import { ALGO11_02_PLAY } from './11algo-02-advanced';
import { NET11_01_PLAY } from './11net-01-networks';
import { SAFE11_01_PLAY } from './11safe-01-security';
import { GRAPH11_01_PLAY } from './11graph-01-graphs';
import { GRAPH11_02_PLAY } from './11graph-02-games';
import { PY_01_PLAY } from './py-01-basics';
import { PY_02_PLAY } from './py-02-branching';
import { PY_03_PLAY } from './py-03-loops';
import { PY_04_PLAY } from './py-04-strings';

export type PlayStep =
  | { kind: 'theory'; title: string; body: string[]; mono?: string[]; tip?: string }
  | { kind: 'key'; title: string; body: string[]; writeDown: string; mono?: string[]; tip?: string }
  | { kind: 'example'; title: string; intro: string; lines: string[]; mono?: string[]; tip?: string }
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
      tip?: string;
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
  '7media-01-slides': MEDIA7_01_PLAY,
  '7gfx-02-editors': GFX7_02_PLAY,
  '7soft-01-practice': SOFT7_01_PLAY,
  '7code-01-sound': CODE7_01_PLAY,
  '9sheet-01-base': SHEET9_01_PLAY,
  '9sheet-02-refs': SHEET9_02_PLAY,
  '9sheet-03-analysis': SHEET9_03_PLAY,
  '9arr-01-basics': ARR9_01_PLAY,
  '9arr-02-search': ARR9_02_PLAY,
  '9graph-01-graphs': GRAPH9_01_PLAY,
  '9robot-01-control': ROBOT9_01_PLAY,
  '9model-01-models': MODEL9_01_PLAY,
  '9net-01-internet': NET9_01_PLAY,
  '10hw-01-pc': HW10_01_PLAY,
  '10info-01-measure': INFO10_01_PLAY,
  '10ss-01-systems': SS10_01_PLAY,
  '10logic-01-ops': LOGIC10_01_PLAY,
  '10logic-02-transform': LOGIC10_02_PLAY,
  '10media-01-docs': MEDIA10_01_PLAY,
  '11data-01-analysis': DATA11_01_PLAY,
  '11db-01-databases': DB11_01_PLAY,
  '11algo-01-analysis': ALGO11_01_PLAY,
  '11algo-02-advanced': ALGO11_02_PLAY,
  '11net-01-networks': NET11_01_PLAY,
  '11safe-01-security': SAFE11_01_PLAY,
  '11graph-01-graphs': GRAPH11_01_PLAY,
  '11graph-02-games': GRAPH11_02_PLAY,
  'py-01-basics': PY_01_PLAY,
  'py-02-branching': PY_02_PLAY,
  'py-03-loops': PY_03_PLAY,
  'py-04-strings': PY_04_PLAY,
};

export function hasPlay(id: string): boolean {
  return id in REGISTRY;
}

export function getPlay(id: string): PlayLesson {
  const lesson = REGISTRY[id];
  if (!lesson) throw new Error(`Нет сценария урока: ${id}`);
  return lesson;
}
