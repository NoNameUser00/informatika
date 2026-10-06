import { applyDrop, parseDragId } from './drop.mjs';

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

eq('parse chip', parseDragId('chip:1010₂'), { kind: 'chip', value: '1010₂' });
eq('parse slot', parseDragId('slot:10'), { kind: 'slot', key: '10' });
eq('parse drop', parseDragId('drop:16'), { kind: 'drop', key: '16' });
eq('parse pool', parseDragId('pool:x'), { kind: 'pool' });
eq('parse junk', parseDragId('nope'), null);
eq('parse empty', parseDragId('chip:'), null);

eq('assign new', applyDrop({}, 'chip:1010₂', 'drop:10'), { 10: '1010₂' });
eq('assign clears elsewhere', applyDrop({ 16: '1010₂' }, 'chip:1010₂', 'drop:10'), { 10: '1010₂' });
eq('move slot to slot', applyDrop({ 8: '1000₂' }, 'slot:8', 'drop:10'), { 10: '1000₂' });
eq('move clears source', applyDrop({ 8: '1000₂', 10: '1010₂' }, 'slot:8', 'drop:16'), { 10: '1010₂', 16: '1000₂' });
eq('reassign same slot', applyDrop({ 10: '1010₂' }, 'chip:1010₂', 'drop:10'), { 10: '1010₂' });
eq('unassign to pool', applyDrop({ 10: '1010₂' }, 'slot:10', 'pool:x'), {});
eq('chip to pool noop', applyDrop({ 10: '1010₂' }, 'chip:1000₂', 'pool:x'), { 10: '1010₂' });

const same = { 10: '1010₂' };
eq('drop outside keeps ref', applyDrop(same, 'chip:1000₂', null) === same, true);
eq('unknown ids keep ref', applyDrop(same, 'junk', 'drop:10') === same, true);
eq('move missing key keeps ref', applyDrop(same, 'slot:99', 'drop:10') === same, true);
