// #48: a Root's context value is memoised and the shared hooks under it (`useControllableAction`,
// `useOverlayRoot`) return stable values, so when the Root re-renders with nothing its parts read
// having changed (here: its owner re-renders and passes a new inline action), the parts below it
// do not re-render. The parts are created once, outside the owner, so the only way they can
// re-render is through a changed context value. Their `className` function counts their renders
// (a `Profiler` cannot: with lazy context propagation it misses consumers under a bailed-out
// Profiler fiber).
//
// The converse is checked too: when a value a memo depends on changes (the owner flips `flag`,
// which each case wires to one such prop), the parts do re-render. Lint (`exhaustive-deps`)
// covers the dependency lists statically; this covers that the value really reaches the parts.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createSuspender } from "../__tests__/helpers.js";
import { Accordion } from "../accordion/index.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { Popover } from "../popover/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Select } from "../select/index.js";
import { Tabs } from "../tabs/index.js";

type Root = (action: () => void, parts: ReactNode, flag: boolean) => ReactNode;
type Parts = (count: () => undefined) => ReactNode;

interface Case {
  readonly name: string;
  readonly root: Root;
  readonly parts: Parts;
  /** The memo dependency `flag` drives; omitted when the case has none to drive. */
  readonly flag?: string;
}

function Owner({
  root,
  parts,
  onRender,
}: {
  root: Root;
  parts: ReactNode;
  onRender: (bump: () => void, toggle: () => void) => void;
}) {
  const [, setCount] = useState(0);
  const [flag, setFlag] = useState(false);
  onRender(
    () => setCount((n) => n + 1),
    () => setFlag((f) => !f),
  );
  // A new inline action on every render, as most consumers write it.
  return root(() => {}, parts, flag);
}

function setup({ root, parts: makeParts }: Case, strict: boolean) {
  let partRenders = 0;
  const parts = makeParts(() => {
    partRenders++;
    return undefined;
  });
  let ownerRenders = 0;
  let bump!: () => void;
  let toggle!: () => void;
  const onOwnerRender = (b: () => void, t: () => void) => {
    ownerRenders++;
    bump = b;
    toggle = t;
  };
  const owner = <Owner root={root} parts={parts} onRender={onOwnerRender} />;
  render(strict ? <StrictMode>{owner}</StrictMode> : owner);
  return {
    partRenders: () => partRenders,
    ownerRenders: () => ownerRenders,
    rerenderOwner: () =>
      act(() => {
        bump();
      }),
    toggleFlag: () =>
      act(() => {
        toggle();
      }),
  };
}

