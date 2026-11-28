// #218: an owner references the ids of its Title, Description, GroupLabel or Trigger only while
// that part is mounted (conventions 1.1.1), with the SSR approach of
// #217: until the owner's first commit every part counts as mounted, so the server HTML keeps the
// references and hydration drops the ones without a part. The Field half is
// field/field-references.test.tsx.
import { act, render, screen } from "@testing-library/react";
import { Activity, StrictMode, Suspense } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { AlertDialog } from "../alert-dialog/index.js";
import { Combobox } from "../combobox/index.js";
import { Dialog } from "../dialog/index.js";
import { Drawer } from "../drawer/index.js";
import { Menu } from "../menu/index.js";
import { MultiSelect } from "../multi-select/index.js";
import { Popover } from "../popover/index.js";
import { createToastManager, Toast } from "../toast/index.js";
import type { ToastManager } from "../toast/index.js";
import { createSuspender, flushMicrotasks, flushTasks } from "./helpers.js";

const IDREF_ATTRIBUTES = ["aria-labelledby", "aria-describedby", "aria-errormessage"] as const;

/** Every idref token under `root` that names no element of the document. */
function danglingRefs(root: ParentNode): string[] {
  const out: string[] = [];
  for (const attribute of IDREF_ATTRIBUTES) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      for (const token of (element.getAttribute(attribute) ?? "").split(/\s+/)) {
        if (token !== "" && element.ownerDocument.getElementById(token) === null) {
          out.push(`${attribute}="${token}" on <${element.tagName.toLowerCase()}>`);
        }
      }
    }
  }
  return out;
}

const tokens = (element: Element, attribute: string): string[] =>
  (element.getAttribute(attribute) ?? "").split(/\s+/).filter((t) => t !== "");

const owner = (root: ParentNode = document) =>
  root.querySelector<HTMLElement>('[data-testid="owner"]')!;

/** Server-renders `ui`, hydrates it and checks that nothing warned. */
async function hydrate(ui: ReactNode) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  const server = container.cloneNode(true) as HTMLElement;
  const error = vi.spyOn(console, "error");
  const recoverable: unknown[] = [];
  const root = await act(async () =>
    hydrateRoot(container, ui, { onRecoverableError: (e) => recoverable.push(e) }),
  );
  onTestFinished(() => act(() => root.unmount()));
  await flushMicrotasks();
  expect(recoverable).toEqual([]);
  expect(error).not.toHaveBeenCalled();
  return { container, server };
}

// --- Title and Description ---------------------------------------------------------------------

interface Parts {
  readonly title: boolean;
  readonly description: boolean;
}
type Wrap = (parts: ReactNode) => ReactNode;

interface TitleCase {
  readonly name: string;
  /** The owner in JS-free mode (its content is always rendered, on the server too). */
  readonly ui: (parts: Parts, wrap?: Wrap, own?: Record<string, string>) => ReactNode;
}

function partsOf(
  { title, description }: Parts,
  Title: (p: { children: ReactNode }) => ReactNode,
  Description: (p: { children: ReactNode }) => ReactNode,
  wrap: Wrap = (p) => p,
): ReactNode {
  return wrap(
    <>
      {title && <Title>Title</Title>}
      {description && <Description>Description</Description>}
    </>,
  );
}

const TITLE_CASES: readonly TitleCase[] = [
  {
    name: "Dialog",
    ui: (parts, wrap, own) => (
      <Dialog.Root>
        <Dialog.Popup data-testid="owner" aria-label="Fallback" {...own}>
          {partsOf(parts, Dialog.Title, Dialog.Description, wrap)}
        </Dialog.Popup>
      </Dialog.Root>
    ),
  },
  {
    name: "AlertDialog",
    ui: (parts, wrap, own) => (
      <AlertDialog.Root>
        <AlertDialog.Popup data-testid="owner" aria-label="Fallback" {...own}>
          {partsOf(parts, AlertDialog.Title, AlertDialog.Description, wrap)}
          <AlertDialog.Cancel>Keep</AlertDialog.Cancel>
        </AlertDialog.Popup>
      </AlertDialog.Root>
    ),
  },
  {
    name: "Drawer",
    ui: (parts, wrap, own) => (
      <Drawer.Root>
        <Drawer.Popup data-testid="owner" aria-label="Fallback" {...own}>
          {partsOf(parts, Drawer.Title, Drawer.Description, wrap)}
          <Drawer.Close>Done</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
    ),
  },
  {
    name: "Popover",
    ui: (parts, wrap, own) => (
      <Popover.Root>
        <Popover.Popup data-testid="owner" aria-label="Fallback" {...own}>
          {partsOf(parts, Popover.Title, Popover.Description, wrap)}
        </Popover.Popup>
      </Popover.Root>
    ),
  },
];

