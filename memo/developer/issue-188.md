# #188 direction and locale (2026-11-27)

Branch `feat/188-direction-locale`.

## A1 probe (OTPField in `<div dir="rtl">`, no `dir` on the Root, before the default)

Temporary file `otp-field/otp-probe.browser.test.tsx` (deleted). Chromium and Firefox locally,
WebKit through `gh workflow run ci.yml --ref probe/188-otp-rtl` (branch deleted afterwards; WebKit
lacks host libraries here). Values `1234` numeric, `ab12` and `AB34` alphanumeric: identical
results per engine, so charset does not matter. `from->to` is `selectionStart` after the key with
the caret set at `from` (4 characters typed, length 6).

| | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Input computed direction | rtl | rtl | rtl |
| slots, left to right | 5,4,3,2,1,0 | 5,4,3,2,1,0 | 5,4,3,2,1,0 |
| ArrowLeft 2 / 0 / 4 | 3 / 1 / 4 (forward) | 1 / 0 / 3 (backward) | 1 / 3 / 4 (visual, jumps at the run edge) |
| ArrowRight 2 / 0 / 4 | 1 / 0 / 3 (backward) | 3 / 1 / 4 (forward) | 3 / 0 / 1 (visual, jumps) |
| Home / End from 2 | 0 / 4 | 0 / 4 | 0 / 4 |

With `dir="ltr"` on the Root (in the RTL container) all three: slots 0..5 left to right,
ArrowLeft backward (2->1, 0->0, 4->3), ArrowRight forward, Home 0, End 4.
`dir="rtl"` on the Root equals no `dir` in the RTL container.

Against otp-field.md 4.4: the rule (default `ltr`) holds and is stronger than stated. The
sentence "ArrowLeft would move the active box to the right" is true for Firefox and WebKit
(mid-run) but not Chromium, where ArrowLeft moves to the higher index, i.e. the box to the left.
Not edited (architect's text); reported.
