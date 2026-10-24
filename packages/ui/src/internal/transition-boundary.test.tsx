// Conventions 5.1 and issue #35: a part renders `<ViewTransition>` only when the consumer passes
// `transition`. react-dom starts a document view transition whenever a boundary mounts or is
// revealed by `<Activity>` in a transition-lane commit, even with "none"
// (docs/research/view-transition-mount-cost.md).
//
// jsdom has no `startViewTransition`. Each test installs a stub that records the call and throws:
// react-dom catches the throw and commits synchronously, exactly as in a browser without the API,
// so the count is the number of document view transitions a real engine would have started.
// The `"none"` rows assert react-dom 19.3's current behaviour (a mount or reveal starts one); if a
// React release makes "none" free on enter, they fail and the rule can be revisited.
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  addTransitionType,
  isValidElement,
  startTransition,
  useState,
  ViewTransition,
} from "react";
import type { ReactElement, ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { setupUser, silenceErrors } from "../__tests__/helpers.js";
import { Accordion } from "../accordion/index.js";
import { Checkbox } from "../checkbox/index.js";
import { Dialog } from "../dialog/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Switch } from "../switch/index.js";
import { Tabs } from "../tabs/index.js";
import { Toggle } from "../toggle/index.js";
import { transitionBoundary } from "./transition-boundary.js";

let calls: Mock<() => never>;

beforeEach(() => {
  calls = vi.fn<() => never>(() => {
    throw new Error("startViewTransition stub");
  });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: calls });
});

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("transitionBoundary", () => {
  it("returns the node itself when transition is undefined", () => {
    const node = <span />;
    expect(transitionBoundary(undefined, node)).toBe(node);
  });

  it.each<ViewTransitionClass>(["none", "auto", "fade", { "fsui-tabs": "slide", default: "none" }])(
    "wraps the node in <ViewTransition default> for %j",
    (transition) => {
      const node = <span />;
      const out = transitionBoundary(transition, node);
      expect(isValidElement(out)).toBe(true);
      const el = out as ReactElement<{ default: unknown; children: unknown }>;
      expect(el.type).toBe(ViewTransition);
      expect(el.props.default).toEqual(transition);
      expect(el.props.children).toBe(node);
    },
  );
});

describe("react-dom behaviour the rule relies on", () => {
  it("addTransitionType in a transition without any boundary starts no view transition", async () => {
    function App() {
      const [n, setN] = useState(0);
      return (
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              addTransitionType("fsui-test");
              setN((v) => v + 1);
            })
          }
        >
          {n === 0 ? "zero" : <em>more</em>}
        </button>
      );
    }
    const user = setupUser();
    render(<App />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("more")).toBeInTheDocument());
    expect(calls).not.toHaveBeenCalled();
  });

  it("a 'none' boundary mounting in a transition starts one (react-dom 19.3)", async () => {
    const { mount } = mountInTransition(
      <ViewTransition default="none">
        <span>x</span>
      </ViewTransition>,
    );
    await mount();
    expect(calls).toHaveBeenCalled();
  });
});

/** A "show" button that flips `show` in a transition, as an action's settle would. */
function ShowHost({ part }: { part: (show: boolean) => ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <button type="button" onClick={() => startTransition(() => setShow(true))}>
        show
      </button>
      {part(show)}
    </>
  );
}

/** Renders `node` inside an existing container once a transition flips `show`. */
function mountInTransition(node: ReactNode) {
  const user = setupUser();
  render(<ShowHost part={(show) => <div data-testid="host">{show && node}</div>} />);
  return {
    mount: async () => {
      await user.click(screen.getByRole("button", { name: "show" }));
      await waitFor(() => expect(screen.getByTestId("host")).not.toBeEmptyDOMElement());
    },
  };
}

