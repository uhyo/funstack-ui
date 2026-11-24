# #154: per-submitter pending with two `formAction` Buttons (2026-11-24)

Status: investigation, no library code changed. Recommendation: **fix with a latch** (below).
Probe: `memo/architect/probes-154/form-status.probe.test.tsx`, output in
`memo/architect/probes-154/output.txt` (React 19.3.1, jsdom). Run from the repository root:

```sh
pnpm --filter @funstack/ui exec vitest run \
  --config ../../memo/architect/probes-154/vitest.config.mjs --disable-console-intercept
```

## 1. What React does (probe rows 1, 5, 6, 7, 10)

- **Form actions are not queued.** Each submission calls its function at once; `a` and `b`
  overlap (row 1: `[a called]` at click A, `[b called]` at click B, before `a` settled). Only a
  `useActionState` dispatch queues, and only against itself (row 10: the second `dispatchA`
  runs after the first resolved; `dispatchB` runs alongside).
- **`useFormStatus` is one optimistic value per form**, overwritten by every submission:
  `{ pending: true, action: <latest submitter's function> }`. It names no submitter and keeps
  no history. Click A, click B: `action=b`, and it stays `b` whichever of the two settles first.
- **`pending` ends once, when every overlapping submission has settled** (React entangles async
  actions; the optimistic status reverts when the entangled transition commits). It does not
  end for `a` when `a` resolves.
- The same holds outside forms. Two `Button action` side by side (row 5): click A, click B,
  resolve `a`: **A stays `data-pending` until `b` resolves too**, and a transition update that
  `a` made is committed only then (rows 5 and 6, `committed=""` until both settled).
- Rejections (row 7): the older submission's rejection is dropped by React (already documented,
  design 18.3); the latest one's reaches the boundary after the other settled.

So "pending exactly while my own promise is unsettled" is not something React renders anywhere:
the result of a settled action is held until the actions it overlaps settle, and every
transition-based pending (`useTransition`, `useFormStatus`, `useOptimistic`) is held with it.
The observable truth for a submitter is: **pending from its submission until the form's
overlapping submissions have all finished.**

## 2. Is the bug real? Yes, and it is worse than the issue says

Current Button (rows 2, 3, 4):

| step | A | B |
| --- | --- | --- |
| click A | pending | - |
| click B | **-** | pending |
| resolve b (a still running) | **-** | pending |
| resolve a | - | - |

- A loses `data-pending` at the click on B and never gets it back, although `a` runs and its
  result is not committed yet. In the `b`-first order B is shown pending for `a`'s time and A
  not at all.
- The same happens when the form's own `action` is submitted while A runs (`Form.Submit`, Enter
  in a field): `status.action` becomes the form's function (row 4).
- **`whilePending="ignore"` leaks** (row 3): click A, click B, click A again runs `a` a second
  time while the first run is in flight, because the guard reads the same `formPending`. This
  is the case the prop exists for (Save, Pay), so "accept and document" is not good enough.
- It is also inconsistent with `Button action`, whose pending holds through overlap (row 5).

Cause: `formPending` compares `status.action` with the Button's function on every render, and
`status.action` is only the latest submitter.

## 3. What a Button can observe

| Source | Gives | Problem |
| --- | --- | --- |
| `useFormStatus().action` | the latest submitter's function | no history (the bug) |
| `useFormStatus().data` | the latest `FormData`; includes the submitter's `name`/`value` | same, and needs a `name` |
| the click handler | "this Button was activated" | not "a submission started": validation or an `onSubmit` can cancel it |
| wrapping `formAction` | the Button's own promise | see candidate W |

Candidates probed (rows 8, 9, 11), all give the table of section 4:

- **L, latch (recommended).** Once the form status has named this Button's function, the Button
  stays pending until the form status is idle. Derived state, no handler, no wrapper.
