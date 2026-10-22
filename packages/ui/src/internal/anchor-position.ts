// Placement of a popover against its implicit anchor (the invoker set by `commandfor`,
// `interestfor` or `showPopover({ source })`): inline `position-area` from a side and an
// alignment, plus `position-try-fallbacks` that flip it when it does not fit; and the parser that
// reads back which option the browser applied. Shared by Tooltip, Popover and Menu
// (design/conventions.md 13; design/components/tooltip.md 7.1, popover.md 8).
//
// Keyword policy (conventions 13.1): physical keywords and the `self-*` group only. A plain
// logical keyword (`block-end`, `span-inline-end`) on a top-layer popup resolves against the
// root's writing mode, so it would ignore a `dir="rtl"` container; `self-x-*` resolves against the
// popup's own (inherited) direction. Keyword groups are never mixed in one value.
//
// No "use client" directive: pure functions, importable from anywhere (conventions 7.1).

/** A physical side of the anchor. */
export type PhysicalSide = "top" | "bottom" | "left" | "right";
/**
 * Side of the anchor the popup is placed on: physical, or inline-logical (`inline-start` /
 * `inline-end` follow the popup's own `direction` through the `self-x-*` keywords).
 */
export type AnchorSide = PhysicalSide | "inline-start" | "inline-end";
/**
 * Alignment along that side: inline-relative on a `top` / `bottom` side (`start`: the popup's
 * inline-start edge meets the anchor's), the top / bottom edges on the others.
 */
export type AnchorAlign = "start" | "center" | "end";
/** A computed `direction`. */
export type Direction = "ltr" | "rtl";

/** Flip to the opposite side, then the other axis, then both, when the popup does not fit. */
export const POSITION_TRY_FALLBACKS = "flip-block, flip-inline, flip-block flip-inline";

const SIDE_KEYWORD: Record<AnchorSide, string> = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
  "inline-start": "self-x-start",
  "inline-end": "self-x-end",
};

/**
 * The `position-area` for a side and an alignment (the matrix of conventions 13.1):
 * `bottom` + `center` is `bottom`, `bottom` + `start` is `bottom span-self-x-end`, `right` +
 * `start` is `right span-bottom`, `inline-end` + `start` is `self-x-end span-bottom`.
 */
export function positionArea(side: AnchorSide, align: AnchorAlign): string {
  const keyword = SIDE_KEYWORD[side];
  if (align === "center") return keyword;
  const horizontal = side === "top" || side === "bottom";
  const span = horizontal
    ? align === "start"
      ? "span-self-x-end"
      : "span-self-x-start"
    : align === "start"
      ? "span-bottom"
      : "span-top";
  return `${keyword} ${span}`;
}

// --- Reading back the applied option (conventions 13.2) --------------------------------------

/** Where the browser placed a popup: a physical side and the alignment along it. */
export interface ResolvedPlacement {
  readonly side: PhysicalSide;
  readonly align: AnchorAlign;
}

type Axis = "x" | "y";

interface Token {
  /** `side`: the cell is on that side; `span`: spans toward a direction; `neutral`: neither. */
  readonly kind: "side" | "span" | "neutral";
  /** The physical direction of a `side` or `span` token. */
  readonly physical: PhysicalSide | null;
}

const AXIS_OF: Record<PhysicalSide, Axis> = { top: "y", bottom: "y", left: "x", right: "x" };

/**
 * Parses a computed `position-area` (conventions 13.2) into the physical side the popup sits on
 * and its alignment. Total: anything it cannot map returns `null` (`none`, an empty value, a
 * vertical `writing-mode`, a corner cell, the cell over the anchor, an unknown keyword), and the
 * part keeps the requested values. The engines serialise in grammar order, in any keyword group:
 * `span-left top`, `span-all bottom` (Firefox's form of a flipped `bottom`), `self-end
 * span-self-end`, `span-self-x-end bottom`, `self-x-start span-top`.
 *
 * `selfDirection` is the popup's computed `direction` (it resolves `self-*` tokens);
 * `rootDirection` the root's (plain `x-*` / `inline-*` tokens, which a consumer `style` override
 * may use), passed as a function so it is read only when such a token appears.
 */
