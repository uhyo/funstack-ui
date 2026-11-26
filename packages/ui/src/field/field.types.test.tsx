import { describe, expectTypeOf, it } from "vitest";
import { Field } from "./index.js";
import type { FieldControlProps } from "./index.js";

/**
 * Type-level checks (design/components/field-form.md 4.3). `expectTypeOf` is a no-op at runtime;
 * `pnpm typecheck` (`tsc` over the test files) makes these fail.
 */
describe("Field.Control props", () => {
  it("accepts id, which a plain control outside a Field.Root renders", () => {
    expectTypeOf<FieldControlProps["id"]>().toEqualTypeOf<string | undefined>();
    void (<Field.Control id="q" aria-label="Search" />);
  });

  it("has no children", () => {
    // @ts-expect-error an <input> is void
    void (<Field.Control>x</Field.Control>);
  });
});
