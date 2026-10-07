import { ecoStep } from './eco.mjs';

let n = 0;
function eq(name, got, want) {
  n++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    console.error(`FAIL ${name}: got ${a}, want ${b}`);
    process.exitCode = 1;
  } else console.log(`ok ${n} ${name}`);
}

eq('slow cuts', ecoStep(20, 1) < 1, true);
eq('very slow floors', ecoStep(10, 0.16) >= 0.15, true);
eq('floor holds', ecoStep(10, 0.15), 0.15);
eq('fast recovers', ecoStep(60, 0.7) > 0.7, true);
eq('recovers caps at 1', ecoStep(60, 0.95), 1);
eq('mid holds', ecoStep(40, 0.8), 0.8);
eq('boundary low holds', ecoStep(28, 0.8), 0.8);
eq('boundary high holds', ecoStep(55, 0.8), 0.8);