export function parsePositionArea(
  value: string | null | undefined,
  selfDirection: Direction,
  rootDirection: Direction | (() => Direction),
  writingMode: string = "horizontal-tb",
): ResolvedPlacement | null {
  if (writingMode !== "horizontal-tb" || typeof value !== "string") return null;
  const words = value.trim().split(/\s+/);
  if (words.length > 2 || words[0] === "" || words[0] === "none") return null;
  let root: Direction | undefined;
  const rootDir = (): Direction =>
    (root ??= typeof rootDirection === "function" ? rootDirection() : rootDirection);

  const tokens: Token[] = [];
  for (let index = 0; index < words.length; index++) {
    const token = classify(words[index]!, index, words.length, selfDirection, rootDir);
    if (token === null) return null;
    tokens.push(token);
  }

  const sides = tokens.filter((t) => t.kind === "side");
  // No side (the cell over the anchor) or two (a corner): not a placement of the table.
  if (sides.length !== 1) return null;
  const side = sides[0]!.physical!;
  const span = tokens.find((t) => t.kind === "span");
  if (span === undefined) return { side, align: "center" };
  const toward = span.physical!;
  if (AXIS_OF[toward] === AXIS_OF[side]) return null;
  if (AXIS_OF[side] === "y") {
    // Inline-relative: spanning toward the popup's inline-end puts the inline-start edges
    // together.
    const inlineEnd: PhysicalSide = selfDirection === "rtl" ? "left" : "right";
    return { side, align: toward === inlineEnd ? "start" : "end" };
  }
  return { side, align: toward === "bottom" ? "start" : "end" };
}

function classify(
  word: string,
  index: number,
  count: number,
  selfDirection: Direction,
  rootDirection: () => Direction,
): Token | null {
  if (word === "center" || word === "span-all") return { kind: "neutral", physical: null };
  const span = word.startsWith("span-");
  const physical = physicalOf(
    span ? word.slice(5) : word,
    index,
    count,
    selfDirection,
    rootDirection,
  );
  return physical === null ? null : { kind: span ? "span" : "side", physical };
}

/**
 * The physical direction a keyword names, in `horizontal-tb`. Bare `start` / `end` /
 * `self-start` / `self-end` are positional: the block axis first, the inline axis second; alone
 * they name both axes (a corner, or a span over both), which the table does not describe.
 */
function physicalOf(
  name: string,
  index: number,
  count: number,
  selfDirection: Direction,
  rootDirection: () => Direction,
): PhysicalSide | null {
  switch (name) {
    case "top":
    case "bottom":
    case "left":
    case "right":
      return name;
    // The block axis is top / bottom in horizontal-tb, whatever the direction.
    case "y-start":
    case "self-y-start":
    case "y-self-start":
    case "block-start":
    case "self-block-start":
      return "top";
    case "y-end":
    case "self-y-end":
    case "y-self-end":
    case "block-end":
    case "self-block-end":
      return "bottom";
    // The inline axis against the popup's own direction.
    case "self-x-start":
    case "x-self-start":
    case "self-inline-start":
      return inlineEdge("start", selfDirection);
    case "self-x-end":
    case "x-self-end":
    case "self-inline-end":
      return inlineEdge("end", selfDirection);
    // The inline axis against the containing block's (the root's, for a top-layer popup).
    case "x-start":
    case "inline-start":
      return inlineEdge("start", rootDirection());
    case "x-end":
    case "inline-end":
      return inlineEdge("end", rootDirection());
    case "start":
    case "end":
    case "self-start":
    case "self-end": {
      if (count !== 2) return null;
      const edge = name.endsWith("start") ? "start" : "end";
      if (index === 0) return edge === "start" ? "top" : "bottom";
      return inlineEdge(edge, name.startsWith("self-") ? selfDirection : rootDirection());
    }
    default:
      return null;
  }
}

function inlineEdge(edge: "start" | "end", direction: Direction): PhysicalSide {
  return (edge === "start") === (direction === "ltr") ? "left" : "right";
}

// --- Placement at a point (design/components/context-menu.md 4.2, conventions 12, 13.4) -------

/** Custom property carrying the x coordinate of a point-placed popup (viewport px). */
export const MENU_POINT_X = "--menu-point-x";
/** Custom property carrying the y coordinate of a point-placed popup (viewport px). */
export const MENU_POINT_Y = "--menu-point-y";
/**
 * Custom property carrying the vertical gap between the point and the menu: `0px` for a mouse or
 * keyboard open, `16px` for a touch or pen open, which is placed above the finger (#88, 4.7).
 */