const ALL: Parts = { title: true, description: true };
const NONE: Parts = { title: false, description: false };

function expectAll(el: HTMLElement) {
  expect(tokens(el, "aria-labelledby")).toEqual([`${el.id}-title`]);
  expect(tokens(el, "aria-describedby")).toEqual([`${el.id}-description`]);
  expect(danglingRefs(document.body)).toEqual([]);
}
function expectNone(el: HTMLElement) {
  expect(el).not.toHaveAttribute("aria-labelledby");
  expect(el).not.toHaveAttribute("aria-describedby");
  expect(danglingRefs(document.body)).toEqual([]);
}

describe.each(TITLE_CASES)("$name Popup → Title and Description (#218)", (c) => {
  it("names only the mounted parts; a part mounted later is added, an unmounted one dropped", async () => {
    const { rerender } = render(c.ui(NONE));
    await flushMicrotasks();
    expectNone(owner());
    rerender(c.ui({ title: true, description: false }));
    await flushMicrotasks();
    expect(tokens(owner(), "aria-labelledby")).toEqual([`${owner().id}-title`]);
    expect(owner()).not.toHaveAttribute("aria-describedby");
    rerender(c.ui(ALL));
    await flushMicrotasks();
    expectAll(owner());
    rerender(c.ui(NONE));
    await flushMicrotasks();
    expectNone(owner());
  });

  it("no parts: the consumer's own tokens are kept exactly (the keys are omitted)", async () => {
    render(
      <>
        {c.ui(NONE, undefined, { "aria-labelledby": "mine", "aria-describedby": "hint" })}
        <span id="mine">Mine</span>
        <span id="hint">Hint</span>
      </>,
    );
    await flushMicrotasks();
    expect(owner()).toHaveAttribute("aria-labelledby", "mine");
    expect(owner()).toHaveAttribute("aria-describedby", "hint");
  });

  it("StrictMode: the double effects leave the parts registered", async () => {
    const { rerender } = render(<StrictMode>{c.ui(ALL)}</StrictMode>);
    await flushMicrotasks();
    expectAll(owner());
    rerender(<StrictMode>{c.ui(NONE)}</StrictMode>);
    await flushMicrotasks();
    expectNone(owner());
  });

  it("a keyed remount of the parts keeps the tokens", async () => {
    const { rerender } = render(c.ui(ALL, (p) => <div key={1}>{p}</div>));
    await flushMicrotasks();
    expectAll(owner());
    rerender(c.ui(ALL, (p) => <div key={2}>{p}</div>));
    await flushMicrotasks();
    expectAll(owner());
  });

  it("<Activity> hiding the parts drops their tokens while hidden", async () => {
    const at = (mode: "visible" | "hidden") =>
      c.ui(ALL, (p) => <Activity mode={mode}>{p}</Activity>);
    const { rerender } = render(at("visible"));
    await flushMicrotasks();
    expectAll(owner());
    rerender(at("hidden"));
    await flushMicrotasks();
    expectNone(owner());
    rerender(at("visible"));
    await flushMicrotasks();
    expectAll(owner());
  });

  it("parts revealed by a Suspense boundary are referenced once revealed", async () => {
    const { Suspender, resolve } = createSuspender();
    // In an async act: a render that suspends in a sync act never retries in jsdom.
    await act(async () => {
      render(
        c.ui(ALL, (p) => (
          <Suspense fallback={<span data-testid="fallback" />}>
            <Suspender value="x" />
            {p}
          </Suspense>
        )),
      );
    });
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expectNone(owner());
    await act(async () => resolve("x"));
    await flushMicrotasks();
    expectAll(owner());
  });

  it("server HTML with both parts references them; hydration keeps them without a warning", async () => {
    const { container, server } = await hydrate(c.ui(ALL));
    for (const root of [server, container]) {
      const el = owner(root);
      expect(tokens(el, "aria-labelledby")).toEqual([`${el.id}-title`]);
      expect(tokens(el, "aria-describedby")).toEqual([`${el.id}-description`]);
    }
    expect(danglingRefs(container)).toEqual([]);
  });

  it("server HTML without the parts keeps the references; hydration drops them without a warning", async () => {
    // The trade-off of #217: before the first commit every part counts as mounted.
    const { container, server } = await hydrate(c.ui(NONE));
    const el = owner(server);
    expect(tokens(el, "aria-labelledby")).toEqual([`${el.id}-title`]);
    expect(tokens(el, "aria-describedby")).toEqual([`${el.id}-description`]);
    expectNone(owner(container));
  });
});

