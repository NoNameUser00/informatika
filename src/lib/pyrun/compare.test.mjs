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

// целое против дробной записи — тот же ответ по значению
eq('5.0 против 5', compareOutput('5.0 4', '5 4'), true);
eq('5 против 5.0', compareOutput('5', '5.0'), true);
eq('4.00 против 4', compareOutput('4.00', '4'), true);
eq('0.9 против 0.90', compareOutput('0.9', '0.90'), true);
eq('минус ноль', compareOutput('-0.0', '0'), true);

// разные числа — по-прежнему разные
eq('5 против 6', compareOutput('5.0', '6'), false);
eq('4.5 против 4', compareOutput('4.5', '4'), false);

// нечисловые токи не выравниваются
eq('0b1101 против 1101 — разные', compareOutput('0b1101', '1101'), false);
eq('слова разные', compareOutput('мало', 'много'), false);

// структура вывода остаётся значимой
eq('перестановка токенов', compareOutput('4 5.0', '5 4'), false);
eq('разное число токенов', compareOutput('5 4', '5'), false);
eq('пустой токен не пропускаем', compareOutput('5  4', '5 4'), true);
eq('число против пустой строки', compareOutput('5\n', '\n5'), false);
