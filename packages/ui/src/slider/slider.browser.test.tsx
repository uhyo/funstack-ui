// Slider rows that need a real engine (design/components/slider.md 14.2): native key stepping
// (Arrow, Page, Home / End, RTL mirroring, neighbour bounds), the vertical writing mode and the
// ArrowLeft / ArrowRight normalisation, a real pointer press and drag, the hidden input's box and
// hit-testing, the accessibility tree (Chromium, CDP), a key pressed before hydration, Firefox's
// form-state restoration, the rollback CSS transition, and no document view transition. Runs in
// Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";

import { Slider } from "./index.js";
import type {
  SliderRootProps,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
} from "./index.js";
import { flushMicrotasks } from "../__tests__/helpers.js";
import { spyViewTransitions } from "../__tests__/browser-helpers.js";

type Value = number | readonly number[];
type ChangeFn = (next: Value, details: SliderValueChangeDetails) => unknown;
type CommitFn = (next: Value, details: SliderValueCommitDetails) => unknown;

/** The recipe of design 6.2, reduced: a 200px track, 20px thumbs placed from the custom properties. */
const CSS = `
.t-track { position: relative; inline-size: 200px; block-size: 20px; margin: 30px; background: #ccc; }
.t-track[data-orientation="vertical"] { inline-size: 20px; block-size: 200px; }
.t-fill { position: absolute; inset-block: 0; inset-inline-start: var(--slider-start); inset-inline-end: calc(100% - var(--slider-end)); background: #88f; }
.t-thumb { position: absolute; inline-size: 20px; block-size: 20px; inset-block-start: 0; inset-inline-start: var(--slider-value); translate: -50% 0; background: #00f; }
[dir="rtl"] .t-thumb { translate: 50% 0; }
.t-track[data-orientation="vertical"] .t-thumb { inset-inline-start: 0; inset-block-start: auto; inset-block-end: var(--slider-value); translate: 0 50%; }
@property --slider-value { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
.t-animated .t-thumb { transition: --slider-value 200ms linear; }
.t-animated [data-dragging] .t-thumb, .t-animated[data-dragging] .t-thumb { transition: none; }
`;

let style: HTMLStyleElement;
beforeAll(() => {
  style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
});
afterAll(() => style.remove());

interface FixtureProps extends Partial<SliderRootProps<Value>> {
  count?: number;
  dir?: "rtl";
  rootClassName?: string;
}

function Fixture({ count = 1, dir, rootClassName, ...props }: FixtureProps) {
  return (
    <div dir={dir}>
      <Slider.Root
        data-testid="root"
        className={rootClassName}
        {...(props as SliderRootProps<Value>)}
      >
        <Slider.Label>Volume</Slider.Label>
        <Slider.Track className="t-track" data-testid="track">
          <Slider.Indicator className="t-fill" />
          {Array.from({ length: count }, (_, i) => (
            <Slider.Thumb
              key={i}
              index={i}
              className="t-thumb"
              data-testid={`thumb-${i}`}
              aria-label={count > 1 ? `Thumb ${i}` : undefined}
            />
          ))}
        </Slider.Track>
      </Slider.Root>
    </div>
  );
}

const input = (index = 0) =>
  screen.getByTestId(`thumb-${index}`).querySelector("input") as HTMLInputElement;
const thumb = (index = 0) => screen.getByTestId(`thumb-${index}`);

async function focusThumb(index = 0): Promise<void> {
  await act(async () => input(index).focus());
}

