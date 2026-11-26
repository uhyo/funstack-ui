import { describe, expectTypeOf, it } from "vitest";
import { Separator } from "./index.js";
import type { SeparatorOrientation, SeparatorProps, SeparatorState } from "./index.js";

/**
 * Type-level checks (design/components/separator.md 3). `expectTypeOf` is a no-op at runtime;
 * `pnpm typecheck` (`tsc` over the test files) makes these fail.
 */
describe("Separator props", () => {
  it("orientation and decorative; the state carries both", () => {
    expectTypeOf<SeparatorProps["orientation"]>().toEqualTypeOf<SeparatorOrientation | undefined>();
    expectTypeOf<SeparatorState>().toEqualTypeOf<{
      readonly orientation: SeparatorOrientation;
      readonly decorative: boolean;
    }>();
    void (<Separator orientation="vertical" decorative />);
    // @ts-expect-error not an orientation
    void (<Separator orientation="diagonal" />);
  });

  it("has no role or children", () => {
    // `aria-orientation` is omitted from the type too, but TSX never checks a hyphenated name.
    // @ts-expect-error `decorative` is the spelling of role="none"
    void (<Separator role="none" />);
    // @ts-expect-error an <hr> is void
    void (<Separator>or</Separator>);
  });
});
