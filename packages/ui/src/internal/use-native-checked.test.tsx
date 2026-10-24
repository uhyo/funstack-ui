import { act, render, screen } from "@testing-library/react";
import { StrictMode, startTransition, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { guardCheckableChange, useNativeChecked } from "./use-native-checked.js";
import type { UseNativeCheckedOptions } from "./use-native-checked.js";
import { flushMicrotasks, hydrateFromServer, silenceErrors } from "../__tests__/helpers.js";

type ProbeProps = Partial<UseNativeCheckedOptions> & {
  as?: "input" | "button";
  inputType?: string;
  tick?: number;
};

/** A controlled input wired only through the hook (no library state machine). */
function Probe({ as = "input", inputType = "checkbox", tick = 0, ...options }: ProbeProps) {
  const checked = options.checked ?? false;
  const ref = useNativeChecked({
    type: "checkbox",
    component: "Probe",
    defaultChecked: undefined,
    ...options,
    checked,
  });
  if (as === "button") return <button ref={ref as never} aria-label="probe" />;
  return (
    <input
      ref={ref}
      aria-label="probe"
      type={inputType}
      checked={checked}
      onChange={() => {}}
      data-tick={tick}
    />
  );
}

const probe = () => screen.getByLabelText("probe") as HTMLInputElement;

const hydrate = (ui: ReactNode, mutate: (el: HTMLInputElement) => void) =>
  hydrateFromServer(ui, { mutate: (c) => mutate(c.querySelector("input")!) });

describe("useNativeChecked", () => {
  describe("element check (dev)", () => {
    it("warns once when the node is not an input of the expected type", () => {
      const consoleError = silenceErrors();
      const { rerender } = render(<Probe as="button" />);
      rerender(<Probe as="button" tick={1} />);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(
        /^Probe: expected to render an `<input type="checkbox">` but got `<button>`/,
      );
    });

    it("warns for an input of the wrong type", () => {
      const consoleError = silenceErrors();
      render(<Probe inputType="radio" />);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/but got `<input type="radio">`/);
    });

    it("does not warn for the right element", () => {
      const consoleError = silenceErrors();
      render(<Probe />);
      render(<Probe type="radio" inputType="radio" />);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("re-apply after every commit", () => {
    it("mirrors defaultChecked into the DOM when given and leaves it alone otherwise", () => {
      const { rerender } = render(<Probe checked defaultChecked={false} />);
      expect(probe().defaultChecked).toBe(false);
      rerender(<Probe checked defaultChecked />);
      expect(probe().defaultChecked).toBe(true);
      rerender(<Probe checked defaultChecked={undefined} tick={1} />);
      expect(probe().defaultChecked).toBe(true);
    });

    it("sets indeterminate when given and re-applies it after the browser cleared it", () => {
      const { rerender } = render(<Probe indeterminate />);
      expect(probe().indeterminate).toBe(true);
      probe().indeterminate = false;
      rerender(<Probe indeterminate tick={1} />);
      expect(probe().indeterminate).toBe(true);
      rerender(<Probe indeterminate={false} tick={2} />);
      expect(probe().indeterminate).toBe(false);
    });

    it("re-applies checked (the in-flight value first) after a commit", () => {
      const { rerender } = render(<Probe checked={false} />);
      // Writing behind React's back (the preventDefault() desync).
      probe().checked = true;
      rerender(<Probe checked={false} tick={1} />);
      expect(probe().checked).toBe(false);
      rerender(<Probe checked={false} latestInFlight={() => ({ next: true })} tick={2} />);
      expect(probe().checked).toBe(true);
    });

    it("writing defaultChecked after a reset does not leave checked wrong", () => {
      const { rerender } = render(
        <form>
          <Probe checked={false} defaultChecked={false} />
        </form>,
      );
      probe().form!.reset(); // clears the dirty-checkedness flag
      rerender(
        <form>
          <Probe checked={false} defaultChecked tick={1} />
        </form>,
      );
      expect(probe().defaultChecked).toBe(true);
      expect(probe().checked).toBe(false);
    });

    it("re-apply order: defaultChecked before checked, for React's reset inside the same commit", async () => {
      // React's automatic reset after a <form action> runs in the commit's mutation phase, after
      // react-dom wrote `checked` and before this hook's layout effect. The reset clears the
      // dirty-checkedness flag, so the hook's `defaultChecked` write (the new default, changed in
      // the same transition) also moves `checked`. Only a `checked` write after it restores the
      // intended value; with `checked` first, that write is skipped (it still matches) and the DOM
      // ends up on the new default. Fails if the order in the re-apply effect changes.
      function SettingsForm() {
        const [def, setDef] = useState(false);
        return (
          <form
            action={async () => {
              await Promise.resolve();
              startTransition(() => setDef(true));
            }}
          >
            <Probe checked={false} defaultChecked={def} group />
            <button type="submit">Save</button>
          </form>
        );
      }
      render(<SettingsForm />);
      await act(async () => {
        screen.getByRole("button", { name: "Save" }).click();
      });
      await flushMicrotasks();
      expect(probe().defaultChecked).toBe(true);
      expect(probe().checked).toBe(false);
    });

    it("re-apply order: indeterminate survives the checked and defaultChecked writes", () => {
      const { rerender } = render(
        <form>
          <Probe checked={false} defaultChecked={false} indeterminate />
        </form>,
      );
      probe().form!.reset();
      rerender(
        <form>
          <Probe checked defaultChecked indeterminate tick={1} />
        </form>,
      );
      expect(probe().checked).toBe(true);
      expect(probe().defaultChecked).toBe(true);
      expect(probe().indeterminate).toBe(true);
    });
  });

  describe("group members: onItemMounted", () => {
    it("is called once from the mount commit with group: true, not on later commits", () => {
      const onItemMounted = vi.fn();
      const { rerender } = render(<Probe group onItemMounted={onItemMounted} />);
      expect(onItemMounted).toHaveBeenCalledTimes(1);
      rerender(<Probe group onItemMounted={onItemMounted} checked tick={1} />);
      expect(onItemMounted).toHaveBeenCalledTimes(1);
    });

    it("is called again for StrictMode's re-run of the mount effects", () => {
      // The group adapter dedupes; see use-native-group-reconciliation.test.tsx.
      const onItemMounted = vi.fn();
      render(
        <StrictMode>
          <Probe group onItemMounted={onItemMounted} />
        </StrictMode>,
      );
      expect(onItemMounted).toHaveBeenCalledTimes(2);
    });

    it("is never called for a single control", () => {
      const onItemMounted = vi.fn();
      render(<Probe onItemMounted={onItemMounted} />);
      expect(onItemMounted).not.toHaveBeenCalled();
    });
  });

  // What a component shows of the single-control paths (the hydrated value dispatched once, the
  // reset event, no dispatch when they match) is in src/__tests__/checkable-input-suite.tsx (rows
  // 20-22, Checkbox and Switch); these rows keep what only the hook options reach (audit T13).
  describe("mount reconciliation (single control)", () => {
    it("compares against the in-flight value, not only the optimistic one", async () => {
      const onPlatformChange = vi.fn();
      await hydrate(
        <Probe
          checked={false}
          latestInFlight={() => ({ next: true })}
          onPlatformChange={onPlatformChange}
        />,
        (el) => {
          el.checked = true;
        },
      );
      expect(onPlatformChange).not.toHaveBeenCalled();
    });

    it("never reports for createRoot or with group: true", async () => {
      const onPlatformChange = vi.fn();
      render(<Probe checked onPlatformChange={onPlatformChange} />);
      await hydrate(<Probe checked={false} group onPlatformChange={onPlatformChange} />, (el) => {
        el.checked = true;
      });
      expect(onPlatformChange).not.toHaveBeenCalled();
      // Control: the same hydration without `group` reports once, with no event.
      await hydrate(<Probe checked={false} onPlatformChange={onPlatformChange} />, (el) => {
        el.checked = true;
      });
      expect(onPlatformChange.mock.calls).toEqual([[true, undefined]]);
    });

    it("group: true leaves the hydrated checked value in the mount commit, even under StrictMode", async () => {
      // The group Root reconciles in its own layout effect, after its members' effects.
      await hydrate(
        <StrictMode>
          <Probe checked={false} group />
        </StrictMode>,
        (el) => {
          el.checked = true;
        },
      );
      expect(probe().checked).toBe(true);
    });
  });

  describe("form reset (single control)", () => {
    function Controlled({
      onPlatformChange,
      group = false,
    }: {
      onPlatformChange: (next: boolean, event: Event | undefined) => void;
      group?: boolean;
    }) {
      const [checked, setChecked] = useState(false);
      return (
        <form data-testid="form">
          <Probe checked={checked} group={group} onPlatformChange={onPlatformChange} />
          <button type="button" onClick={() => setChecked((c) => !c)}>
            flip
          </button>
        </form>
      );
    }

    it("never reports with group: true", async () => {
      // Control first: without `group` the same flip and reset report `false` with the event.
      for (const group of [false, true]) {
        const onPlatformChange = vi.fn();
        const { unmount } = render(
          <Controlled onPlatformChange={onPlatformChange} group={group} />,
        );
        await act(async () => {
          screen.getByRole("button", { name: "flip" }).click();
        });
        (screen.getByTestId("form") as HTMLFormElement).reset();
        await flushMicrotasks();
        if (group) {
          expect(onPlatformChange).not.toHaveBeenCalled();
        } else {
          expect(onPlatformChange).toHaveBeenCalledTimes(1);
          expect(onPlatformChange.mock.calls[0]![0]).toBe(false);
          expect((onPlatformChange.mock.calls[0]![1] as Event).type).toBe("reset");
        }
        unmount();
      }
    });
  });
});

describe("guardCheckableChange", () => {
  it("does not dispatch for an already-cancelled event", () => {
    const dispatch = vi.fn();
    const event = new Event("click", { cancelable: true });
    event.preventDefault();
    guardCheckableChange(event, dispatch, "X");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches, and warns once per element when the dispatch cancelled the event", () => {
    const consoleError = silenceErrors();
    const target = document.createElement("input");
    const fire = (cancel: boolean) => {
      const dispatch = vi.fn(() => {
        if (cancel) event.preventDefault();
      });
      const event = new Event("click", { cancelable: true });
      target.addEventListener("click", () => guardCheckableChange(event, dispatch, "X"), {
        once: true,
      });
      target.dispatchEvent(event);
      return dispatch;
    };
    expect(fire(false)).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    expect(fire(true)).toHaveBeenCalledTimes(1);
    expect(fire(true)).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toMatch(/^X: `preventDefault\(\)` on the change event/);
  });
});
