// The browser row "a mount in a transition starts no view transition without `transition`, one
// with `none`" (#106, audit T7), shared by the parts that take a `transition` prop. Browser tests
// only: it counts real `document.startViewTransition` calls.
import { render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { expect, it } from "vitest";
import { outsideAct, spyViewTransitions } from "./browser-helpers.js";

export interface LateMountConfig {
  /** The part under test, given `{}` or `{ transition }`. */
  readonly late: (props: { transition?: ViewTransitionClass }) => ReactNode;
  /** Places the late part (a group Root around it). Default: as is. */
  readonly wrap?: (late: ReactNode) => ReactNode;
  /** The late part once mounted (a query that returns `null` before). */
  readonly mounted: () => Element | null;
}

/**
 * Mounts `late` in a transition (a click on a "show" button whose handler sets state inside
 * `startTransition`) and returns how many view transitions started. The click and the commit run
 * outside React's act environment: a view transition commits in its callback, after any `act`
 * scope has returned (issue #49).
 */
export async function countLateMountViewTransitions(
  transition: ViewTransitionClass | undefined,
  { late, wrap = (part) => part, mounted }: LateMountConfig,
): Promise<number> {
  const vt = spyViewTransitions();
  function Late() {
    const [shown, setShown] = useState(false);
    return (
      <>
        <button type="button" onClick={() => startTransition(() => setShown(true))}>
          show
        </button>
        {wrap(shown && late(transition === undefined ? {} : { transition }))}
      </>
    );
  }
  const { unmount } = render(<Late />);
  await outsideAct(async () => {
    screen.getByRole("button", { name: "show" }).click();
    await expect.poll(mounted).not.toBeNull();
  });
  unmount();
  vt.restore();
  return vt.calls();
}

/**
 * The row: without `transition` the part adds no ViewTransition boundary, so a mount starts no
 * view transition; with `transition="none"` it has one, and react-dom 19.3 starts one for the
 * mount (transition-boundary.tsx, issue #35).
 */
export function itStartsNoViewTransitionOnMount(config: LateMountConfig): void {
  it("a mount in a transition starts no view transition without `transition`, one with `none`", async () => {
    expect(await countLateMountViewTransitions(undefined, config)).toBe(0);
    expect(await countLateMountViewTransitions("none", config)).toBe(1);
  });
}
