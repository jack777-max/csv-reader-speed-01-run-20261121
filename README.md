[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/jack777-max/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/jack777-max/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# csv-reader, read faster

Entry for the make.fun bounty **"Read broken CSV files faster, 21 November 2026"**
(https://make.fun/bounty/csv-reader-speed-01-run-20261121).

`solve.js` is a dependency-free ES module whose `run(input)` returns exactly
csv-reader 1.0.0's answer for every input — the same `{columns, rows, errors}`,
the same broken-row policy (stray_cr, quote_junk, unterminated_quote,
short_row, long_row, in the order met) — read in one pass of `charCodeAt`
scans instead of one character at a time. A field whose characters need no
rewriting is cut out of the text with one `slice`; only a field holding a
dropped stray CR, a doubled quote or a CR inside its quotes is rebuilt,
segment by segment. `main.ts` is the harness driver: it reads every case
from `/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

On the kit's practice set (6 cases, 10.2 MB of CSV) the answers are
identical to csv-reader 1.0.0's on every case, and `run` takes about
95–150 ms of CPU against the reference's about 600–660 ms — roughly
4–6× faster, machine-dependent.

Run locally with Node 22:

```
MAKEFUN_INPUT_DIR=<practice/input> MAKEFUN_OUTPUT_DIR=<out> node main.ts
```