interface LibraryCase {
  readonly name: string;
  /**
   * The owner in library mode (controlled), named by its Title only: no `aria-label`, so a
   * missing-name false positive of the shown-name warning would be caught.
   */
  readonly ui: (open: boolean) => ReactNode;
  readonly isShown: (el: HTMLElement) => boolean;
}

const dialogShown = (el: HTMLElement) => (el as HTMLDialogElement).open;
const popoverShown = (el: HTMLElement) => el.matches(":popover-open");

const LIBRARY_CASES: readonly LibraryCase[] = [
  {
    name: "Dialog",
    isShown: dialogShown,
    ui: (open) => (
      <Dialog.Root open={open} onOpenChange={() => {}}>
        <Dialog.Popup data-testid="owner">
          <Dialog.Title>Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
        </Dialog.Popup>
      </Dialog.Root>
    ),
  },
  {
    name: "AlertDialog",
    isShown: dialogShown,
    ui: (open) => (
      <AlertDialog.Root open={open} onOpenChange={() => {}}>
        <AlertDialog.Popup data-testid="owner">
          <AlertDialog.Title>Title</AlertDialog.Title>
          <AlertDialog.Description>Description</AlertDialog.Description>
          <AlertDialog.Cancel>Keep</AlertDialog.Cancel>
        </AlertDialog.Popup>
      </AlertDialog.Root>
    ),
  },
  {
    name: "Drawer",
    isShown: dialogShown,
    ui: (open) => (
      <Drawer.Root open={open} onOpenChange={() => {}}>
        <Drawer.Popup data-testid="owner">
          <Drawer.Title>Title</Drawer.Title>
          <Drawer.Description>Description</Drawer.Description>
          <Drawer.Close>Done</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
    ),
  },
  {
    name: "Popover",
    isShown: popoverShown,
    ui: (open) => (
      <Popover.Root open={open} onOpenChange={() => {}}>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Popup data-testid="owner">
          <Popover.Title>Title</Popover.Title>
          <Popover.Description>Description</Popover.Description>
        </Popover.Popup>
      </Popover.Root>
    ),
  },
];

describe.each(LIBRARY_CASES)(
  "$name in library mode: the content is not rendered while closed (#218)",
  (c) => {
    it("closed: no reference; opened: both, named by the Title with no missing-name warning; closed again: none", async () => {
      const error = vi.spyOn(console, "error");
      const { rerender } = render(c.ui(false));
      await flushMicrotasks();
      expectNone(owner());
      await act(async () => rerender(c.ui(true)));
      await flushTasks(2);
      expect(c.isShown(owner())).toBe(true);
      expectAll(owner());
      await act(async () => rerender(c.ui(false)));
      // The content is held for the exit (an animation check after the close), then unmounts.
      await flushTasks(2);
      expectNone(owner());
      expect(error).not.toHaveBeenCalled();
    });
  },
);