- **T, own empty transition in the click** (`startTransition(() => {})`, entangled with the
  form's action). Works, but a click whose submission is cancelled by validation flashes
  `data-pending` for one commit (row 9: `["PENDING","-"]`), and implicit submission and
  `requestSubmit` depend on a click being sent.
- **W, wrap the function** and await its promise in the Button's own transition. Works in
  jsdom, but React would be given a wrapper instead of the consumer's function: a Server
  Function loses its `$$FORM_ACTION` (no submission before hydration, contradicting design
  2.5 / 11), `useFormStatus().action` no longer equals what the consumer passed (their own
  status readers break), and a `useActionState` dispatch is no longer recognised as one. And it
  buys nothing: W's pending is a transition too, so it is held until `b` settles exactly like L.

A non-transition flag (`useState` cleared in a `finally`) could end at the promise, but it
needs W's wrapper, would show "done" before React commits the action's result, and would differ
from every other pending in the library. Rejected.

## 4. Proposed fix: latch on the form status

```ts
const status = useFormStatus();
const submittedWith = useRef<unknown>(undefined);          // unchanged
const [submitted, setSubmitted] = useState(false);
const named =
  status.pending &&
  typeof formAction === "function" &&
  (status.action === formAction || status.action === submittedWith.current);
if (named && !submitted) setSubmitted(true);                // derived state, during render
if (!status.pending && submitted) setSubmitted(false);
const formPending = named || (status.pending && submitted);
```

| step | A | B |
| --- | --- | --- |
| click A | pending | - |
| click B | pending | pending |
| first of them resolves | pending | pending |
| the other resolves | - | - |

- Rule in one sentence, for JSDoc and the docs: **a `formAction` Button is pending from its own
  submission until the form's submissions have all finished.** A Button that did not submit is
  still never pending (per-submitter is kept); `Form.Submit` keeps the whole channel.
- Same lifetime as `Button action` under overlap (row 5) and as the existing single-Button
  overlap row ("React's form status stays pending until every overlapping submission has
  finished"). One rule for both props.
- Closes the `"ignore"` hole: A is pending through B's submission, so the third click is
  cancelled. The guard stays a render value, as documented in 5.2 / 18.3.
- A submission that validation cancels never sets the latch (row 9), since only React's status
  sets it.
- Cost: one `useState` and two render-phase updates in `button.tsx`. No new prop, no API change.

Known limits (document, do not solve):

- Two submissions started by script in one task (`requestSubmit(a); requestSubmit(b)`, row 11):
  React never renders the status that names `a`, so A is not pending. User input cannot do
  this (React flushes the status between discrete events).
- Two Buttons sharing one function are still indistinguishable (6.2, unchanged).
- After `b` settled first, B stays pending until `a` settles. That is React's entanglement, the
  same as two `Button action` (row 5), not an artefact of the latch.

## 5. Work for the developer

- `packages/ui/src/button/button.tsx`: the latch; JSDoc of `ButtonState.pending`,
  `formAction` ("...until the form's submissions have all finished") and the comment above
  `useFormStatus`.
- `button.test.tsx`, formAction rows: two Buttons with different functions in both settle
  orders (table above); the form's own action submitted while A runs; `whilePending="ignore"`
  A, B, A (one call of `a`, the third click `defaultPrevented`); a validation-cancelled click
  on A followed by B (A not pending). jsdom is enough.
- Design text to amend with the fix: `design/components/button.md` 2.2 (the "Three buttons"
  paragraph), 6.2 (formula and a paragraph on overlap), 18.3; `design/conventions.md` 2.7 where
  it describes the own-`formAction` reading. Docs: Button page (`formAction` row, the
  "Overlapping submissions" callout), SKILL.md if it restates the rule.

## 6. Decision level

No API or default changes; the visible change is that a submitter keeps `data-pending` longer
under overlap, and `"ignore"` blocks a case it let through. I consider it a bug fix the product
owner can schedule without a user decision. Worth one line to the user because the public
sentence "pending while its own submission runs" becomes "from its own submission until the
form's submissions have all finished".
