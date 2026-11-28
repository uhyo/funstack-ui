import { describe, expectTypeOf, it } from "vitest";
import { Accordion } from "./index.js";
import type { Rejectable } from "../internal/types.js";
import type {
  AccordionItemState,
  AccordionPanelState,
  AccordionRootBaseProps,
  AccordionRootExclusiveProps,
  AccordionRootMultipleProps,
  AccordionRootProps,
  AccordionRootState,
  AccordionTriggerProps,
  AccordionValueChangeDetails,
} from "./index.js";

/**
 * Type-level checks for the `exclusive` discrimination of `AccordionRootProps` (design 3.1).
 * `expectTypeOf` is a no-op at runtime; `pnpm typecheck` (`tsc` over the test files) makes
 * these fail.
 */
describe("AccordionRootProps", () => {
  it("narrows `next` and `value` on `exclusive`", () => {
    const multiple = (
      <Accordion.Root
        value={["a"]}
        defaultValue={[]}
        valueChangeAction={(next, details) => {
          expectTypeOf(next).toEqualTypeOf<string[]>();
          expectTypeOf(details).toEqualTypeOf<AccordionValueChangeDetails & Rejectable>();
        }}
      />
    );
    const exclusive = (
      <Accordion.Root
        exclusive
        value="a"
        defaultValue={null}
        valueChangeAction={(next) => {
          expectTypeOf(next).toEqualTypeOf<string | null>();
        }}
      />
    );
    const explicitlyMultiple = (
      <Accordion.Root
        exclusive={false}
        valueChangeAction={(next) => {
          expectTypeOf(next).toEqualTypeOf<string[]>();
        }}
      />
    );
    void [multiple, exclusive, explicitlyMultiple];
  });

  it("rejects the other variant's value shapes", () => {
    // @ts-expect-error `exclusive` takes a single item, not an array.
    const a = <Accordion.Root exclusive value={["a"]} />;
    // @ts-expect-error multiple mode takes an array, not a single item.
    const b = <Accordion.Root value="a" />;
    // @ts-expect-error multiple mode takes an array, not null.
    const c = <Accordion.Root defaultValue={null} />;
    // @ts-expect-error the action's `next` is typed by the variant.
    const d = <Accordion.Root exclusive valueChangeAction={(next: string[]) => void next} />;
    void [a, b, c, d];
  });

  it("accepts a dynamic boolean `exclusive` in JS-free mode only", () => {
    const flag = Math.random() > 0.5;
    const jsFree = <Accordion.Root exclusive={flag} />;
    // @ts-expect-error with a value, the variant must be known statically.
    const withValue = <Accordion.Root exclusive={flag} value={["a"]} />;
    void [jsFree, withValue];
  });

  it("details are the set diff; set-valued props take readonly arrays; base and variants exported", () => {
    expectTypeOf<AccordionValueChangeDetails["added"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<AccordionValueChangeDetails["removed"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<AccordionValueChangeDetails>().not.toHaveProperty("item");
    expectTypeOf<AccordionValueChangeDetails>().not.toHaveProperty("open");
    const open: readonly string[] = ["a"];
    const el = <Accordion.Root value={open} defaultValue={open} loop={false} />;
    const base: AccordionRootBaseProps = { loop: true, disabled: false };
    const multiple: AccordionRootMultipleProps = { value: open };
    const exclusive: AccordionRootExclusiveProps = { exclusive: true, value: null };
    void [el, base, multiple, exclusive];
  });

  it("state: `value` on the Root, `open` is a boolean (conventions 4.1 rule 3)", () => {
    expectTypeOf<AccordionRootState["value"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<AccordionItemState["open"]>().toEqualTypeOf<boolean>();
    expectTypeOf<AccordionPanelState["open"]>().toEqualTypeOf<boolean>();
  });

  it("the Trigger has no `transition` and does not take `aria-disabled` (conventions 1.5, 5.1)", () => {
    // @ts-expect-error Everything a Trigger renders is optimistic: no `transition`.
    const withTransition: AccordionTriggerProps = { transition: "fade" };
    // @ts-expect-error `aria-disabled` is owned: use `disabled` on the Item or Root.
    const withAriaDisabled: AccordionTriggerProps = { "aria-disabled": true };
    void [withTransition, withAriaDisabled];
  });

  it("accepts non-void action return values (conventions 2.2)", () => {
    const save = (_next: string[]): Promise<Response> => Promise.resolve(new Response());
    const el = <Accordion.Root valueChangeAction={(next) => save(next)} />;
    const props: AccordionRootProps = { valueChangeAction: (next) => save(next) };
    void [el, props];
  });
});
