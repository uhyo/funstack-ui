import { describe, expectTypeOf, it } from "vitest";
import { Meter } from "../meter/index.js";
import type { MeterRegion, MeterRootProps, MeterState } from "../meter/index.js";
import { Progress } from "./index.js";
import type { ProgressRootProps, ProgressState } from "./index.js";

/**
 * Type-level checks (design/components/progress.md 12.1 "Types"). `expectTypeOf` is a no-op at
 * runtime; `pnpm typecheck` (`tsc` over the test files) makes these fail.
 */
describe("Progress / Meter props", () => {
  it("value is optional on Progress.Root and required on Meter.Root", () => {
    expectTypeOf<ProgressRootProps["value"]>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<MeterRootProps["value"]>().toEqualTypeOf<number>();
    void (<Progress.Root aria-label="Loading" />);
    // @ts-expect-error a meter always has a value
    void (<Meter.Root aria-label="Storage" />);
  });

  it("has no transition, defaultValue or valueChangeAction", () => {
    // @ts-expect-error no transition prop
    void (<Progress.Root transition="none" />);
    // Controlled only: the DOM `defaultValue` / `defaultChecked` would do nothing on a `div`.
    // @ts-expect-error no defaultValue
    void (<Progress.Root defaultValue={3} />);
    // @ts-expect-error no defaultValue
    void (<Meter.Root value={1} defaultValue={3} />);
    // @ts-expect-error no defaultChecked
    void (<Progress.Root defaultChecked />);
    // @ts-expect-error output-only: no action
    void (<Meter.Root value={1} valueChangeAction={() => {}} />);
    // @ts-expect-error owned
    void (<Progress.Root role="status" />);
  });

  it("getAriaValueText receives the component's state", () => {
    void (
      <Progress.Root
        getAriaValueText={(value, state) => {
          expectTypeOf(value).toEqualTypeOf<number | null>();
          expectTypeOf(state).toEqualTypeOf<ProgressState>();
          return null;
        }}
      />
    );
    void (
      <Meter.Root
        value={1}
        getAriaValueText={(value, state) => {
          expectTypeOf(value).toEqualTypeOf<number>();
          expectTypeOf(state).toEqualTypeOf<MeterState>();
          expectTypeOf(state.region).toEqualTypeOf<MeterRegion>();
          return undefined;
        }}
      />
    );
  });

  it("MeterRegion is the platform's three names", () => {
    expectTypeOf<MeterRegion>().toEqualTypeOf<"optimum" | "suboptimum" | "even-less-good">();
  });
});