describe("Popover: a Title outside the Popup counts (popover.md 1, #218)", () => {
  function App({ title }: { title: boolean }) {
    return (
      <Popover.Root>
        {title && <Popover.Title data-testid="title">Filters</Popover.Title>}
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Popup data-testid="owner">Content</Popover.Popup>
      </Popover.Root>
    );
  }

  it("names the Popup while the outside Title is mounted, and drops it when it unmounts", async () => {
    const { rerender } = render(<App title />);
    await flushMicrotasks();
    expect(owner()).toHaveAttribute("aria-labelledby", screen.getByTestId("title").id);
    expect(owner()).not.toHaveAttribute("aria-describedby");
    expect(danglingRefs(document.body)).toEqual([]);
    rerender(<App title={false} />);
    await flushMicrotasks();
    expect(owner()).not.toHaveAttribute("aria-labelledby");
    expect(danglingRefs(document.body)).toEqual([]);
  });
});

describe("The shown-name warning's microtask (#218)", () => {
  it("an owner unmounted before the microtask does not warn", async () => {
    const error = vi.spyOn(console, "error");
    // Shown (JS-free mode) and nameless: it would warn a microtask after the effect.
    const { unmount } = render(
      <Dialog.Root>
        <Dialog.Popup />
      </Dialog.Root>,
    );
    unmount();
    await flushMicrotasks();
    expect(error).not.toHaveBeenCalled();
  });

  it("a nameless owner still warns once the microtask runs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Dialog.Root>
        <Dialog.Popup />
      </Dialog.Root>,
    );
    await flushMicrotasks();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("no accessible name"));
  });
});

describe("Toast Root → Title and Description (#218)", () => {
  function App({ manager, description }: { manager: ToastManager; description: boolean }) {
    return (
      <Toast.Viewport manager={manager}>
        {({ toasts }) =>
          toasts.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="owner">
              <Toast.Title />
              {description && <Toast.Description />}
            </Toast.Root>
          ))
        }
      </Toast.Viewport>
    );
  }

  it("names the Title, and the Description only while one renders an element", async () => {
    const manager = createToastManager();
    const { rerender } = render(<App manager={manager} description />);
    await act(async () => {
      manager.add({ title: "Saved", description: "All changes" });
      await Promise.resolve();
    });
    await flushMicrotasks();
    const el = owner();
    expect(tokens(el, "aria-labelledby")).toHaveLength(1);
    expect(tokens(el, "aria-describedby")).toHaveLength(1);
    expect(danglingRefs(document.body)).toEqual([]);

    // A Description part that is not rendered.
    rerender(<App manager={manager} description={false} />);
    await flushMicrotasks();
    expect(el).not.toHaveAttribute("aria-describedby");
    expect(danglingRefs(document.body)).toEqual([]);
  });

  it("a Description with no content renders nothing and is not referenced", async () => {
    const manager = createToastManager();
    render(<App manager={manager} description />);
    await act(async () => {
      manager.add({ title: "Saved" });
      await Promise.resolve();
    });
    await flushMicrotasks();
    expect(owner()).not.toHaveAttribute("aria-describedby");
    expect(tokens(owner(), "aria-labelledby")).toHaveLength(1);
    expect(danglingRefs(document.body)).toEqual([]);
  });
});

// --- GroupLabel --------------------------------------------------------------------------------

interface GroupCase {
  readonly name: string;
  /** An open owner whose group has `data-testid="owner"`; `label` renders its GroupLabel. */
  readonly ui: (label: boolean, own?: Record<string, string>, wrap?: Wrap) => ReactNode;
}

