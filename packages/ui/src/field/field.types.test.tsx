import { describe, expectTypeOf, it } from "vitest";
import { Form } from "../form/index.js";
import type { FormSubmitProps } from "../form/index.js";
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

// Event handlers the part passes to its element are omitted (conventions 1.5).
describe("owned handlers and keys", () => {
  it("Field.Label: onClick (the button-control focus)", () => {
    // @ts-expect-error owned: the label cancels activation and focuses a button control
    void (<Field.Label onClick={() => {}}>Name</Field.Label>);
  });

  it("Form.Submit: onClick (while disabled) and aria-disabled (a non-button render)", () => {
    // @ts-expect-error owned: the click is cancelled while disabled
    void (<Form.Submit onClick={() => {}}>Save</Form.Submit>);
    // Hyphenated: TSX does not check it in JSX, so the row is an object literal.
    // @ts-expect-error owned: use `disabled`
    const props: FormSubmitProps = { "aria-disabled": true };
    void props;
  });
});
