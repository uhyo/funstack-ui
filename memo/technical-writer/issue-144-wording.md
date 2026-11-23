# #144 wording fixes (from #143)

Branch `docs/144-wording`. Out of scope (design pending): #145 superseded rejection paragraph,
#146 pure trigger guard, #147 CSS exit + view transition, #148 parts vs dismissals.

## Done
- History removed from component pages: Progress ("first output-only"), Slider ("first continuous
  control"), Combobox ("first urgent state"), Toast ("first state urgent by design"). Grep also
  checked: wave N, alpha.N, added in, renamed, formerly. CSP "only provider" kept (a fact, not history).
- Why: React 18 = transitions + Suspense for data fetching (react.dev/blog/2022/03/29/react-v18,
  "Suspense in Data Frameworks"); React 19 = actions, useOptimistic (react.dev/blog/2024/12/05/react-19);
  React 19.3 = ViewTransition stable (react.dev/blog/2026/09/09/react-19-3). New "Built for Async
  React" section (#async-react), source: React Conf 2025 recap. Dropped "Content that loads data"
  and "Maturity" rows.
- Getting started: render moved to /concepts/render (RenderPage, Guides sidebar). data-pending out
  of the shared-props table, now a sentence after it.
- Fixed while moving: old text said type="button" only for a <button>; source `rendersButton` and
  conventions 1.x say a component element gets it too.
- Action props: form-reset sentence rewritten from conventions 2.x item 7 (form reset is a platform
  dispatch, not user interaction). Dialog.Form sentence elaborated with react.dev form docs
  (Server Function as action submits before JS loads). Server Function paragraph without the proxy;
  callout retitled. "library's one on* prop" dropped.
- Transitions: reduced-motion sentence as reminder. Suspense: library mode linked to
  browser-owned-state#two-modes; "What must not suspend" -> "Keep triggers from suspending" (#triggers).
- Browser-owned state: hint marked as an example. Server Components: @funstack/static 1.3.4 dropped.
- Toast: "Async React" linked to /why#async-react.

## Not in #144, noticed
- #143 also reports the last Server Components accordion example animates open but not close.
  Not a wording item; needs an issue if not filed.