const GROUP_CASES: readonly GroupCase[] = [
  {
    name: "Menu.Group",
    ui: (label, own, wrap = (p) => p) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Menu</Menu.Trigger>
        <Menu.Popup aria-label="Menu">
          <Menu.Group data-testid="owner" {...own}>
            {wrap(label && <Menu.GroupLabel>Group</Menu.GroupLabel>)}
            <Menu.Item>Item</Menu.Item>
          </Menu.Group>
        </Menu.Popup>
      </Menu.Root>
    ),
  },
  {
    name: "Menu.RadioGroup",
    ui: (label, own, wrap = (p) => p) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Menu</Menu.Trigger>
        <Menu.Popup aria-label="Menu">
          <Menu.RadioGroup data-testid="owner" defaultValue="a" {...own}>
            {wrap(label && <Menu.GroupLabel>Sort</Menu.GroupLabel>)}
            <Menu.RadioItem value="a">A</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    ),
  },
  {
    name: "Combobox.Group",
    ui: (label, own, wrap = (p) => p) => (
      <Combobox.Root defaultOpen>
        <Combobox.Input aria-label="Fruit" />
        <Combobox.Popup>
          <Combobox.List aria-label="Fruits">
            <Combobox.Group data-testid="owner" {...own}>
              {wrap(label && <Combobox.GroupLabel>Group</Combobox.GroupLabel>)}
              <Combobox.Option value="a">A</Combobox.Option>
            </Combobox.Group>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    ),
  },
  {
    name: "MultiSelect.Group",
    ui: (label, own, wrap = (p) => p) => (
      <MultiSelect.Root defaultOpen>
        <MultiSelect.Trigger aria-label="Fruit">
          <MultiSelect.Value />
        </MultiSelect.Trigger>
        <MultiSelect.Popup>
          <MultiSelect.List aria-label="Fruits">
            <MultiSelect.Group data-testid="owner" {...own}>
              {wrap(label && <MultiSelect.GroupLabel>Group</MultiSelect.GroupLabel>)}
              <MultiSelect.Option value="a">A</MultiSelect.Option>
            </MultiSelect.Group>
          </MultiSelect.List>
        </MultiSelect.Popup>
      </MultiSelect.Root>
    ),
  },
];

/** The GroupLabel's id (the group's own `aria-labelledby` token while it is mounted). */
const labelOf = () => owner().querySelector<HTMLElement>("[id$='-label']")!;

describe.each(GROUP_CASES)("$name → GroupLabel (#218)", (c) => {
  it("names the group only while a GroupLabel is mounted", async () => {
    const { rerender } = render(c.ui(false));
    await flushMicrotasks();
    expect(owner()).toHaveAttribute("role", "group");
    expect(owner()).not.toHaveAttribute("aria-labelledby");
    expect(danglingRefs(document.body)).toEqual([]);
    rerender(c.ui(true));
    await flushMicrotasks();
    expect(tokens(owner(), "aria-labelledby")).toEqual([labelOf().id]);
    expect(danglingRefs(document.body)).toEqual([]);
    rerender(c.ui(false));
    await flushMicrotasks();
    expect(owner()).not.toHaveAttribute("aria-labelledby");
  });

  it("no GroupLabel: the consumer's own token is kept exactly", async () => {
    render(
      <>
        {c.ui(false, { "aria-labelledby": "mine" })}
        <span id="mine">Mine</span>
      </>,
    );
    await flushMicrotasks();
    expect(owner()).toHaveAttribute("aria-labelledby", "mine");
  });

  it("StrictMode, <Activity> and a Suspense reveal follow the GroupLabel", async () => {
    const { unmount } = render(<StrictMode>{c.ui(true)}</StrictMode>);
    await flushMicrotasks();
    expect(tokens(owner(), "aria-labelledby")).toEqual([labelOf().id]);
    const at = (mode: "visible" | "hidden") =>
      c.ui(true, undefined, (p) => <Activity mode={mode}>{p}</Activity>);
    unmount();
    const activity = render(at("visible"));
    await flushMicrotasks();
    expect(tokens(owner(), "aria-labelledby")).toEqual([labelOf().id]);
    activity.rerender(at("hidden"));
    await flushMicrotasks();
    expect(owner()).not.toHaveAttribute("aria-labelledby");
    activity.rerender(at("visible"));
    await flushMicrotasks();
    expect(tokens(owner(), "aria-labelledby")).toEqual([labelOf().id]);
    activity.unmount();

    const { Suspender, resolve } = createSuspender();
    await act(async () => {
      render(
        c.ui(true, undefined, (p) => (
          <Suspense fallback={null}>
            <Suspender value="g" />
            {p}
          </Suspense>
        )),
      );
    });
    expect(owner()).not.toHaveAttribute("aria-labelledby");
    await act(async () => resolve("g"));
    await flushMicrotasks();
    expect(tokens(owner(), "aria-labelledby")).toEqual([labelOf().id]);
    expect(danglingRefs(document.body)).toEqual([]);
  });

  it("hydrates without a warning", async () => {
    // The popup content of these owners is rendered on the client only, so the server HTML has
    // no group; hydration must still be clean.
    const { container } = await hydrate(c.ui(true));
    await flushMicrotasks();
    expect(danglingRefs(container)).toEqual([]);
  });
});

