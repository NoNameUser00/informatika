import { compareOutput } from './compare.mjs';

let n = 0;
function eq(name, got, want) {
  n++;
  if (got !== want) {
    console.error(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    process.exitCode = 1;
  } else console.log(`ok ${n} ${name}`);
}

eq('exact', compareOutput('0b1101\n', '0b1101'), true);
eq('crlf', compareOutput('0b1101\r\n', '0b1101\n'), true);
eq('trailing spaces', compareOutput('0b1101   \n', '0b1101'), true);
eq('trailing blank lines', compareOutput('0b1101\n\n\n', '0b1101'), true);
eq('inner blank kept', compareOutput('a\n\nb', 'a\nb'), false);
eq('different', compareOutput('0b1100', '0b1101'), false);
eq('empty both', compareOutput('', ''), true);
eq('null actual', compareOutput(null, 'x'), false);
