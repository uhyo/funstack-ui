# Architect notes: Tooltip (#9), 2026-10-15

Working notes behind `design/components/tooltip.md`. Not a spec; the design doc is.

## Facts checked while writing

1. **jsdom 30.1.3 has no Popover API.** Probed in `packages/ui` node_modules: `showPopover`,
   `hidePopover`, `togglePopover` and the `popover` IDL property are undefined on `HTMLElement`,
   `ToggleEvent` is missing, `matches(":popover-open")` returns `false` without throwing,
   `interestForElement` is absent. Hence the shim-plus-spy test plan and the rule that the
   implementation reads open state only from the `toggle` event (never `:popover-open`).
2. **`@types/react` 19.3.0 already types `popover` with `"hint"`.** `csstype` 3.2.3 (pnpm store)
   types `positionArea`, `positionTryFallbacks`, `positionAnchor`, `anchorName`,
   `positionTryOrder`, `positionVisibility`. Not typed: `interestfor` (attribute) and
   `interest-delay*` (CSS). Both go in the one augmentation file; the CSS one needs
   `declare module "csstype"`.
3. **Server Components cannot read context.** react.dev/reference/rsc/server-components: they
   "can render a context provider imported from a Client Component module" and "Client
   Components rendered inside this provider can read its value". No mention of reading from a
   Server Component; React has had no server-side context since `createServerContext` was
   removed. This kills any directive-free Trigger/Popup that relies on context for the id link.
4. **css-anchor-position-1 §3.1**: under `position-area`, "the used value of any auto inset
   properties and auto margin properties resolves to 0", and span-all cells default to
   `anchor-center` alignment (§4.1). The popover UA stylesheet sets `inset: 0; margin: auto`;
   `inset: 0` is non-auto and resolves against the cell, so the default should just work, but
   the design asks the example app to verify before adding an `inset: auto` reset.
5. **Acceptable anchor across the top layer** (§2.3): "possible anchor is in a lower top layer
   than positioned el" applies to the popover element itself. A descendant of the popup (Arrow)
   has the popup as containing block, and the rule requires the same original containing block,
   so anchoring the Arrow to the trigger is not something I could confirm. The Arrow therefore
   positions relative to the popup via `data-side`.

## Decisions I went back and forth on

- **Event props vs `addEventListener`.** React synthesizes pointerenter/leave and focus/blur, so
  the conventional route would be `onPointerEnter` props omitted from the Trigger's type. I chose
  `addEventListener` in one effect because (a) the native step-aside is then "attach nothing"
  rather than "attach and early-return", (b) consumer pass-through handlers stay untouched, and
  (c) the `toggle` listener has to be `addEventListener` anyway (React does synthesize `onToggle`
  in 19, but the open-state bookkeeping belongs in the same closure as the timers). Flagged as
  conventions feedback item 4.
- **Where the effect lives.** Root (no DOM) vs Popup. Root wins once the elements are registered
  through `useState` setters in callback refs; it makes sibling mount order irrelevant at the
  cost of one re-render per part on mount.
- **`provides` naming.** Tried `label` (boolean), `relation`, `role`, `type`, `names`. `provides`
  reads as a sentence at the call site ("this tooltip provides the name") and is an enum so it
  can grow (`"none"` for a purely visual hint?) without a breaking change.
- **`data-open`.** Would need a React state write from `toggle` on every hover. `:popover-open`
  plus `:has(+ :popover-open)` covers trigger styling since the popup must follow the trigger
  anyway. Dropped.
- **Focus delay.** Instant-on-focus is what Radix/Base UI do and arguably better for keyboard
  users. Parity with the native path won; escalated as open question 4.
- **Baseline type.** `auto` was tempting (free Escape and outside click everywhere) but it closes
  any open `auto` popover (menus) when the tooltip opens, which the research explicitly warns
  about. `manual` + JS is the only cross-engine type that never interferes with other overlays.
- **Arrow.** Nearly dropped it. Kept as a thin `span` so the anatomy is stable and the
  resolved-side problem is recorded in one place instead of rediscovered later.

## Prior art borrowed / rejected

- Base UI Tooltip: `Trigger` / `Popup` names, `delay` / `closeDelay` names and the "popup follows
  pointer into tooltip" rule. Rejected its `Provider` (skip-delay group) and `Positioner` (CSS
  anchor positioning does that).
- Radix: `side` / `align` vocabulary and physical keywords. Rejected `asChild`, `Portal`,
  `TooltipProvider`.
- React Aria: nothing specific; its `isOpen` / `onOpenChange` is the controlled API the design
  deliberately omits.

## Things to raise later

- A `Popover` component is where controlled `open`, `commandfor` pinning and `openChangeAction`
  for browser-owned state get designed. Tooltip should then say "pinned tooltip = Popover".
- `::interest-button` once it ships anywhere: touch affordance for the native path.
- Resolved placement signal for Arrow: watch CSSWG for a `position-try` custom-property or
  pseudo-class proposal before writing any JS for it.
- Graduation checklist: drop `experimental_hint` when Safari stable has `hint`; drop
  `experimental_interestFor` when Gecko and WebKit ship `interestfor`.
