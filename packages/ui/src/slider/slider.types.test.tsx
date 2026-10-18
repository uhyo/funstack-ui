import { describe, expectTypeOf, it } from "vitest";
import { Slider } from "./index.js";
import type {
  SliderRootProps,
  SliderRootState,
  SliderThumbProps,
  SliderValue,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
} from "./index.js";

/**
 * Type-level checks for the value shape of `Slider.Root` (design 3.1, 9.4). `expectTypeOf` is a
 * no-op at runtime; `pnpm typecheck` and vitest's typecheck make these fail.
 */
describe("SliderRootProps", () => {
  it("infers readonly number[] from an array defaultValue", () => {
    const element = (
      <Slider.Root
        defaultValue={[20, 80]}
        valueChangeAction={(next, details) => {
          expectTypeOf(next).toEqualTypeOf<readonly number[]>();
          expectTypeOf(details).toEqualTypeOf<SliderValueChangeDetails>();
        }}
        valueCommitAction={(next, details) => {
          expectTypeOf(next).toEqualTypeOf<readonly number[]>();
          expectTypeOf(details).toEqualTypeOf<SliderValueCommitDetails>();
        }}
      >
        {(state) => {
          expectTypeOf(state).toEqualTypeOf<SliderRootState<readonly number[]>>();
          return null;
        }}
      </Slider.Root>
    );
    void element;
  });

  it("infers number from a number value and from neither", () => {
    const controlled = (
      <Slider.Root
        value={40}
        valueChangeAction={(next) => {
          expectTypeOf(next).toEqualTypeOf<number>();
        }}
      />
    );
    const bare = (
      <Slider.Root
        valueCommitAction={(next) => {
          expectTypeOf(next).toEqualTypeOf<number>();
        }}
      />
    );
    void [controlled, bare];
  });

  it("has no transition, required or aria-valuenow prop", () => {
    expectTypeOf<SliderRootProps>().not.toHaveProperty("transition");
    expectTypeOf<SliderRootProps>().not.toHaveProperty("required");
    expectTypeOf<SliderRootProps>().not.toHaveProperty("role");
    // @ts-expect-error -- no `transition` prop on any part (design 11)
    void (<Slider.Root transition="x" />);
    // @ts-expect-error -- a range is never invalid
    void (<Slider.Root required />);
    // The input's value attributes are the platform's. (JSX does not type-check hyphenated
    // attribute names absent from the props, so this is asserted on the props types.)
    expectTypeOf<SliderThumbProps>().not.toHaveProperty("aria-valuenow");
    expectTypeOf<SliderThumbProps>().not.toHaveProperty("aria-valuemin");
    expectTypeOf<SliderThumbProps>().not.toHaveProperty("aria-orientation");
    expectTypeOf<SliderRootProps>().not.toHaveProperty("aria-valuenow");
    expectTypeOf<SliderThumbProps>().toHaveProperty("aria-label");
    // @ts-expect-error -- no `transition` on a Thumb either
    void (<Slider.Thumb transition="x" />);
  });
});

describe("Slider.Value / Slider.Label state", () => {
  it("is not tied to the Root: `value` is a number or an array unless narrowed", () => {
    const element = (
      <Slider.Root defaultValue={[20, 80]} aria-label="Price">
        <Slider.Value>
          {(state) => {
            expectTypeOf(state.value).toEqualTypeOf<SliderValue>();
            expectTypeOf(state.values).toEqualTypeOf<readonly number[]>();
            return null;
          }}
        </Slider.Value>
        {/* @ts-expect-error -- `value` may be an array: narrow it or read `values` */}
        <Slider.Value>{({ value }) => value.toFixed(0)}</Slider.Value>
        <Slider.Value<number>>{({ value }) => value.toFixed(0)}</Slider.Value>
        <Slider.Label
          className={(state) => {
            expectTypeOf(state.value).toEqualTypeOf<SliderValue>();
            return undefined;
          }}
        />
      </Slider.Root>
    );
    void element;
  });
});
