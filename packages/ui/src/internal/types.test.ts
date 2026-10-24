import { describe, expectTypeOf, it } from "vitest";
import type { Action, ActionDetails, ChangeAction, UrgentChangeHandler } from "./types.js";
// @ts-expect-error renamed `UrgentChangeHandler` (#96): no deprecated alias may come back.
import type { UrgentChangeAction } from "../index.js";

/**
 * Type-level checks for the action signatures (conventions 2.2). `expectTypeOf` is a no-op at
 * runtime; `pnpm typecheck` (`tsc` over the test files) is what makes these fail.
 */
describe("Action types", () => {
  it("accepts sync, async and non-void returning callbacks", () => {
    const save = (_next: boolean): Promise<Response> => Promise.resolve(new Response());
    const saveSync = (_next: boolean): number => 1;

    const asyncData: ChangeAction<boolean> = (next) => save(next);
    const asyncArrow: ChangeAction<boolean> = async (next) => save(next);
    const syncData: ChangeAction<boolean> = (next) => saveSync(next);
    const syncVoid: ChangeAction<boolean> = (next) => {
      void next;
    };
    const asyncVoid: ChangeAction<boolean> = async () => {};

    expectTypeOf(asyncData).toMatchTypeOf<ChangeAction<boolean>>();
    expectTypeOf(asyncArrow).toMatchTypeOf<ChangeAction<boolean>>();
    expectTypeOf(syncData).toMatchTypeOf<ChangeAction<boolean>>();
    expectTypeOf(syncVoid).toMatchTypeOf<ChangeAction<boolean>>();
    expectTypeOf(asyncVoid).toMatchTypeOf<ChangeAction<boolean>>();
  });

  it("returns unknown and receives (next, details)", () => {
    expectTypeOf<Action>().returns.toBeUnknown();
    expectTypeOf<ChangeAction<string>>().parameters.toEqualTypeOf<
      [next: string, details: ActionDetails]
    >();
    expectTypeOf<ActionDetails["event"]>().toEqualTypeOf<Event | undefined>();
  });

  it("UrgentChangeHandler is synchronous: (next, details) => void", () => {
    expectTypeOf<UrgentChangeHandler<string>>().parameters.toEqualTypeOf<
      [next: string, details: ActionDetails]
    >();
    expectTypeOf<UrgentChangeHandler<string>>().returns.toBeVoid();
    // A plain state setter fits (the controlled text input case).
    const setText = (_next: string): void => {};
    const urgent: UrgentChangeHandler<string> = (next) => setText(next);
    void urgent;
    // The removed name resolves to nothing (the import above is a type error).
    expectTypeOf<UrgentChangeAction>().toBeAny();
  });

  it("rejects a callback whose parameters do not fit", () => {
    // @ts-expect-error `next` is a boolean, not a string.
    const wrong: ChangeAction<boolean> = (next: string) => next;
    void wrong;
  });
});