describe("A group first mounted inside a hidden keepMounted popup (#218)", () => {
  it("keeps the assumed token while never shown (no effects run there), and settles when shown", async () => {
    function App({ open }: { open: boolean }) {
      return (
        <Combobox.Root open={open} onOpenChange={() => {}}>
          <Combobox.Input aria-label="Fruit" />
          <Combobox.Popup keepMounted>
            <Combobox.List aria-label="Fruits">
              <Combobox.Group data-testid="owner">
                <Combobox.Option value="a">A</Combobox.Option>
              </Combobox.Group>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      );
    }
    const { rerender } = render(<App open={false} />);
    await flushMicrotasks();
    // Hidden content: not in the accessibility tree, like the server HTML before hydration.
    expect(owner()).toHaveAttribute("aria-labelledby");
    await act(async () => rerender(<App open />));
    await flushTasks(2);
    expect(owner()).not.toHaveAttribute("aria-labelledby");
    expect(danglingRefs(document.body)).toEqual([]);
  });
});

// --- Menu Popup → Trigger ----------------------------------------------------------------------

describe("Menu Popup → Trigger (context-menu.md 10, #218)", () => {
  const popup = () => screen.getByRole("menu", { hidden: true });

  function App({ trigger, context = true }: { trigger: boolean; context?: boolean }) {
    return (
      <Menu.Root>
        {context && (
          <Menu.ContextTrigger>
            <p>Region</p>
          </Menu.ContextTrigger>
        )}
        {trigger && <Menu.Trigger data-testid="trigger">Actions</Menu.Trigger>}
        <Menu.Popup aria-label="Actions">
          <Menu.Item>Open</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    );
  }

  it("labelled by the Trigger only while one is mounted", async () => {
    const { rerender } = render(<App trigger={false} />);
    await flushMicrotasks();
    expect(popup()).not.toHaveAttribute("aria-labelledby");
    rerender(<App trigger />);
    await flushMicrotasks();
    expect(popup()).toHaveAttribute("aria-labelledby", screen.getByTestId("trigger").id);
    rerender(<App trigger={false} />);
    await flushMicrotasks();
    expect(popup()).not.toHaveAttribute("aria-labelledby");
    expect(danglingRefs(document.body)).toEqual([]);
  });

  it("StrictMode keeps the Trigger registered", async () => {
    render(
      <StrictMode>
        <App trigger />
      </StrictMode>,
    );
    await flushMicrotasks();
    expect(popup()).toHaveAttribute("aria-labelledby", screen.getByTestId("trigger").id);
  });

  it("a submenu Popup is labelled by its SubmenuTrigger", async () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup aria-label="Actions">
          <Menu.Root>
            <Menu.SubmenuTrigger data-testid="sub-trigger">Move to</Menu.SubmenuTrigger>
            <Menu.Popup data-testid="sub-popup">
              <Menu.Item>Archive</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Menu.Popup>
      </Menu.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("sub-popup")).toHaveAttribute(
      "aria-labelledby",
      screen.getByTestId("sub-trigger").id,
    );
  });

  it("server HTML: the Trigger's token is there with a Trigger and before hydration without one; hydration drops it, no warning", async () => {
    const withTrigger = await hydrate(<App trigger context={false} />);
    const trigger = withTrigger.server.querySelector("button")!;
    expect(withTrigger.server.querySelector("[role=menu]")).toHaveAttribute(
      "aria-labelledby",
      trigger.id,
    );
    expect(withTrigger.container.querySelector("[role=menu]")).toHaveAttribute(
      "aria-labelledby",
      trigger.id,
    );

    const without = await hydrate(<App trigger={false} />);
    expect(without.server.querySelector("[role=menu]")).toHaveAttribute("aria-labelledby");
    expect(without.container.querySelector("[role=menu]")).not.toHaveAttribute("aria-labelledby");
  });
});
