// Shared conformance suite for the platform paths of the native form groups built on
// `useNativeGroupReconciliation` (RadioGroup, CheckboxGroup, Select): mount reconciliation of the
// hydrated DOM value, form reset (`<button type=reset>`, `form.reset()`, cancelled, to the
// intended value, while disabled, twice while pending), a controlled parent refusing the reset,
// the reset target by mode and React's automatic reset after a form action (conventions 3.8,
// audit T3 in memo/reviewer/refactor-audit-tests.md). It reuses the value-action drivers
// (src/__tests__/drivers/) with three more members. Component-specific platform rows (a `null`
// or placeholder target, values with no Item, members that hydrate after the Root, the Parent)
// stay in the component files.
import { act, render, screen } from "@testing-library/react";
import { StrictMode, startTransition, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  deferred,
  expectNotPending,
  expectPending,
  flushMicrotasks,
  hydrateFromServer,
  renderBoth,
  setupUser,
  silenceErrors,
} from "./helpers.js";
import type { ControlMode } from "./helpers.js";
import { ValueHarness } from "./value-action-suite.js";
import type { ValueActionDriver, ValueHarnessProps } from "./value-action-suite.js";

/** The details of a native group: a `reason` the platform paths set to `"platform"`. */
interface PlatformDetails {
  readonly event: Event | undefined;
  readonly reason: string;
}

export interface NativeGroupPlatformDriver<V, D extends PlatformDetails> extends ValueActionDriver<
  V,
  D
> {
  /** Writes `v` into the server HTML before hydration, the way pre-hydration clicks would. */
  setDomValue(container: HTMLElement, v: V): void;
  /** The serialisable fields of a platform dispatch from the value `from` to `to`. */
  platformDetails(from: V, to: V): Readonly<Record<string, unknown>>;
  /** Asserts the DOM reset target (`defaultChecked`, `defaultSelected`) is `v`. */
  expectResetTarget(v: V): void;
}

