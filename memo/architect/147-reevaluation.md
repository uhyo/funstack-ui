# #147 re-evaluated after #148 (2026-11-24)

Issue #147: "the restriction on combining a CSS exit with the `transition` prop is annoying; drop
CSS `transition` support on the popup?" First evaluation: `143-design-questions.md`, "#147".
#148 merged as cc2b491 (dismissals are facts: urgent commit, no view transition). Evaluation only:
no library code, design doc or docs page was changed.

Probe: `probes-147/issue147.browser.test.tsx.txt` (source), `probes-147/output.txt` (raw rows,
Chromium 156.0.8078.4 and Firefox 157.0, Playwright 1.64.1, React 19.3.1). WebKit did not run:
see "WebKit" below.

## Summary

- What is left of the restriction is one case: a popup with **both** a `transition` prop and a
  CSS `transition`, in a show or hide **the library performs**. Dismissals are out of it.
- Option B works in Chromium and Firefox: the library cuts the popup's CSS transition around its
  own `showPopover()` / `hidePopover()` / `showModal()` / `close()` while a view transition is
  active. The result is identical, row for row, to today's recipe, and the consumer writes
  nothing.
- Recommendation: **B**, subject to one green WebKit run in CI. Not C (dropping CSS exits): after
  #148 the CSS exit is the *only* thing that animates a dismissal, so dropping it costs more than
  before, not less.

## 1. What remains of the restriction

Parts: `Dialog.Popup`, `Popover.Popup`, `Menu.Popup` (context menu included), `Combobox.Popup`.

| Consumer writes | Library show / hide (Trigger, Close, item, controlled `open`) | Dismissal (Escape, light dismiss) |
| --- | --- | --- |
| CSS only | CSS (no exit in Firefox) | CSS (no exit in Firefox) |
| `transition` only | view transition | nothing |
| both, no recipe | **overlap** (below) | CSS only, no view transition (#148) |
| both, with the recipe | view transition only | CSS only |

The overlap, measured (rows `A <kind> none`):

- **Close, Chromium only**: the hidden box stays rendered through its `display` / `overlay`
  fade, so the new snapshot holds a live fading popup next to the old image
  (`close@ready`: `display: block`, `opacity 0.96`, pseudos `old` + `new` + `group`). Firefox:
  `display: none`, `old` only.
- **Open, Chromium and Firefox**: the CSS enter (`@starting-style`) runs under the view
  transition's enter (`open@ready`: `opacity 0.04` in both). This is the design docs' "use
  `transition` or the CSS enter, not both" rule; the recipe covers it too, as a side effect.

What #148 removed: a dismissal starts no view transition, with or without `transition`
(`escape+100ms`: `vtCalls` stays 3, Chromium mid-fade at `opacity 0.75`). The recipe is no longer
needed for the dismissal's own sake.

What the recipe still costs, because its selector cannot tell whose view transition is active:
an unrelated view transition of the page cuts a dismissal's fade in progress (row
`B unrelated-vt recipe=true`, Chromium: `display: none` at `ready`; `recipe=false`: still fading
at `opacity 0.79`).

## 2. Probe of option B

Option B was emulated without library changes: the probe wraps the four DOM methods the library
calls for its own show and hide, on the real `Popover` and `Dialog` with `transition="pop"` and a
400 ms CSS fade. Escape never goes through those methods, exactly as in B.

```ts
// what the library would do around its own call, when the Popup has `transition`
if (document.documentElement.matches(":active-view-transition")) {
  const previous = popup.style.getPropertyValue("transition");
  const priority = popup.style.getPropertyPriority("transition");
  popup.style.setProperty("transition", "none", "important");
  popup.hidePopover();                    // or showPopover / showModal / close
  void getComputedStyle(popup).opacity;   // the style change is processed under the cut
  if (previous === "") popup.style.removeProperty("transition");
  else popup.style.setProperty("transition", previous, priority);
}
```

Variants: `none` (no recipe), `recipe` (today), `cut` (always), `cut-noflush` (no style flush
before the restore), `cut-gated` (the code above).

| Row | Chromium 156 | Firefox 157 |
| --- | --- | --- |
| close, `none` | double image | clean |
| close, `recipe` | clean (`display: none`, `old` only) | clean |
| close, `cut` / `cut-gated` | clean, same values as `recipe` | clean |
| close, `cut-noflush` | **double image** (the restore lands before the style change is seen) | clean |
| open, `none` | CSS enter runs under the VT (`0.04`) | same (`0.04`) |
| open, `recipe` / every `cut` | no CSS enter (`1.00`) | same |
| gate inside the library's call | `:active-view-transition` matches, `document.activeViewTransition` set, in all show and hide calls | same |
| Escape afterwards | CSS fade runs (`0.75` at 100 ms), no view transition | no fade (Firefox animates no top-layer exit), no view transition |
| inline style after the call | byte-identical to before | same |
| consumer `style={{ transition }}` | cut works, value restored byte for byte | same |
| Dialog `::backdrop` | leaves with the dialog on close; its enter fade runs on open, as with the recipe | same |

Platform rows (no React), nested popovers closed by the parent's `hidePopover()`:

| Child | Cut on the parent only | Chromium | Firefox |
| --- | --- | --- | --- |
| DOM descendant of the parent (every library nesting: a `Root` inside a `Popup`, submenus) | enough: the child has no box | clean | clean |
| not a descendant, nested through its invoker | **not enough**: the child keeps fading (3 transitions, has a box) | needs a cut on the child too (then clean) | clean either way |

Findings that shape the design:

1. **The style flush is required** (`cut-noflush` fails in Chromium). One forced style
   recalculation per library show / hide inside the update callback.