const cases: Case[] = [
  {
    name: "Popover",
    root: (action, parts) => (
      <Popover.Root defaultOpen={false} openChangeAction={action}>
        {parts}
      </Popover.Root>
    ),
    parts: (count) => <Popover.Trigger className={count}>Open</Popover.Trigger>,
  },
  {
    name: "Popover (controlled)",
    root: (action, parts, flag) => (
      <Popover.Root open={flag} openChangeAction={action}>
        {parts}
      </Popover.Root>
    ),
    parts: (count) => <Popover.Trigger className={count}>Open</Popover.Trigger>,
    flag: "open",
  },
  {
    name: "Menu",
    root: (action, parts, flag) => (
      <Menu.Root openChangeAction={action} loop={!flag}>
        {parts}
      </Menu.Root>
    ),
    parts: (count) => <Menu.Trigger className={count}>Actions</Menu.Trigger>,
    flag: "loop",
  },
  {
    name: "Menu (controlled)",
    root: (action, parts, flag) => (
      <Menu.Root open={false} openChangeAction={action} loop={!flag}>
        {parts}
      </Menu.Root>
    ),
    parts: (count) => <Menu.Trigger className={count}>Actions</Menu.Trigger>,
    flag: "loop",
  },
  {
    // The Popup's list context, read by the items.
    name: "Menu.Popup",
    root: (action, parts, flag) => (
      <Menu.Root defaultOpen openChangeAction={action} loop={!flag}>
        {parts}
      </Menu.Root>
    ),
    parts: (count) => (
      <>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item className={count}>Rename</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popup>
      </>
    ),
    flag: "loop",
  },
  {
    // `Menu.Group`'s context holds only its label id: nothing to drive.
    name: "Menu.Group",
    root: (action, parts) => (
      <Menu.Root defaultOpen openChangeAction={action}>
        {parts}
      </Menu.Root>
    ),
    parts: (count) => (
      <>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Group className={count}>
            <Menu.GroupLabel className={count}>File</Menu.GroupLabel>
            <Menu.Item className={count}>Rename</Menu.Item>
          </Menu.Group>
        </Menu.Popup>
      </>
    ),
  },
  {
    name: "Menu.RadioGroup",
    root: (action, parts) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Sort</Menu.Trigger>
        <Menu.Popup>
          <Menu.RadioGroup defaultValue="name" valueChangeAction={action}>
            {parts}
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    ),
    parts: (count) => (
      <>
        <Menu.GroupLabel className={count}>Sort by</Menu.GroupLabel>
        <Menu.RadioItem value="name" className={count}>
          Name
        </Menu.RadioItem>
        <Menu.RadioItem value="date">Date</Menu.RadioItem>
      </>
    ),
  },
  {
    name: "Menu.RadioGroup (controlled)",
    root: (action, parts, flag) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Sort</Menu.Trigger>
        <Menu.Popup>
          <Menu.RadioGroup value={flag ? "date" : "name"} valueChangeAction={action}>
            {parts}
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    ),
    parts: (count) => (
      <>
        <Menu.RadioItem value="name" className={count}>
          Name
        </Menu.RadioItem>
        <Menu.RadioItem value="date">Date</Menu.RadioItem>
      </>
    ),
    flag: "value",
  },
  {
    name: "Dialog",
    root: (action, parts, flag) => (
      <Dialog.Root defaultOpen={false} openChangeAction={action} modal={!flag}>
        {parts}
      </Dialog.Root>
    ),
    parts: (count) => <Dialog.Trigger className={count}>Open</Dialog.Trigger>,
    flag: "modal",
  },
  {
    name: "Dialog (controlled)",
    root: (action, parts, flag) => (
      <Dialog.Root open={false} openChangeAction={action} modal={!flag}>
        {parts}
      </Dialog.Root>
    ),
    parts: (count) => <Dialog.Trigger className={count}>Open</Dialog.Trigger>,
    flag: "modal",
  },
  {
    name: "Tabs",
    root: (action, parts, flag) => (
      <Tabs.Root
        defaultValue="a"
        valueChangeAction={action}
        orientation={flag ? "vertical" : "horizontal"}
      >
        {parts}
      </Tabs.Root>
    ),
    parts: (count) => (
      <Tabs.List aria-label="Tabs" className={count}>
        <Tabs.Tab value="a" className={count}>
          A
        </Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
      </Tabs.List>
    ),
    flag: "orientation",
  },
  {
    name: "Tabs (controlled)",
    root: (action, parts, flag) => (
      <Tabs.Root value="a" valueChangeAction={action} disabled={flag}>
        {parts}
      </Tabs.Root>
    ),
    parts: (count) => (
      <Tabs.List aria-label="Tabs">
        <Tabs.Tab value="a" className={count}>
          A
        </Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
      </Tabs.List>
    ),
    flag: "disabled",
  },
  {
    name: "RadioGroup",
    root: (action, parts, flag) => (
      <RadioGroup.Root name="plan" defaultValue="a" valueChangeAction={action} disabled={flag}>
        {parts}
      </RadioGroup.Root>
    ),
    parts: (count) => (
      <>
        <RadioGroup.Item value="a" aria-label="A" className={count} />
        <RadioGroup.Item value="b" aria-label="B" />
      </>
    ),
    flag: "disabled",
  },
  {
    name: "RadioGroup (controlled)",
    root: (action, parts, flag) => (
      <RadioGroup.Root name="plan" value="a" valueChangeAction={action} required={flag}>
        {parts}
      </RadioGroup.Root>
    ),
    parts: (count) => (
      <>
        <RadioGroup.Item value="a" aria-label="A" className={count} />
        <RadioGroup.Item value="b" aria-label="B" />
      </>
    ),
    flag: "required",
  },
  {
    name: "Select",
    root: (action, parts, flag) => (
      <Select.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action} disabled={flag}>
        {parts}
      </Select.Root>
    ),
    parts: (count) => (
      <>
        <Select.Option value="a" className={count}>
          A
        </Select.Option>
        <Select.Option value="b">B</Select.Option>
      </>
    ),
    flag: "disabled",
  },
  {
    name: "Select (controlled)",
    root: (action, parts, flag) => (
      <Select.Root aria-label="Fruit" value={flag ? "b" : "a"} valueChangeAction={action}>
        {parts}
      </Select.Root>
    ),
    parts: (count) => (
      <>
        <Select.Option value="a" className={count}>
          A
        </Select.Option>
        <Select.Option value="b">B</Select.Option>
      </>
    ),
    flag: "value",
  },
  {
    // `Select.Group` re-provides the Root's context with its own `groupDisabled`.
    name: "Select.Group",
    root: (action, parts) => (
      <Select.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
        {parts}
      </Select.Root>
    ),
    parts: (count) => (
      <Select.Group label="Fruit" className={count}>
        <Select.Option value="a" className={count}>
          A
        </Select.Option>
        <Select.Option value="b">B</Select.Option>
      </Select.Group>
    ),
  },
  {
    // The Group is part of the owner's tree here, so `flag` can drive its `disabled`; the
    // counted Option below it is still created once.
    name: "Select.Group (disabled)",
    root: (action, parts, flag) => (
      <Select.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
        <Select.Group label="Fruit" disabled={flag}>
          {parts}
        </Select.Group>
      </Select.Root>
    ),
    parts: (count) => (
      <>
        <Select.Option value="a" className={count}>
          A
        </Select.Option>
        <Select.Option value="b">B</Select.Option>
      </>
    ),
    flag: "disabled",
  },
  {
    name: "Accordion",
    root: (action, parts, flag) => (
      <Accordion.Root defaultValue={[]} valueChangeAction={action} disabled={flag}>
        {parts}
      </Accordion.Root>
    ),
    parts: (count) => (
      <Accordion.Item value="a" className={count}>
        <Accordion.Trigger className={count}>A</Accordion.Trigger>
        <Accordion.Panel className={count}>Panel</Accordion.Panel>
      </Accordion.Item>
    ),
    flag: "disabled",
  },
  {
    // An inline array: a new `value` with the same contents on every owner render.
    name: "Accordion (controlled)",
    root: (action, parts, flag) => (
      <Accordion.Root value={flag ? ["a"] : []} valueChangeAction={action}>
        {parts}
      </Accordion.Root>
    ),
    parts: (count) => (
      <Accordion.Item value="a" className={count}>
        <Accordion.Trigger className={count}>A</Accordion.Trigger>
        <Accordion.Panel className={count}>Panel</Accordion.Panel>
      </Accordion.Item>
    ),
    flag: "value",
  },
  {
    name: "Accordion (controlled, exclusive)",
    root: (action, parts, flag) => (
      <Accordion.Root exclusive value={flag ? "a" : null} valueChangeAction={action}>
        {parts}
      </Accordion.Root>
    ),
    parts: (count) => (
      <Accordion.Item value="a" className={count}>
        <Accordion.Trigger className={count}>A</Accordion.Trigger>
      </Accordion.Item>
    ),
    flag: "value",
  },
];

