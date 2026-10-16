# Ведомость ключей single_choice

Из 528 заданий 70 проверяются машиной, 458 ждут человека.
Ниже — по банкам. В каждом файле задание со всеми вариантами и текущим ключом.

| Файл | Заданий | Из них без свидетельства |
| --- | ---: | ---: |

## Уже проверено и применено

| Файл | Заданий | Статус |
| --- | ---: | --- |
| [done/07-base.md](done/07-base.md) | 80 | применён |
| [done/07-information.md](done/07-information.md) | 21 | применён |
| [done/07-media.md](done/07-media.md) | 43 | применён |
| [done/08-algorithms.md](done/08-algorithms.md) | 26 | применён |
| [done/08-logic.md](done/08-logic.md) | 29 | применён |
| [done/08-number-systems-bank.md](done/08-number-systems-bank.md) | 2 | применён |
| [done/08-number-systems-gen.md](done/08-number-systems-gen.md) | 11 | применён |
| [done/09-arrays.md](done/09-arrays.md) | 7 | применён |
| [done/09-extra.md](done/09-extra.md) | 49 | применён |
| [done/09-graphs.md](done/09-graphs.md) | 7 | применён |
| [done/09-spreadsheets.md](done/09-spreadsheets.md) | 25 | применён |
| [done/10-base.md](done/10-base.md) | 43 | применён |
| [done/10-logic.md](done/10-logic.md) | 25 | применён |
| [done/10-media.md](done/10-media.md) | 42 | применён |
| [done/10-ss.md](done/10-ss.md) | 15 | применён |
| [done/11-algo.md](done/11-algo.md) | 15 | применён |
| [done/11-data.md](done/11-data.md) | 24 | применён |
| [done/11-db.md](done/11-db.md) | 9 | применён |
| [done/11-graph.md](done/11-graph.md) | 12 | применён |
| [done/11-net.md](done/11-net.md) | 43 | применён |


## Порядок работы

1. Открыть файл, пройти задания сверху вниз, вписать вердикт.
2. Раз в раздел (или реже) запустить `node scripts/apply-key-review.mjs` —
   он применит ответы и покажет, что осталось непроверенным.
3. После применения прогнать `node scripts/audit-keys.mjs` и `npm run checks`.

Повторный запуск `make-key-review.mjs` ответы не сносит: строка «Вердикт:»
подтягивается из прежней версии файла.