function centre(element: Element): { x: number; y: number } {
  const r = element.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

describe("Slider (browser)", () => {
  describe("native keys", () => {
    it("Arrow, Page, Home and End step as the APG says, one step and one commit per press", async () => {
      const onChange = vi.fn<ChangeFn>();
      const onCommit = vi.fn<CommitFn>();
      render(
        <Fixture defaultValue={50} valueChangeAction={onChange} valueCommitAction={onCommit} />,
      );
      await focusThumb();
      const expected: [string, string][] = [
        ["{ArrowRight}", "51"],
        ["{ArrowLeft}", "50"],
        ["{ArrowUp}", "51"],
        ["{ArrowDown}", "50"],
        ["{PageUp}", "60"],
        ["{PageDown}", "50"],
        ["{Home}", "0"],
        ["{End}", "100"],
      ];
      for (const [key, value] of expected) {
        onChange.mockClear();
        onCommit.mockClear();
        await user.keyboard(key);
        await flushMicrotasks();
        expect(input().value, key).toBe(value);
        expect(thumb().style.getPropertyValue("--slider-value"), key).toBe(`${value}%`);
        expect(onChange, key).toHaveBeenCalledTimes(1);
        expect(onCommit, key).toHaveBeenCalledTimes(1);
        expect(onCommit.mock.calls[0]![0], key).toBe(Number(value));
        expect(onCommit.mock.calls[0]![1].event?.type, key).toBe("change");
      }
    });

    it("mirrors ArrowLeft / ArrowRight under a dir=rtl container", async () => {
      const onCommit = vi.fn<CommitFn>();
      render(<Fixture dir="rtl" defaultValue={50} valueCommitAction={onCommit} />);
      await focusThumb();
      await user.keyboard("{ArrowLeft}");
      await flushMicrotasks();
      expect(input().value).toBe("51");
      // Normalised in JS (WebKit does not mirror a native range), as for the vertical keys.
      expect(onCommit.mock.calls[0]![1].event?.type).toBe("keydown");
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowRight}");
      await flushMicrotasks();
      expect(input().value).toBe("49");
      expect(onCommit).toHaveBeenCalledTimes(3);
    });

    it("Home / End on a multi-thumb slider stop at the neighbour", async () => {
      render(
        <Fixture
          count={2}
          defaultValue={[100, 300]}
          max={500}
          step={10}
          minStepsBetweenThumbs={1}
        />,
      );
      await focusThumb(0);
      await user.keyboard("{End}");
      await flushMicrotasks();
      expect(input(0).value).toBe("290");
      expect(input(1)).toHaveAttribute("min", "300");
      await focusThumb(1);
      await user.keyboard("{Home}");
      await flushMicrotasks();
      expect(input(1).value).toBe("300");
      await user.keyboard("{ArrowLeft}");
      await flushMicrotasks();
      expect(input(1).value).toBe("300");
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(input(0));
    });
  });

  describe("vertical", () => {
    it("Up increases and Down decreases; ArrowRight increases in every engine", async () => {
      const onChange = vi.fn<ChangeFn>();
      const onCommit = vi.fn<CommitFn>();
      render(
        <Fixture
          orientation="vertical"
          defaultValue={50}
          valueChangeAction={onChange}
          valueCommitAction={onCommit}
        />,
      );
      await focusThumb();
      await user.keyboard("{ArrowUp}");
      await flushMicrotasks();
      expect(input().value).toBe("51");
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowDown}");
      await flushMicrotasks();
      expect(input().value).toBe("49");
      onChange.mockClear();
      onCommit.mockClear();
      await user.keyboard("{ArrowRight}");
      await flushMicrotasks();
      expect(input().value).toBe("50");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![1].event?.type).toBe("keydown");
      await user.keyboard("{ArrowLeft}");
      await flushMicrotasks();
      expect(input().value).toBe("49");
      // The thumb counts from the bottom.
      const track = screen.getByTestId("track").getBoundingClientRect();
      const { y } = centre(thumb());
      expect(Math.abs(track.bottom - y - 0.49 * track.height)).toBeLessThanOrEqual(2);
    });
  });

  describe("pointer", () => {
    it("a press on the track moves the nearest thumb, focuses its input without a ring, commits once", async () => {
      const onChange = vi.fn<ChangeFn>();
      const onCommit = vi.fn<CommitFn>();
      render(
        <Fixture
          count={2}
          defaultValue={[20, 80]}
          valueChangeAction={onChange}
          valueCommitAction={onCommit}
        />,
      );
      const track = screen.getByTestId("track");
      // 35% of 200px: nearer to thumb 0.
      await user.click(track, { position: { x: 70, y: 10 } });
      await flushMicrotasks();
      expect(input(0).value).toBe("35");
      expect(input(1).value).toBe("80");
      expect(document.activeElement).toBe(input(0));
      expect(input(0).matches(":focus-visible")).toBe(false);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toEqual([35, 80]);
      expect(onCommit.mock.calls[0]![1].event?.type).toBe("pointerup");
      expect(window.getSelection()?.toString() ?? "").toBe("");
    });

    it("a drag follows the pointer and commits once at release", async () => {
      const onChange = vi.fn<ChangeFn>();
      const onCommit = vi.fn<CommitFn>();
      render(
        <Fixture defaultValue={20} valueChangeAction={onChange} valueCommitAction={onCommit} />,
      );
      const track = screen.getByTestId("track");
      await user.dragAndDrop(thumb(), track, {
        sourcePosition: { x: 10, y: 10 },
        targetPosition: { x: 150, y: 10 },
      });
      await flushMicrotasks();
      const rect = track.getBoundingClientRect();
      expect(input().value).toBe("75");
      const { x } = centre(thumb());
      expect(Math.abs(x - (rect.left + 150))).toBeLessThanOrEqual(2);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBe(75);
      expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(onChange.mock.calls.at(-1)![0]).toBe(75);
      expect(screen.getByTestId("root")).not.toHaveAttribute("data-dragging");
      expect(document.activeElement).toBe(input());
      expect(window.getSelection()?.toString() ?? "").toBe("");
    });

    it("mirrors the pointer under a dir=rtl container", async () => {
      render(<Fixture dir="rtl" defaultValue={50} />);
      const track = screen.getByTestId("track");
      await user.click(track, { position: { x: 50, y: 10 } });
      await flushMicrotasks();
      expect(input().value).toBe("75");
      const { x } = centre(thumb());
      expect(Math.abs(x - (track.getBoundingClientRect().left + 50))).toBeLessThanOrEqual(2);
    });

    it("the hidden input has the thumb's box, opacity 0, and is not hit by the pointer", () => {
      render(<Fixture defaultValue={50} />);
      const thumbBox = thumb().getBoundingClientRect();
      const inputBox = input().getBoundingClientRect();
      expect(Math.abs(inputBox.width - thumbBox.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(inputBox.height - thumbBox.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(inputBox.left - thumbBox.left)).toBeLessThanOrEqual(1);
      expect(getComputedStyle(input()).opacity).toBe("0");
      const { x, y } = centre(thumb());
      expect(document.elementFromPoint(x, y)).toBe(thumb());
    });
  });

  it.runIf(browserName === "chromium")(
    "accessibility tree (CDP): sliders with neighbour bounds, vertical orientation, valuetext",
    async () => {
      render(
        <>
          <Fixture
            count={2}
            defaultValue={[100, 300]}
            max={500}
            step={10}
            minStepsBetweenThumbs={1}
            getAriaValueText={(v) => `${v} dollars`}
          />
          <Slider.Root defaultValue={30} orientation="vertical">
            <Slider.Thumb aria-label="Level" />
          </Slider.Root>
        </>,
      );
      type AXValue = { value?: unknown };
      type AXNode = {
        role?: AXValue;
        name?: AXValue;
        value?: AXValue;
        properties?: { name: string; value: AXValue }[];
      };
      const session = cdp();
      type FrameTree = { frame: { id: string; url: string }; childFrames?: FrameTree[] };
      const { frameTree } = (await session.send("Page.getFrameTree")) as { frameTree: FrameTree };
      const frames: FrameTree[] = [];
      const walk = (t: FrameTree) => {
        frames.push(t);
        t.childFrames?.forEach(walk);
      };
      walk(frameTree);
      const frameId = frames.find((f) => f.frame.url === location.href)?.frame.id;
      const { nodes } = (await session.send("Accessibility.getFullAXTree", { frameId })) as {
        nodes: AXNode[];
      };
      const slider = (name: string) =>
        nodes.find((n) => n.role?.value === "slider" && n.name?.value === name);
      const prop = (n: AXNode | undefined, p: string) =>
        n?.properties?.find((x) => x.name === p)?.value.value;
      const min = slider("Thumb 0");
      const max = slider("Thumb 1");
      expect(min).toBeDefined();
      expect(prop(min, "valuemin")).toBe(0);
      expect(prop(min, "valuemax")).toBe(290);
      expect(prop(max, "valuemin")).toBe(110);
      expect(prop(max, "valuemax")).toBe(500);
      expect(input(0)).toHaveAttribute("aria-valuetext", "100 dollars");
      expect(prop(slider("Level"), "orientation")).toBe("vertical");
      expect(nodes.find((n) => n.role?.value === "group")).toBeDefined();
    },
  );

  it("a key pressed before hydration survives it and is adopted once with platform", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    function App() {
      return (
        <Slider.Root defaultValue={40} valueChangeAction={onChange} valueCommitAction={onCommit}>
          <Slider.Label>Volume</Slider.Label>
          <Slider.Track>
            <Slider.Thumb />
          </Slider.Track>
        </Slider.Root>
      );
    }
    const html = renderToString(<App />);
    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!doctype html><div id="root">${html}</div>`;
    const loaded = new Promise((resolve) => (iframe.onload = resolve));
    document.body.append(iframe);
    await loaded;
    try {
      const container = iframe.contentDocument!.getElementById("root")!;
      const field = container.querySelector("input")!;
      field.focus();
      await userEvent.keyboard("{End}");
      if (field.value !== "100" && browserName === "webkit") {
        // WebKit only (Combobox L4 rule): if the real keyboard does not reach into the frame,
        // step the way the parser-built range would.
        console.warn(`[${browserName}] keyboard did not reach the iframe; stepping by script`);
        field.value = "100";
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
      expect(field.value).toBe("100");
      const recoverable: unknown[] = [];
      await act(async () => {
        hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(e) });
      });
      await flushMicrotasks();
      expect(recoverable).toEqual([]);
      expect(container.querySelector("input")).toBe(field);
      expect(field.value).toBe("100");
      expect(onChange.mock.calls.map(([v, d]) => [v, d.reason, d.thumb, d.event])).toEqual([
        [100, "platform", null, undefined],
      ]);
      expect(onCommit.mock.calls.map(([v, d]) => [v, d.reason, d.thumb, d.event])).toEqual([
        [100, "platform", null, undefined],
      ]);
      const styled = field.parentElement as HTMLElement;
      expect(styled.style.getPropertyValue("--slider-value")).toBe("100%");
    } finally {
      iframe.remove();
      window.focus();
      document.body.focus();
    }
  });

  it.runIf(browserName === "firefox")(
    "Firefox form-state restoration across a reload is adopted with platform",
    async () => {
      const onCommit = vi.fn<CommitFn>();
      function App() {
        return (
          <form>
            <Slider.Root defaultValue={40} name="volume" valueCommitAction={onCommit}>
              <Slider.Thumb aria-label="Volume" />
            </Slider.Root>
          </form>
        );
      }
      const html = renderToString(<App />);
      const iframe = document.createElement("iframe");
      iframe.srcdoc = `<!doctype html><div id="root">${html}</div>`;
      let loaded = new Promise((resolve) => (iframe.onload = resolve));
      document.body.append(iframe);
      await loaded;
      try {
        iframe.contentDocument!.querySelector("input")!.value = "75";
        loaded = new Promise((resolve) => (iframe.onload = resolve));
        iframe.contentWindow!.location.reload();
        await loaded;
        const container = iframe.contentDocument!.getElementById("root")!;
        const field = container.querySelector("input")!;
        if (field.value !== "75") {
          // Restoration did not happen for this frame (a srcdoc document may not be restored);
          // nothing to reconcile then. Logged so a change in Firefox's behaviour is visible.
          console.warn(`[firefox] range value not restored after reload (${field.value})`);
          return;
        }
        await act(async () => {
          hydrateRoot(container, <App />);
        });
        await flushMicrotasks();
        expect(onCommit.mock.calls.map(([v, d]) => [v, d.reason])).toEqual([[75, "platform"]]);
      } finally {
        iframe.remove();
      }
    },
  );

  it("a roll back animates the registered property; a drag runs no transition", async () => {
    // A controlled parent that never adopts: when the save settles the thumb returns to
    // `value`, the same move a rejected save makes (a rejection itself unmounts the Root through
    // the boundary). The save is held open so that the frames are deterministic: the engine
    // paints the held gesture value before the rollback. (WebKit delivers Playwright's move and
    // release in one frame, and a save that settles at once may roll back before any frame shows
    // the held value: the transition would then depend on frame timing.)
    let settle!: () => void;
    const save = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const starts: { property: string; dragging: boolean }[] = [];
    render(<Fixture rootClassName="t-animated" value={20} valueCommitAction={() => save} />);
    const listener = (e: TransitionEvent) =>
      starts.push({
        property: e.propertyName,
        dragging: screen.getByTestId("root").hasAttribute("data-dragging"),
      });
    thumb().addEventListener("transitionstart", listener);
    const frames = async (n: number) => {
      for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
    };
    try {
      const track = screen.getByTestId("track");
      await act(async () => {
        await userEvent.dragAndDrop(thumb(), track, {
          sourcePosition: { x: 10, y: 10 },
          targetPosition: { x: 160, y: 10 },
          steps: 5,
        });
      });
      await flushMicrotasks();
      // Released, the save pending: the gesture value is held.
      expect(input().value).toBe("80");
      expect(screen.getByTestId("root")).toHaveAttribute("data-pending");
      expect(screen.getByTestId("root")).not.toHaveAttribute("data-dragging");
      await act(() => frames(3));
      // `[data-dragging]` switched the transition off for every step of the drag. (Whether the
      // release itself starts one depends on the engine having painted the last move.)
      expect(starts.filter((s) => s.dragging)).toEqual([]);
      starts.length = 0;
      await act(async () => settle());
      await flushMicrotasks();
      expect(input().value).toBe("20");
      await expect.poll(() => starts.length).toBeGreaterThan(0);
      await act(() => frames(3));
      expect(starts).toEqual([{ property: "--slider-value", dragging: false }]);
    } finally {
      thumb().removeEventListener("transitionstart", listener);
    }
  });

  it("never starts a document view transition (no boundary exists)", async () => {
    const vt = spyViewTransitions();
    render(<Fixture defaultValue={20} valueCommitAction={() => undefined} />);
    await user.click(screen.getByTestId("track"), { position: { x: 120, y: 10 } });
    await focusThumb();
    await user.keyboard("{ArrowRight}");
    await flushMicrotasks();
    expect(input().value).toBe("61");
    expect(vt.calls()).toBe(0);
  });
});
// Design 9.4.6 (issue #60): a Slider inside a Field, with real submit clicks and a real drag.
describe("Slider inside a Field (browser)", () => {
  it("a failing validate blocks the submit on the first thumb; a real drag fixes it and the next click submits", async () => {
    const action = vi.fn<(formData: FormData) => void>();
    render(
      <Form.Root action={action}>
        <Field.Root
          name="price"
          validate={(_value, formData) => {
            const [lo, hi] = formData.getAll("price").map(Number);
            return hi! - lo! > 50 ? "Narrow the range to 50 or less." : null;
          }}
        >
          <Field.Label>Price</Field.Label>
          <Slider.Root data-testid="root" defaultValue={[10, 90]}>
            <Slider.Track className="t-track" data-testid="track">
              <Slider.Indicator className="t-fill" />
              <Slider.Thumb index={0} className="t-thumb" data-testid="thumb-0" aria-label="Min" />
              <Slider.Thumb index={1} className="t-thumb" data-testid="thumb-1" aria-label="Max" />
            </Slider.Track>
          </Slider.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await flushMicrotasks();
    // Observed at the target, after the Field's capture listener on the group.
    const invalidEvents: Event[] = [];
    input(0).addEventListener("invalid", (event) => invalidEvents.push(event));

    await user.click(screen.getByRole("button", { name: "Save" }));
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
    expect(invalidEvents).toHaveLength(1);
    // The Field cancelled the bubble and focused the first thumb's input.
    expect(invalidEvents[0]!.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input(0));
    expect(input(0).matches(":user-invalid")).toBe(true);
    expect(screen.getByTestId("error")).toHaveTextContent("Narrow the range to 50 or less.");
    expect(screen.getByTestId("root")).toHaveAttribute("data-invalid");

    // Drag the max thumb from 90 to 50 (the track is 200px wide).
    await user.dragAndDrop(thumb(1), screen.getByTestId("track"), {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 100, y: 10 },
    });
    await flushMicrotasks();
    expect(input(1).value).toBe("50");
    expect(screen.queryByTestId("error")).toBeNull();
    expect(input(0).validationMessage).toBe("");
    expect(input(0).matches(":user-invalid")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await flushMicrotasks();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0].getAll("price")).toEqual(["10", "50"]);
  });
});