describe("context stability (#48)", () => {
  describe.each([
    ["concurrent root", false],
    ["StrictMode", true],
  ])("%s", (_label, strict) => {
    it.each(cases.map((c) => [c.name, c] as const))(
      "%s: parts do not re-render when the Root re-renders with unchanged state",
      (_name, c) => {
        const { partRenders, ownerRenders, rerenderOwner } = setup(c, strict);
        const owners = ownerRenders();
        const before = partRenders();
        expect(before).toBeGreaterThan(0);
        rerenderOwner();
        rerenderOwner();
        expect(ownerRenders()).toBeGreaterThanOrEqual(owners + 2);
        expect(partRenders()).toBe(before);
      },
    );
  });

  it.each(cases.filter((c) => c.flag !== undefined).map((c) => [c.name, c.flag, c] as const))(
    "%s: parts re-render when `%s` changes",
    (_name, _flag, c) => {
      const { partRenders, toggleFlag, rerenderOwner } = setup(c, false);
      const before = partRenders();
      toggleFlag();
      const afterFirst = partRenders();
      expect(afterFirst).toBeGreaterThan(before);
      // Stable again once the new value is in place.
      rerenderOwner();
      expect(partRenders()).toBe(afterFirst);
      toggleFlag();
      expect(partRenders()).toBeGreaterThan(afterFirst);
    },
  );

  it("Accordion: opening one item does not re-render another item's Trigger and Panel", async () => {
    const renders = { trigger: 0, panel: 0 };
    const countTrigger = () => {
      renders.trigger++;
      return undefined;
    };
    const countPanel = () => {
      renders.panel++;
      return undefined;
    };
    render(
      <Accordion.Root defaultValue={[]} valueChangeAction={() => {}}>
        <Accordion.Item value="a">
          <Accordion.Trigger className={countTrigger}>A</Accordion.Trigger>
          <Accordion.Panel className={countPanel}>Panel A</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b" data-testid="item-b">
          <Accordion.Trigger>B</Accordion.Trigger>
          <Accordion.Panel>Panel B</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );
    const before = { ...renders };
    expect(before.trigger).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByText("B"));
    });
    expect(screen.getByTestId("item-b")).toHaveAttribute("open");
    expect(renders).toEqual(before);
  });
});

describe("useLatest concurrency guarantee (#48)", () => {
  // The stable callbacks read the props of the last COMMITTED render. A transition render that
  // suspends (the old UI stays on screen) must not leak its props into them: the user acts on the
  // UI they see, so a click calls the action that UI was rendered with. Assigning the latest props
  // during render instead of in `useLatest`'s insertion effect would fail this.
  it("a suspended transition render's new action is not called from the UI still on screen", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const { Suspender } = createSuspender();
    let switchToB!: () => void;
    function App({ expose }: { expose: (switchToB: () => void) => void }) {
      const [useB, setUseB] = useState(false);
      expose(() => startTransition(() => setUseB(true)));
      return (
        <Tabs.Root defaultValue="a" valueChangeAction={useB ? b : a}>
          <Tabs.List aria-label="Tabs">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
          </Tabs.List>
          {useB && <Suspender value="never" />}
        </Tabs.Root>
      );
    }
    render(
      <Suspense fallback="loading">
        <App
          expose={(f) => {
            switchToB = f;
          }}
        />
      </Suspense>,
    );
    await act(async () => {
      switchToB();
    });
    // The transition is suspended on an already revealed boundary: the old UI stays.
    expect(screen.queryByText("loading")).toBeNull();
    expect(screen.queryByTestId("suspender")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "B" }));
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a.mock.calls[0]![0]).toBe("b");
    expect(b).not.toHaveBeenCalled();
  });
});