2. **Cut and restore in one synchronous step.** Nothing is left on the element between commits,
   so React's `style` diffing never meets it and there is no "restore before the next show"
   bookkeeping (the unknown I listed in the first evaluation).
3. **Gate on the active view transition, not only on the prop.** With the gate, B is the recipe's
   semantics exactly: when a library close runs without a view transition (React batched it into
   a non-transition commit), the CSS exit still plays as the fallback. The gate held in every
   call in both engines.
4. **Cut the show as well as the hide**, which absorbs the "`transition` or the CSS enter, not
   both" rule too.
5. `!important` on the inline declaration, so a consumer's `transition … !important` does not
   defeat the cut.

### WebKit

Not run. Playwright's WebKit build is downloaded here but cannot launch: the host lacks
`libgtk-4`, `libgraphene`, `libgstreamer` plugins and others (`playwright install-deps webkit`
needs root). What is known: per the overlay suite's notes, a closing box in WebKit is already
`display: none` at `ready` with or without the recipe, so the close half needs no cut there. Open
questions for WebKit: the gate inside the update callback, the enter cut, and that the restore
starts no transition. If the gate were false there, B degrades to today's "no recipe" behaviour
in WebKit, not to something new.

How CI can answer it (as the #148 developer did with run 45215480609): on a throwaway branch
`probe/147-webkit`, copy the probe to `packages/ui/src/__probes__/issue147.browser.test.tsx`,
push the branch, `gh workflow run ci.yml --ref probe/147-webkit`, read the job
"browser (webkit)", delete the branch. The `cut-gated` rows assert B's engine-independent claims
(gate true in every call, `display: none` and no CSS transition at the close's `ready`, opacity
1 at the open's `ready`, inline style restored, three view transitions in total), so a green job
is the answer without console output. I did not push a branch: my task allowed memo files on
master only.

## 3. Recommendation: B

Conditions: the Popup has `transition`, the call is the library's own show or hide, and
`html:active-view-transition` matches at that moment.

Consumer code, before:

```tsx
<Dialog.Popup className="dialog" transition={{ "fsui-dialog-open": "pop", "fsui-dialog-close": "pop", default: "none" }}>
```
```css
.dialog { opacity: 0; transition: opacity 150ms, display 150ms allow-discrete, overlay 150ms allow-discrete; }
.dialog:open { opacity: 1; }
@starting-style { .dialog:open { opacity: 0; } }
/* Keep the CSS exit for dismissals, but not while a view transition runs. */
html:active-view-transition .dialog { transition: none; }
```

After: the same, without the last rule and its comment. The docs section shrinks to: "the
`transition` prop animates what the library does, CSS animates what the browser does (a
dismissal); write both, they never overlap."

What B gains over the recipe:

- nothing to know, nothing to forget; nine stylesheets and four component pages lose the line;
- scoped to the popup's own show / hide: an unrelated page view transition no longer cuts a
  dismissal's fade;
- the enter rule ("not both for the same open") disappears with it.

Trade-offs, stated plainly:

- The library writes an inline `transition` on the consumer's element, for the length of one
  synchronous call. A `MutationObserver` on `style` sees two mutations. Conventions 12 restricts
  *shipped stylesheet* rules, not this, but it is a functional write on a consumer element and
  should be recorded there.
- One forced style recalculation per library show / hide during a view transition.
- No opt-out: a consumer cannot have the CSS transition and the view transition run together on
  one popup. I know no reason to want that.
- A nested popup that is not a DOM descendant of its parent keeps fading in Chromium when the
  parent's library close takes it down. No library composition produces that layout; the old
  recipe line still works for whoever builds it. A shared "library hide in progress" scope read
  in the child's `beforetoggle` would close the gap (the `parent+child` row shows the cut itself
  works); I would not build it until someone needs it.
- Depends on `:active-view-transition` in every engine (true in Chromium 156 and Firefox 157;
  the recipe depends on it equally).

Engines where it fails: none found (Chromium, Firefox). WebKit unverified.

Options not recommended:

- **Keep the recipe (A).** Valid fallback if WebKit fails in a way that cannot be branched. One
  line, but it is the line the user called annoying.
- **Drop CSS exits (C).** After #148 the split is clean: a dismissal has no view transition by
  design, so CSS is its only animation. Dropping it means Escape and click outside always snap.
- **Drop `transition` on popups (D).** Unchanged from the first evaluation: no exit in Firefox,
  no typed animations.

## 4. If accepted: work for the developer

1. WebKit run of the probe (above). Red: stop and report.
2. One helper (`internal/`), used by `use-popover-popup.ts` (`showPopup`, the apply effect's
   hide, `reshow`) and `dialog-popup.tsx` (`showModal()` / `show()`, `close()`), active only when
   `transition !== undefined`.
3. Overlay suite and Combobox rows "a CSS exit (recipe=%s)": the `recipe` parameter goes;
   `fading` is `false` in every engine. Add a row for the open (no CSS enter at `ready`) and one
   for "an unrelated view transition does not cut a dismissal's fade" (Chromium).
4. Docs: Transitions `#css-exit`, Dialog / Popover / Menu / Combobox pages, five docs
   stylesheets, four playground stylesheets (`toggle-demo.css` mentions the pseudo-class for
   another reason: check before touching), `conventions.md` 5.1, `dialog.md` 10.3,
   `popover.md` 10.2, `menu.md`, `combobox.md`, `overlay-open-change.md` section 10.

## 5. For the user

1. May the library write a momentary inline `transition: none !important` on the popup element,
   around its own show / hide while a view transition is active, so that the recipe disappears
   (B)? The alternative is to keep the one-line recipe (A).
2. The WebKit check needs a throwaway branch and a CI run. Who runs it: the developer as step 1
   of the implementation, or first, before B is decided?
