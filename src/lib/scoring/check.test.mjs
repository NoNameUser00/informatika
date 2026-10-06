import { parseInBase, checkNumericBase, checkSingleChoice, checkMatching, percentToMark, normalizeBaseString } from './check.mjs';

let fails = 0;
function eq(name, got, want) {
  const ok = Object.is(got, want);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  if (!ok) fails++;
}

// numeric_base: банк пилота
eq('001: 13 -> 1101_2', parseInBase('1101', 2), 13);
eq('001 spaces/zeros', parseInBase(' 001101 ', 2), 13);
eq('001 prefix 0b', parseInBase('0b1101', 2), 13);
eq('001 suffix _2', parseInBase('1101_2', 2), 13);
eq('002: AF_16', parseInBase('AF', 16), 175);
eq('002 lowercase', parseInBase('af', 16), 175);
eq('002 prefix 0x + suffix', parseInBase('0xAF', 16), 175);
eq('002 cyr АФ', parseInBase('АФ', 16), 175);
eq('003: 101101_2=45', parseInBase('101101', 2), 45);
eq('006: 3A_16 -> 111010_2 = 58', parseInBase('111010', 2), 58);
eq('006 with spaces', parseInBase('11 1010', 2), 58);
eq('007: 10001_2=17', parseInBase('10001', 2), 17);
eq('008: 153_8=107', parseInBase('153', 8), 107);
eq('010: answer 3 in base10', parseInBase('3', 10), 3);
eq('invalid digit', Number.isNaN(parseInBase('12', 2)), true);
eq('empty', Number.isNaN(parseInBase('  ', 2)), true);

eq('checkNumeric ok', checkNumericBase(13, '1101', 2).isCorrect, true);
eq('checkNumeric wrong', checkNumericBase(13, '1111', 2).isCorrect, false);
eq('checkNumeric cyr', checkNumericBase(175, 'аф', 16).isCorrect, true);
eq('subscript base suffix', parseInBase('1101₂', 2), 13);
eq('subscript 10/16', parseInBase('AF₁₆', 16), 175);

eq('single ok', checkSingleChoice('C', 'c').isCorrect, true);
eq('single wrong', checkSingleChoice('C', 'B').isCorrect, false);

const exp = { '10': '1010_2', '16': '10000_2', '8': '1000_2' };
eq('matching full', checkMatching(exp, { '10': '1010_2', '16': '10000_2', '8': '1000_2' }, 3).score, 3);
eq('matching 2/3', checkMatching(exp, { '10': '1010_2', '16': '10000_2', '8': 'X' }, 3).score, 2);
eq('matching 0', checkMatching(exp, {}, 3).score, 0);

eq('mark 5', percentToMark(95), 5);
eq('mark 4', percentToMark(80), 4);
eq('mark 3', percentToMark(50), 3);
eq('mark 2', percentToMark(49.9), 2);

console.log(fails === 0 ? 'ALL OK' : `${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
