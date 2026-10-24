# Wave 16, test conformance suites phase 3 (#106, tracker #100)

Branch `wave16/suites`. Audit: `memo/reviewer/refactor-audit-tests.md` (T2, T3, T13, leftovers of
T4/T6). Guard rail T20: jsdom titles from the JSON reporter, diffed per commit (script kept in a
private scratchpad: sorted `file > fullName` list).

Baseline (master 0578f90): jsdom 2923 tests, all pass.

## 1. `hydrateFromServer` (T3 leftover)

`__tests__/helpers.tsx` `hydrateFromServer(ui, { mutate?, client?, inAct?, flush? })`: renderToString
into a fresh container in `document.body`, `mutate` (may be async: accordion waits an immediate,
menu a task, the browser files a real `user.click`), hydrate (`inAct` renders inside an async `act`,
for trees that suspend), then `flush` (default `flushMicrotasks`, `null` for none, combobox
`flushTasks(2)`). If `mutate` throws, the container is removed (it is not rendered yet, so
`cleanup()` would leave it behind and later rows would see duplicate elements; found when an
experimental extra assertion failed and 10 later checkbox rows failed with it).

Replaced: the private `hydrate()` of use-native-checked, use-native-group-reconciliation (+
`hydrateLate`), slider, number-field, radio-group (+ 3 inline late-hydration copies),
checkbox-group (3 `hydrate` + `hydrateLate` + 4 inline), select (+ 2 inline -> local `hydrateLate`),
checkable-input-suite (+ 1 inline), combobox, accordion, checkbox (1 inline), menu (1 inline), and
the browser copies in radio-group.browser, checkbox-group.browser, checkable-input-browser-suite.
Pre-hydration assertions on the server HTML moved into `mutate` unchanged.
Not touched: dialog.test.tsx and popover.test.tsx (another developer owns them in parallel); their
two `hydrate()` copies can switch to `hydrateFromServer(ui, { mutate, flush: null })` later.
Titles: identical (2923 = 2923).