export function describeNativeGroupPlatform<V, D extends PlatformDetails>(
  driver: NativeGroupPlatformDriver<V, D>,
): void {
  const { values } = driver;
  const format = driver.format ?? JSON.stringify;
  type ActionFn = (next: V, details: D) => unknown;
  const Harness = (props: Omit<ValueHarnessProps<V, D>, "driver">) => (
    <ValueHarness driver={driver} {...props} />
  );
  const committed = () => screen.getByTestId("committed").textContent;
  const form = () => screen.getByTestId("form") as HTMLFormElement;
  const root = () => driver.queryControl()!;
  /** `[next, reason]` of every call. */
  const summary = (action: { mock: { calls: [V, D][] } }) =>
    action.mock.calls.map(([next, details]) => [next, details.reason]);
  const expectPlatformCall = (
    call: readonly [V, D] | undefined,
    from: V,
    to: V,
    event?: string,
  ) => {
    const [next, details] = call!;
    expect(next).toEqual(to);
    expect(details.reason).toBe("platform");
    expect(details.event?.type).toBe(event);
    expect(JSON.stringify(details)).toBe(JSON.stringify(driver.platformDetails(from, to)));
  };

  describe(`${driver.label ?? driver.name}: native platform conformance`, () => {
    describe("mount reconciliation", () => {
      renderBoth("hydration", (mode) => {
        it("dispatches the hydrated DOM value once with reason platform and no event", async () => {
          const consoleError = silenceErrors();
          const action = vi.fn<ActionFn>();
          await hydrateFromServer(<Harness mode={mode} action={action} forHydration />, {
            mutate: (c) => driver.setDomValue(c, values[1]),
          });
          expect(action).toHaveBeenCalledTimes(1);
          expectPlatformCall(action.mock.calls[0], values[0], values[1]);
          expect(action.mock.calls[0]![1].event).toBeUndefined();
          driver.expectShown(values[1]);
          expect(committed()).toBe(format(values[1]));
          expect(consoleError).not.toHaveBeenCalled();
        });

        it("dispatches once under StrictMode", async () => {
          const action = vi.fn<ActionFn>();
          await hydrateFromServer(
            <StrictMode>
              <Harness mode={mode} action={action} forHydration />
            </StrictMode>,
            { mutate: (c) => driver.setDomValue(c, values[2]) },
          );
          expect(action).toHaveBeenCalledTimes(1);
          expectPlatformCall(action.mock.calls[0], values[0], values[2]);
          driver.expectShown(values[2]);
        });

        it("dispatches nothing when the DOM matches", async () => {
          const action = vi.fn<ActionFn>();
          await hydrateFromServer(<Harness mode={mode} action={action} forHydration />);
          expect(action).not.toHaveBeenCalled();
          driver.expectShown(values[0]);
        });
      });

      it("a controlled parent that refuses gets the DOM back on its value", async () => {
        const action = vi.fn<ActionFn>();
        await hydrateFromServer(<Harness mode="controlled" veto action={action} forHydration />, {
          mutate: (c) => driver.setDomValue(c, values[1]),
        });
        expect(summary(action)).toEqual([[values[1], "platform"]]);
        driver.expectShown(values[0]);
        expect(committed()).toBe(format(values[0]));
      });

      it("createRoot never dispatches on mount", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <StrictMode>
            <Harness mode="uncontrolled" action={action} />
          </StrictMode>,
        );
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();
        driver.expectShown(values[0]);
      });
    });

    renderBoth("form reset", (mode) => {
      it("<button type=reset> dispatches once with the reset event and commits", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} inForm />);
        const user = setupUser();
        await driver.gesture(user, 0);
        await driver.gesture(user, 1);
        expect(committed()).toBe(format(values[2]));
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(3);
        expectPlatformCall(action.mock.calls[2], values[2], values[0], "reset");
        driver.expectShown(values[0]);
        expectNotPending(root());
        expect(committed()).toBe(format(values[0]));
      });

      it("form.reset() dispatches once; the group is pending until the action settles", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>((_next, details) =>
          details.reason === "platform" ? d.promise : undefined,
        );
        render(<Harness mode={mode} action={action} inForm />);
        await driver.gesture(setupUser(), 0);
        await act(async () => {
          form().reset();
        });
        expect(summary(action)).toEqual([
          [values[1], "activate"],
          [values[0], "platform"],
        ]);
        driver.expectShown(values[0]);
        expectPending(root());
        expect(committed()).toBe(format(values[1]));
        await act(async () => {
          d.resolve();
        });
        expectNotPending(root());
        driver.expectShown(values[0]);
        expect(committed()).toBe(format(values[0]));
      });

      it("a cancelled reset dispatches nothing and leaves the DOM", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} inForm />);
        const user = setupUser();
        await driver.gesture(user, 0);
        form().addEventListener("reset", (e) => e.preventDefault());
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(1);
        driver.expectShown(values[1]);
      });

      it("a reset whose target is the intended value dispatches nothing", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} inForm />);
        await setupUser().click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();
        driver.expectShown(values[0]);
      });

      it("a disabled group still follows the reset", async () => {
        const action = vi.fn<ActionFn>();
        function Toggleable() {
          const [disabled, setDisabled] = useState(false);
          return (
            <>
              <Harness mode={mode} action={action} inForm extra={{ disabled }} />
              <button type="button" onClick={() => setDisabled(true)}>
                disable
              </button>
            </>
          );
        }
        render(<Toggleable />);
        const user = setupUser();
        await driver.gesture(user, 0);
        await user.click(screen.getByRole("button", { name: "disable" }));
        expect(root()).toBeDisabled();
        await act(async () => {
          form().reset();
        });
        await flushMicrotasks();
        expect(summary(action)).toEqual([
          [values[1], "activate"],
          [values[0], "platform"],
        ]);
        driver.expectShown(values[0]);
        expect(committed()).toBe(format(values[0]));
      });

      // The base of a reset is the latest in-flight value (conventions 3.8 rule 1), compared with
      // the group's `equals`: a later reset reads the value the first one dispatched.
      it("two synchronous form.reset() calls while a reset is pending dispatch once", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode={mode} action={action} inForm />);
        await driver.gesture(setupUser(), 0);
        await act(async () => {
          form().reset();
          form().reset();
        });
        // A third one in a later task, still while both actions are pending.
        await act(async () => {
          form().reset();
        });
        expect(summary(action)).toEqual([
          [values[1], "activate"],
          [values[0], "platform"],
        ]);
        driver.expectShown(values[0]);
        await act(async () => {
          d.resolve();
        });
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(2);
        driver.expectShown(values[0]);
        expect(committed()).toBe(format(values[0]));
      });
    });

    describe("form reset, controlled parent decides", () => {
      it("a parent that refuses gets the DOM re-synced to its value after settle", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode="controlled" action={action} inForm refusePlatform />);
        const user = setupUser();
        await driver.gesture(user, 0);
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(summary(action)).toEqual([
          [values[1], "activate"],
          [values[0], "platform"],
        ]);
        driver.expectShown(values[1]);
        expectNotPending(root());
        expect(committed()).toBe(format(values[1]));
      });
    });

    describe("reset target by mode", () => {
      it.each([
        ["after a gesture", true],
        ["untouched", false],
      ] as const)(
        "uncontrolled: the reset returns to the latest defaultValue (%s)",
        async (_label, touched) => {
          const action = vi.fn<ActionFn>();
          function Parent() {
            const [def, setDef] = useState(values[0]);
            return (
              <form data-testid="form">
                {driver.render({ defaultValue: def, changeAction: action })}
                <button type="button" onClick={() => startTransition(() => setDef(values[2]))}>
                  new default
                </button>
              </form>
            );
          }
          render(<Parent />);
          driver.expectResetTarget(values[0]);
          const user = setupUser();
          if (touched) await driver.gesture(user, 0);
          await user.click(screen.getByRole("button", { name: "new default" }));
          driver.expectResetTarget(values[2]);
          // Changing the default does not move the current value (even where the browser's own
          // reset target would: an untouched, non-dirty control).
          const current = touched ? values[1] : values[0];
          driver.expectShown(current);
          await act(async () => {
            form().reset();
          });
          await flushMicrotasks();
          expect(summary(action)).toEqual([
            ...(touched ? [[values[1], "activate"]] : []),
            [values[2], "platform"],
          ]);
          expectPlatformCall(action.mock.calls.at(-1), current, values[2], "reset");
          driver.expectShown(values[2]);
        },
      );

      it("controlled: the reset returns to the mount-time value and the parent is notified", async () => {
        const action = vi.fn<ActionFn>();
        function Parent() {
          const [value, setValue] = useState(values[0]);
          return (
            <>
              <form data-testid="form">
                {driver.render({
                  value,
                  changeAction: (next, details) => {
                    action(next, details);
                    setValue(next);
                  },
                })}
              </form>
              <output data-testid="committed">{format(value)}</output>
            </>
          );
        }
        render(<Parent />);
        driver.expectResetTarget(values[0]);
        const user = setupUser();
        await driver.gesture(user, 0);
        await driver.gesture(user, 1);
        driver.expectResetTarget(values[0]);
        await act(async () => {
          form().reset();
        });
        await flushMicrotasks();
        expect(action.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
          [values[1], "activate", driver.eventType(0)],
          [values[2], "activate", driver.eventType(1)],
          [values[0], "platform", "reset"],
        ]);
        driver.expectShown(values[0]);
        expect(committed()).toBe(format(values[0]));
      });
    });

    describe("React's automatic reset after a form action", () => {
      /**
       * A form whose action awaits `submit`. Uncontrolled from values[0], or (`mode` controlled)
       * a parent that adopts every dispatch at once, the platform one included.
       */
      function ActionForm({
        submit,
        action,
        mode = "uncontrolled",
      }: {
        submit: Promise<void>;
        action?: ActionFn;
        mode?: ControlMode;
      }) {
        const [value, setValue] = useState(values[0]);
        return (
          <form
            action={async () => {
              await submit;
            }}
          >
            {driver.render({
              ...(mode === "controlled" ? { value } : { defaultValue: values[0] }),
              ...(action && {
                changeAction: (next: V, details: D) => {
                  action(next, details);
                  if (mode === "controlled") setValue(next);
                },
              }),
              extra: { name: "field" },
            })}
            <button type="submit">Save</button>
          </form>
        );
      }
      async function submitAfterGesture(ui: ReactNode, submit: { resolve(): void }) {
        render(ui);
        const user = setupUser();
        await driver.gesture(user, 0);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => {
          submit.resolve();
        });
        await flushMicrotasks();
        return user;
      }

      renderBoth("with an action", (mode) => {
        it("returns to the default with one dispatch, in sync afterwards", async () => {
          const d = deferred();
          const action = vi.fn<ActionFn>();
          const user = await submitAfterGesture(
            <ActionForm submit={d.promise} action={action} mode={mode} />,
            d,
          );
          expect(action).toHaveBeenCalledTimes(2);
          expectPlatformCall(action.mock.calls[1], values[1], values[0], "reset");
          driver.expectShown(values[0]);
          expectNotPending(root());
          // Still in sync: the same gesture dispatches again.
          await driver.gesture(user, 0);
          driver.expectShown(values[1]);
          expect(action).toHaveBeenCalledTimes(3);
        });
      });

      it("works without a valueChangeAction", async () => {
        const d = deferred();
        const user = await submitAfterGesture(<ActionForm submit={d.promise} />, d);
        driver.expectShown(values[0]);
        await driver.gesture(user, 0);
        driver.expectShown(values[1]);
      });
    });
  });
}
