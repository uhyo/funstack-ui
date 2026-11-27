# #172 direction / locale: working notes (2026-11-27)

Proposal: `design/direction-locale.md` (status proposed). Changelog entry of the same date.

## How the audit was done

- `grep -rnIE "direction|\bdir\b|rtl"` over `packages/ui/src` (non-test), and the files that
  mention ArrowLeft / ArrowRight. All reads are `getComputedStyle(el).direction` at event time.
- `grep "Intl\.|locale|toLocale|navigator\.language|\blang\b"`: only NumberField, Progress,
  Meter use `Intl`; typeahead uses plain `toLowerCase()`.
- RTL test rows: found by `grep -l rtl` over test files. OTPField has none.

## Not verified (say so if asked)

- OTPField under RTL (G2) is reasoning from the design (one input with an LTR digit run, slots
  in DOM order), not a probe. A probe in three engines is follow-up F3.
- Prior art details for Ark (`dir` + `locale` props next to `LocaleProvider`), Headless UI and
  Ariakit come from memory. Base UI's DirectionProvider text ("does not affect HTML and CSS",
  default `ltr`) was checked on base-ui.com on 2026-11-27.
- Whether Base UI's newer date components ship a localisation provider: not checked.

## Thoughts kept out of the proposal

- A `LocaleProvider` could work for directive-free Roots only through something like a
  per-request `cache()` store on the server, which is a framework concern, not a UI library's.
- If decision 2(b) (normalise RadioGroup) is picked: handle only ArrowLeft / ArrowRight under
  RTL, like Slider; `click()` on the neighbour keeps "check on focus"; the wrap behaviour in
  WebKit would differ between the JS-handled keys and the native Up / Down unless those are
  handled too. That is the real cost.
- Typeahead and locale: `toLowerCase()` vs `toLocaleLowerCase(lang)` only matters for Turkish
  dotted I and similar; both sides are folded the same way, so matching still works.
