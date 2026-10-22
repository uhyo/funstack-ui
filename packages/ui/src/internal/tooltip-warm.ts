// Tooltip's skip-delay rule on the native `interestfor` path (design/components/tooltip.md 6,
// conventions 12): while any tooltip is showing, the inline `interest-delay-start` of a flagged
// Trigger computes to 0. No "use client" directive: constants only (conventions 7.1).

/** Registered, non-inherited: `1` on the marked triggers while a tooltip is showing, else `0`. */
export const TOOLTIP_WARM_PROPERTY = "--fsui-tooltip-warm";
/** The marker a flagged Trigger renders; the shipped rule matches nothing else. */
export const TOOLTIP_TRIGGER_MARKER = "data-fsui-tooltip-trigger";
/** The dedupe key of the shipped rule (`<style href precedence>`). */
export const TOOLTIP_WARM_HREF = "@funstack/ui/tooltip-warm";

/**
 * The library's second shipped stylesheet: interaction timing, nothing visual (conventions 12's
 * selector exception: it matches only the library's marker and sets only a `--fsui-` registered
 * property the Trigger's inline style consumes). Its SHA-256 is `STYLE_SHA256` in
 * `@funstack/ui/csp` (a jsdom row recomputes it). Blocked or unregistered, the `var()` falls back
 * to the initial `0` and the normal delay applies.
 */
export const TOOLTIP_WARM_RULES =
  "/* @funstack/ui: tooltip skip-delay. Functional only: while a tooltip is showing, the next " +
  "one opens without its delay. */\n" +
  `@property ${TOOLTIP_WARM_PROPERTY} { syntax: "<number>"; inherits: false; initial-value: 0; }\n` +
  `:root:has([role="tooltip"]:popover-open) [${TOOLTIP_TRIGGER_MARKER}] { ${TOOLTIP_WARM_PROPERTY}: 1; }\n`;

/** The inline `interest-delay-start` of a flagged Trigger: `delay` when cold, `0` when warm. */
export function warmDelay(delay: number): string {
  return `calc(${delay}ms * (1 - var(${TOOLTIP_WARM_PROPERTY})))`;
}