describe("parts mounting at the top of an inserted subtree", () => {
  const parts: [string, (t: ViewTransitionClass | undefined) => ReactNode][] = [
    ["Toggle", (t) => <Toggle transition={t}>B</Toggle>],
    ["Switch", (t) => <Switch aria-label="s" transition={t} />],
    ["Checkbox", (t) => <Checkbox aria-label="c" transition={t} />],
  ];

  describe.each(parts)("%s", (_name, part) => {
    it("without transition: no view transition", async () => {
      const { mount } = mountInTransition(part(undefined));
      await mount();
      expect(calls).not.toHaveBeenCalled();
    });

    it('with transition="none": the boundary exists and its mount starts one', async () => {
      const { mount } = mountInTransition(part("none"));
      await mount();
      expect(calls).toHaveBeenCalled();
    });
  });

  const grouped: [string, (t: ViewTransitionClass | undefined, show: boolean) => ReactNode][] = [
    [
      "RadioGroup.Item",
      (t, show) => (
        <RadioGroup.Root name="g" aria-label="g">
          <RadioGroup.Item value="a" aria-label="a" />
          {show && <RadioGroup.Item value="b" aria-label="b" transition={t} data-testid="added" />}
        </RadioGroup.Root>
      ),
    ],
    [
      "Tabs.Tab",
      (t, show) => (
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
            {show && (
              <Tabs.Tab value="b" transition={t} data-testid="added">
                B
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.Root>
      ),
    ],
    [
      "Accordion.Item",
      (t, show) => (
        <Accordion.Root defaultValue={[]}>
          <Accordion.Item value="a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
          {show && (
            <Accordion.Item value="b" transition={t} data-testid="added">
              <Accordion.Trigger>B</Accordion.Trigger>
            </Accordion.Item>
          )}
        </Accordion.Root>
      ),
    ],
  ];

  describe.each(grouped)("%s", (_name, part) => {
    it("without transition: no view transition", async () => {
      const user = setupUser();
      render(<ShowHost part={(show) => part(undefined, show)} />);
      await user.click(screen.getByRole("button", { name: "show" }));
      await screen.findByTestId("added");
      expect(calls).not.toHaveBeenCalled();
    });

    it('with transition="none": the boundary exists and its mount starts one', async () => {
      const user = setupUser();
      render(<ShowHost part={(show) => part("none", show)} />);
      await user.click(screen.getByRole("button", { name: "show" }));
      await screen.findByTestId("added");
      expect(calls).toHaveBeenCalled();
    });
  });
});

describe("Tabs switch", () => {
  describe.each([false, true] as const)("keepMounted={%s}", (keepMounted) => {
    const tree = (transition: ViewTransitionClass | undefined) => (
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="x">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" keepMounted={keepMounted} transition={transition}>
          Alpha
        </Tabs.Panel>
        <Tabs.Panel value="b" keepMounted={keepMounted} transition={transition}>
          Beta
        </Tabs.Panel>
      </Tabs.Root>
    );

    it("without transition: no view transition (the switch still adds fsui-tabs types)", async () => {
      const user = setupUser();
      render(tree(undefined));
      await user.click(screen.getByRole("tab", { name: "B" }));
      await waitFor(() => expect(screen.getByText("Beta")).toBeVisible());
      expect(calls).not.toHaveBeenCalled();
    });

    it('with transition="none": the panel mount or reveal starts one', async () => {
      const user = setupUser();
      render(tree("none"));
      await user.click(screen.getByRole("tab", { name: "B" }));
      await waitFor(() => expect(screen.getByText("Beta")).toBeVisible());
      expect(calls).toHaveBeenCalled();
    });
  });

  it('keepMounted="until-found" with transition="none": an update only, none started', async () => {
    const user = setupUser();
    render(
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="x">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" keepMounted="until-found" transition="none">
          Alpha
        </Tabs.Panel>
        <Tabs.Panel value="b" keepMounted="until-found" transition="none">
          Beta
        </Tabs.Panel>
      </Tabs.Root>,
    );
    await user.click(screen.getByRole("tab", { name: "B" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("aria-selected", "true"),
    );
    expect(calls).not.toHaveBeenCalled();
  });
});

describe("Accordion", () => {
  const tree = (transition: ViewTransitionClass | undefined, inner?: ReactNode) => (
    <Accordion.Root defaultValue={[]}>
      <Accordion.Item value="a" transition={transition}>
        <Accordion.Trigger transition={transition}>A</Accordion.Trigger>
        <Accordion.Panel transition={transition}>{inner ?? "Alpha"}</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );

  it("expanding without transition starts no view transition", async () => {
    const user = setupUser();
    render(tree(undefined));
    await user.click(screen.getByText("A"));
    await waitFor(() => expect(screen.getByText("A").closest("details")).toHaveAttribute("open"));
    expect(calls).not.toHaveBeenCalled();
  });

  it('expanding with transition="none" is an update of always-mounted boundaries: none started', async () => {
    const user = setupUser();
    render(tree("none"));
    await user.click(screen.getByText("A"));
    await waitFor(() => expect(screen.getByText("A").closest("details")).toHaveAttribute("open"));
    expect(calls).not.toHaveBeenCalled();
  });

  it("JS-free mode renders no boundary even with transition set", async () => {
    silenceErrors();
    const { mount } = mountInTransition(
      <Accordion.Root>
        <Accordion.Item value="a" transition="none">
          <Accordion.Trigger transition="none">A</Accordion.Trigger>
          <Accordion.Panel transition="none">Alpha</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );
    // The Root renders no DOM element of its own, so the Item would be the top of the inserted
    // subtree: a boundary there would start a view transition.
    await mount();
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    expect(calls).not.toHaveBeenCalled();
  });
});

describe("Dialog", () => {
  // A simple open mounts content under the always-mounted `<dialog>` (a host element), so only a
  // boundary inside the content (here a nested Dialog's Popup) is the top of the inserted subtree.
  const tree = (transition: ViewTransitionClass | undefined) => (
    <Dialog.Root defaultOpen={false}>
      <Dialog.Trigger>Outer</Dialog.Trigger>
      <Dialog.Popup aria-label="outer" transition={transition}>
        <Dialog.Root defaultOpen={false}>
          <Dialog.Trigger>Inner</Dialog.Trigger>
          <Dialog.Popup aria-label="inner" transition={transition}>
            inner content
          </Dialog.Popup>
        </Dialog.Root>
      </Dialog.Popup>
    </Dialog.Root>
  );

  it("opening (with a nested Dialog inside) without transition starts no view transition", async () => {
    const user = setupUser();
    render(tree(undefined));
    await user.click(screen.getByRole("button", { name: "Outer" }));
    await user.click(await screen.findByRole("button", { name: "Inner" }));
    await waitFor(() => expect(screen.getByText("inner content")).toBeInTheDocument());
    expect(calls).not.toHaveBeenCalled();
  });

  it('with transition="none" the nested Popup mounting with the outer content starts one', async () => {
    const user = setupUser();
    render(tree("none"));
    await user.click(screen.getByRole("button", { name: "Outer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Inner" })).toBeInTheDocument());
    expect(calls).toHaveBeenCalled();
  });

  it.each([false, true])(
    'a plain open with transition="none" (keepMounted={%s}) starts none: the <dialog> shields the content',
    async (keepMounted) => {
      const user = setupUser();
      render(
        <Dialog.Root defaultOpen={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Popup aria-label="d" transition="none" keepMounted={keepMounted}>
            <p>hello</p>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await user.click(screen.getByRole("button", { name: "Open" }));
      await waitFor(() => expect(screen.getByText("hello")).toBeInTheDocument());
      expect(calls).not.toHaveBeenCalled();
    },
  );
});

describe("transition is static", () => {
  const panels = (transition: ViewTransitionClass | undefined) => (
    <Tabs.Root defaultValue="a">
      <Tabs.List aria-label="x">
        <Tabs.Tab value="a">A</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a" transition={transition}>
        <input aria-label="field" />
      </Tabs.Panel>
    </Tabs.Root>
  );

  it("undefined to a value remounts the part's element and warns once in development", async () => {
    const error = silenceErrors();
    const { rerender } = render(panels(undefined));
    const before = screen.getByRole("tabpanel");
    await act(async () => rerender(panels("fade")));
    expect(screen.getByRole("tabpanel")).not.toBe(before);
    await act(async () => rerender(panels(undefined)));
    await act(async () => rerender(panels("fade")));
    const messages = error.mock.calls.map((c) => String(c[0]));
    expect(messages.filter((m) => m.includes("Tabs.Panel: `transition` changed"))).toHaveLength(1);
  });

  it('"none" to a class keeps the boundary: no remount, no warning', async () => {
    const error = silenceErrors();
    const { rerender } = render(panels("none"));
    const before = screen.getByRole("tabpanel");
    await act(async () => rerender(panels("fade")));
    expect(screen.getByRole("tabpanel")).toBe(before);
    expect(error).not.toHaveBeenCalled();
  });

  it("the warning names the part", async () => {
    const error = silenceErrors();
    const { rerender } = render(<Toggle>B</Toggle>);
    await act(async () => rerender(<Toggle transition="fade">B</Toggle>));
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Toggle: `transition` changed between undefined and a value"),
    );
  });
});
