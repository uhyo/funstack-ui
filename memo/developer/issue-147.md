# #147: the library cuts the popup's CSS transition around its own show / hide (2026-11-24)

User decision: option B of `memo/architect/147-reevaluation.md`. Branch `feat/147-vt-css-cut`.

## WebKit probe (step 1)

Throwaway branch `probe/147-webkit` (deleted afterwards), probe copied to
`packages/ui/src/__probes__/issue147.browser.test.tsx`, CI via `gh workflow run ci.yml`.

- Run 45290202204: WebKit red on one row, `dialog cut-gated`, at the open's `ready`: the
  `cssTransitions` list (non-`::backdrop`) was `["opacity"]`, the dialog itself at opacity 1.00.
  The same single `opacity` appears in the `recipe` and `cut` rows: not a B failure.
- Run 45290682619 (probe tweak: logs each animation's `pseudoElement` / target, and a
  `cut-gated no-backdrop` row): all green on WebKit. The leftover animation is the **`::backdrop`
  enter fade, which WebKit reports with `effect.pseudoElement === ""` and the `<dialog>` as
  target** (backdrop opacity 0.055 at `ready`); without a backdrop transition the list is empty.
  Every `cut-gated` assertion holds in WebKit: gate (`:active-view-transition`) true in all six
  show / hide calls, `display: none` and no transitions at the close's `ready`, opacity 1 at the
  open's `ready`, inline style byte-identical, three view transitions in total.
- WebKit platform rows: the nested-popover and unrelated-VT rows had `display: none` already
  (WebKit animated no exit in that harness).

The backdrop labelling is a WebKit quirk worth a GitHub issue in this repo if it bites a test
(not reported anywhere; it did not affect the library).

## Implementation

- `packages/ui/src/internal/css-transition-cut.ts`, `withCssTransitionCut(element, hasTransition,
  run)`. Gate: `hasTransition && documentElement.matches(":active-view-transition")` (try/catch:
  jsdom / old engines -> no cut). Writes `transition: none !important`, runs, flushes with
  `getComputedStyle(el).opacity`, restores. Restore: if the `style` attribute is still exactly
  what the cut left, set the saved attribute back verbatim (or remove it if it was absent); else
  (someone wrote inline style inside the call, e.g. a listener) restore only the `transition`
  declaration with its priority. A `WeakSet` makes nested calls no-ops (Menu's `reshow`: one cut
  around hide + show; `showPopup` inside it would otherwise cut again).
- Call sites: `use-popover-popup.ts` (`showPopup`'s `showPopover`, apply effect's `hidePopover`,
  `reshow`), `dialog-popup.tsx` (`openDialog`'s `showModal` / `show`, apply effect's `close`).
  Not the dismissal-shaped hides (Menu Tab-out / outside / drag release, Combobox leave,
  interest, JS-free Close): those are facts.

## Tests

- jsdom: `css-transition-cut.test.ts` (7 rows: cut values, absent attribute, byte-identical raw
  consumer string, foreign write during the call, throw, gate off, unknown pseudo, nesting).
- Browser, shared overlay suite (Dialog, Popover, Menu): "plus a CSS exit" part-close rows (no
  recipe; `display: none`, old image only, no inline transition left, style restored), the open
  row (opacity 1 at `ready`), and "a dismissal's CSS fade keeps running through an unrelated view
  transition" (branches on whether the dismissal fades at all: Firefox does not).
- Popover: consumer `style={{ transition }}` row. Combobox: the accept-close row and an open row.
- Mutation check: with the gate forced off, 9 rows fail in Chromium (close, open and inline rows of
  Dialog, Popover, Combobox).
