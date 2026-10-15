# Working notes: popover + anchor tooltip research (2026-10-15)

Things worth re-checking later (not in the doc, or likely to change soon):

- Safari `popover=hint`: WebKit main 317402@main (2026-07-17), STP 249. Watch Safari 27.x release
  notes; when it lands, drop the `hint` flag. Interop 2026 focus item, so likely by early 2027.
- `interestfor` in Gecko: bug 1984699 UNCONFIRMED. In WebKit: standards-positions #464 reopened
  2026-06-02 without "oppose". No implementation bugs with activity in either engine.
- `::interest-button`: CSSWG 12437 and 13980-13982, 14037, 14433. Not shipped in Chrome.
- `@types/react` lacks `commandFor`/`command`/`interestFor`: DT issue #74664, four closed PRs
  (last 2026-08-31). Library must ship a module augmentation; use lowercase JSX prop names.
- Verified locally: react-dom 19.3.1 passes `interestfor`/`commandfor`/`command` through
  unchanged in SSR with no warning; camelCase variants warn. `popover`, `popoverTarget`,
  `popoverTargetAction` are special-cased.
- caniuse marks anchor positioning "partial" in Chrome/Firefox only because of the
  `anchor-valid`/`anchor-visible` rename and (Firefox) non-animatable `anchor()`. Not blocking.
- Firefox 156.0 hang with `position-anchor` (bug 2070171), fixed in 156.0.1.
- Current stable on research date: Chrome 155 (10-06), Firefox 158 (10-13), Safari 27.0 (09-14).
