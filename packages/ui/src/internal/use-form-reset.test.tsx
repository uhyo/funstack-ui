import { act, render, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, setupUser } from "../__tests__/helpers.js";
import { useFormReset } from "./use-form-reset.js";

interface Seen {
  readonly type: string;
  readonly checked: boolean;
  readonly sameEvent: boolean;
}

/** An uncontrolled checkbox whose form owner is followed by `useFormReset`. */
function Probe({
  onReset,
  form,
  tick = 0,
}: {
  onReset: (event: Event, el: HTMLInputElement) => void;
  form?: string;
  tick?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useFormReset(ref, (event) => onReset(event, ref.current!));
  return <input ref={ref} type="checkbox" aria-label="probe" form={form} data-tick={tick} />;
}

const probe = () => screen.getByLabelText("probe") as HTMLInputElement;
const flush = () => act(async () => {});

describe("useFormReset", () => {
  it("calls onReset in a microtask after the reset, with the reset event", async () => {
    const seen: Seen[] = [];
    let listenerEvent: Event | undefined;
    render(
      <form data-testid="form">
        <Probe
          onReset={(event, el) =>
            seen.push({ type: event.type, checked: el.checked, sameEvent: event === listenerEvent })
          }
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    form.addEventListener("reset", (e) => {
      listenerEvent = e;
    });
    probe().checked = true;
    form.reset();
    // Not synchronously: the reset event precedes the reset algorithm.
    expect(seen).toEqual([]);
    await flush();
    expect(seen).toEqual([{ type: "reset", checked: false, sameEvent: true }]);
  });

  it("does nothing for a cancelled reset", async () => {
    const onReset = vi.fn();
    render(
      <form data-testid="form">
        <Probe onReset={onReset} />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    form.addEventListener("reset", (e) => e.preventDefault());
    probe().checked = true;
    form.reset();
    await flush();
    expect(onReset).not.toHaveBeenCalled();
    expect(probe().checked).toBe(true);
  });

  it("does not re-subscribe on an ordinary re-render", () => {
    const { rerender } = render(
      <form data-testid="form">
        <Probe onReset={() => {}} tick={0} />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const add = vi.spyOn(form, "addEventListener");
    const remove = vi.spyOn(form, "removeEventListener");
    for (let tick = 1; tick < 4; tick++) {
      rerender(
        <form data-testid="form">
          <Probe onReset={() => {}} tick={tick} />
        </form>,
      );
    }
    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("sees React's automatic reset after a form action, even when re-rendered in that commit", async () => {
    const d = deferred();
    const onReset = vi.fn();
    function App() {
      const [tick, setTick] = useState(0);
      return (
        <form
          action={async () => {
            await d.promise;
            // Re-render the probe in the same commit as the reset: a subscription that followed
            // every commit would be between cleanup and re-subscription when the reset runs.
            setTick((t) => t + 1);
          }}
        >
          <Probe onReset={onReset} tick={tick} />
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<App />);
    const user = setupUser();
    await user.click(probe());
    expect(probe().checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {
      d.resolve();
    });
    await flush();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(probe().checked).toBe(false);
    expect(probe().dataset["tick"]).toBe("1");
  });

  it("follows a changed form owner", async () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <>
        <form id="a" data-testid="a" />
        <form id="b" data-testid="b" />
        <Probe onReset={onReset} form="a" />
      </>,
    );
    const a = screen.getByTestId("a") as HTMLFormElement;
    const b = screen.getByTestId("b") as HTMLFormElement;
    a.reset();
    await flush();
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <form id="a" data-testid="a" />
        <form id="b" data-testid="b" />
        <Probe onReset={onReset} form="b" />
      </>,
    );
    a.reset();
    await flush();
    expect(onReset).toHaveBeenCalledTimes(1);
    b.reset();
    await flush();
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it("works without a form owner and subscribes when one appears", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<Probe onReset={onReset} form="later" />);
    rerender(
      <>
        <form id="later" data-testid="later" />
        <Probe onReset={onReset} form="later" />
      </>,
    );
    (screen.getByTestId("later") as HTMLFormElement).reset();
    await flush();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount", async () => {
    const onReset = vi.fn();
    function App({ show }: { show: boolean }) {
      return <form data-testid="form">{show && <Probe onReset={onReset} />}</form>;
    }
    const { rerender } = render(<App show />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    rerender(<App show={false} />);
    form.reset();
    await flush();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("calls onReset once per reset under StrictMode", async () => {
    const onReset = vi.fn();
    render(
      <StrictMode>
        <form data-testid="form">
          <Probe onReset={onReset} />
        </form>
      </StrictMode>,
    );
    (screen.getByTestId("form") as HTMLFormElement).reset();
    await flush();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("uses the latest onReset", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <form data-testid="form">
        <Probe onReset={first} />
      </form>,
    );
    rerender(
      <form data-testid="form">
        <Probe onReset={second} />
      </form>,
    );
    (screen.getByTestId("form") as HTMLFormElement).reset();
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("accepts a <fieldset> as the form-associated element", async () => {
    const onReset = vi.fn();
    function FieldsetProbe() {
      const ref = useRef<HTMLFieldSetElement>(null);
      useFormReset(ref, onReset);
      return <fieldset ref={ref} />;
    }
    render(
      <form data-testid="form">
        <FieldsetProbe />
      </form>,
    );
    (screen.getByTestId("form") as HTMLFormElement).reset();
    await flush();
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
