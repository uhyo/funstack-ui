// The SHA-256 of every stylesheet the library ships (design/conventions.md 12), for hash-based
// Content Security Policies. Committed constants: `csp.test.ts` recomputes them from the CSS
// strings, so they cannot drift. No "use client" directive: data only (conventions 7.1).

/**
 * The base64 SHA-256 of each shipped stylesheet, keyed by its `<style href>`. Allow them with
 * `style-src 'sha256-<value>'`:
 *
 * - `"@funstack/ui/menu-point"`: `Menu.Popup`'s `@position-try` rules for a menu opened at a
 *   point (`Menu.ContextTrigger`), inserted on the client by the first such open.
 * - `"@funstack/ui/tooltip-warm"`: `Tooltip.Trigger`'s skip-delay rule, rendered only with
 *   `experimental_interestFor` (during server rendering too).
 *
 * A blocked stylesheet degrades: the point menu opens at the point but never flips, and on the
 * native tooltip path each tooltip waits its own `delay` (no skip-delay).
 *
 * @see https://ui.funstack.work/concepts/content-security-policy
 */
export const STYLE_SHA256 = {
  "@funstack/ui/menu-point": "Wm5aBRstuZ3S9kDs0IbldhidU/prqpIW69jEAS0N9mc=",
  "@funstack/ui/tooltip-warm": "nFBZGhNvo46ITrlBb48hELUAyWzpeIdJCziCectFQa4=",
} as const;