export const MENU_POINT_GAP = "--menu-point-gap";
/** The gap of a touch or pen open (context-menu.md 4.7). */
export const MENU_POINT_TOUCH_GAP = "16px";

/** The dedupe key of the shipped rules (`<style href precedence>`). */
export const MENU_POINT_HREF = "@funstack/ui/menu-point";
/**
 * The React stylesheet precedence bucket of the library's functional CSS. Fizz writes every
 * same-precedence `<style>` of one server flush as a single element with the texts concatenated,
 * which would match none of the per-href hashes in `STYLE_SHA256`: at most one shipped stylesheet
 * in this bucket may render during server rendering (today the tooltip skip-delay rule; the menu
 * point rules are client-only). A second one needs a precedence of its own (guard row in
 * `csp/csp.test.tsx`).
 */
export const FSUI_PRECEDENCE = "fsui";

const UP = `top: auto; bottom: calc(100% - var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP}));`;
const DOWN = `bottom: auto; top: calc(var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP}));`;
const LEFT = `left: auto; right: calc(100% - var(${MENU_POINT_X}));`;
const RIGHT = `right: auto; left: var(${MENU_POINT_X});`;

/**
 * The `@position-try` options that mirror a point-placed popup around the point when it does not
 * fit (context-menu.md 4.2, conventions 12). The base position is inline on the popup: the
 * point's y below (mouse, keyboard) or above (touch, pen, with `--menu-point-gap`) the menu and,
 * by the popup's direction, its left (LTR) or right (RTL) edge at the point's x. A menu names the
 * three options that apply to its direction and pointer kind (`MENU_POINT_FALLBACKS`); the others
 * are inert. Functional at-rules with no selectors: no element is styled. `100%` resolves against
 * the viewport, the top layer's containing block, which `clientX` / `clientY` are measured in.
 * Its SHA-256 is `STYLE_SHA256` in `@funstack/ui/csp` (a jsdom row recomputes it).
 */
export const MENU_POINT_RULES =
  "/* @funstack/ui: placement of a menu at a point. Functional only: the base position is inline " +
  "on the popup (below or above the point and, by direction, its left or right edge at the " +
  "point); these options mirror it around the point when it does not fit. */\n" +
  `@position-try --fsui-menu-up { ${UP} }\n` +
  `@position-try --fsui-menu-down { ${DOWN} }\n` +
  `@position-try --fsui-menu-left { ${LEFT} }\n` +
  `@position-try --fsui-menu-right { ${RIGHT} }\n` +
  `@position-try --fsui-menu-up-left { ${UP} ${LEFT} }\n` +
  `@position-try --fsui-menu-up-right { ${UP} ${RIGHT} }\n` +
  `@position-try --fsui-menu-down-left { ${DOWN} ${LEFT} }\n` +
  `@position-try --fsui-menu-down-right { ${DOWN} ${RIGHT} }\n`;

/**
 * Two equivalent spellings of the point fallback list per direction and pointer kind
 * (`MENU_POINT_FALLBACKS[direction][offset ? "touch" : "mouse"][generation % 2]`), alternated by
 * the placement's generation: changing `position-try-fallbacks` clears the remembered "last
 * successful position option", so a re-show at a new point does not keep the previous flip
 * (design 4.3). The first two options are order-independent (only one of them can fix a given
 * overflow). A move that changes direction or pointer kind changes the list either way.
 * Mouse and keyboard: below the point, flipping up and across; touch and pen: above it, flipping
 * across and down (4.7).
 */
export const MENU_POINT_FALLBACKS = {
  ltr: {
    mouse: [
      "--fsui-menu-up, --fsui-menu-left, --fsui-menu-up-left",
      "--fsui-menu-left, --fsui-menu-up, --fsui-menu-up-left",
    ],
    touch: [
      "--fsui-menu-left, --fsui-menu-down, --fsui-menu-down-left",
      "--fsui-menu-down, --fsui-menu-left, --fsui-menu-down-left",
    ],
  },
  rtl: {
    mouse: [
      "--fsui-menu-up, --fsui-menu-right, --fsui-menu-up-right",
      "--fsui-menu-right, --fsui-menu-up, --fsui-menu-up-right",
    ],
    touch: [
      "--fsui-menu-right, --fsui-menu-down, --fsui-menu-down-right",
      "--fsui-menu-down, --fsui-menu-right, --fsui-menu-down-right",
    ],
  },
} as const;
