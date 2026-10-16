/**
 * Id derivation for Tabs (design section 6). Every part derives its ids from the Root's `useId`
 * and the tab `value`, so there is no registration pass and no extra render.
 *
 * No `"use client"` directive: pure functions, importable from anywhere (conventions 7.1).
 */

function escapeChar(char: string): string {
  return `_${(char.codePointAt(0) ?? 0).toString(16)}_`;
}

/**
 * Makes `value` safe as both an HTML id fragment and a CSS dashed-ident suffix. Every character
 * outside `[A-Za-z0-9-]` becomes `_<hex code point>_`. `_` itself is escaped too (`_5f_`), so the
 * mapping is injective: `"a b"` and `"a_20_"` never share an id.
 */
export function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/gu, escapeChar);
}

/**
 * The Root id from `useId` (`_r_1_` on React 19.3) is already a valid id and CSS ident; anything
 * else (a custom `identifierPrefix`) is escaped defensively for the anchor name, keeping `_`.
 */
function cssSafeRootId(rootId: string): string {
  return rootId.replace(/[^A-Za-z0-9_-]/gu, escapeChar);
}

export function tabId(rootId: string, value: string): string {
  return `${rootId}-tab-${slug(value)}`;
}

export function panelId(rootId: string, value: string): string {
  return `${rootId}-panel-${slug(value)}`;
}

/** `anchor-name` of a Tab, and `position-anchor` of the Indicator that points at it. */
export function anchorName(rootId: string, value: string): `--${string}` {
  return `--fsui-tab-${cssSafeRootId(rootId)}-tab-${slug(value)}`;
}
