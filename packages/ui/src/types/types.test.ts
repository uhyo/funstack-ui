import { describe, expectTypeOf, it } from "vitest";
import type * as root from "../index.js";
import type * as types from "./index.js";

/**
 * `@funstack/ui/types` and the root entry export the same shared types (conventions 9.2).
 * `expectTypeOf` is a no-op at runtime; `pnpm typecheck` is what makes these fail.
 */
describe("@funstack/ui/types", () => {
  it("exports each shared type identical to the root entry's", () => {
    expectTypeOf<types.Action<[number]>>().toEqualTypeOf<root.Action<[number]>>();
    expectTypeOf<types.ActionDetails>().toEqualTypeOf<root.ActionDetails>();
    expectTypeOf<types.ChangeAction<string>>().toEqualTypeOf<root.ChangeAction<string>>();
    expectTypeOf<types.ChangeReason>().toEqualTypeOf<root.ChangeReason>();
    expectTypeOf<types.RenderProp<{ id: string }, { open: boolean }>>().toEqualTypeOf<
      root.RenderProp<{ id: string }, { open: boolean }>
    >();
    expectTypeOf<types.StateValue<string, { open: boolean }>>().toEqualTypeOf<
      root.StateValue<string, { open: boolean }>
    >();
    expectTypeOf<types.UrgentChangeHandler<string>>().toEqualTypeOf<
      root.UrgentChangeHandler<string>
    >();
    expectTypeOf<types.UrgentHandler>().toEqualTypeOf<root.UrgentHandler>();
    expectTypeOf<types.WhilePending>().toEqualTypeOf<root.WhilePending>();
  });

  it("exports no value", () => {
    expectTypeOf<keyof typeof types>().toEqualTypeOf<never>();
  });
});
