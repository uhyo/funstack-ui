// #48: a Root's context value is memoised and the shared hooks under it (`useControllableAction`,
// `usePopoverRoot`) return stable values, so when the Root re-renders with nothing its parts read
// having changed (here: its owner re-renders and passes a new inline action), the parts below it
// do not re-render. The parts are created once, outside the owner, so the only way they can
// re-render is through a changed context value. Their `className` function counts their renders
// (a `Profiler` cannot: with lazy context propagation it misses consumers under a bailed-out
// Profiler fiber).
import { act, render } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Accordion } from "../accordion/index.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { Popover } from "../popover/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Select } from "../select/index.js";
import { Tabs } from "../tabs/index.js";

type Root = (action: () => void, parts: ReactNode) => ReactNode;
type Parts = (count: () => undefined) => ReactNode;

function Owner({
  root,
  parts,
  onRender,
}: {
  root: Root;
  parts: ReactNode;
  onRender: (bump: () => void) => void;
}) {
  const [, setCount] = useState(0);
  onRender(() => setCount((n) => n + 1));
  // A new inline action on every render, as most consumers write it.
  return root(() => {}, parts);
}

function setup(root: Root, makeParts: Parts) {
  let partRenders = 0;
  const parts = makeParts(() => {
    partRenders++;
    return undefined;
  });
  let ownerRenders = 0;
  let bump!: () => void;
  const onOwnerRender = (b: () => void) => {
    ownerRenders++;
    bump = b;
  };
  render(<Owner root={root} parts={parts} onRender={onOwnerRender} />);
  return {
    partRenders: () => partRenders,
    ownerRenders: () => ownerRenders,
    rerenderOwner: () =>
      act(() => {
        bump();
      }),
  };
}

const cases: [name: string, root: Root, parts: Parts][] = [
  [
    "Popover",
    (action, parts) => (
      <Popover.Root defaultOpen={false} openChangeAction={action}>
        {parts}
      </Popover.Root>
    ),
    (count) => <Popover.Trigger className={count}>Open</Popover.Trigger>,
  ],
  [
    "Menu",
    (action, parts) => <Menu.Root openChangeAction={action}>{parts}</Menu.Root>,
    (count) => <Menu.Trigger className={count}>Actions</Menu.Trigger>,
  ],
  [
    "Dialog",
    (action, parts) => (
      <Dialog.Root defaultOpen={false} openChangeAction={action}>
        {parts}
      </Dialog.Root>
    ),
    (count) => <Dialog.Trigger className={count}>Open</Dialog.Trigger>,
  ],
  [
    "Tabs",
    (action, parts) => (
      <Tabs.Root defaultValue="a" valueChangeAction={action}>
        {parts}
      </Tabs.Root>
    ),
    (count) => (
      <Tabs.List aria-label="Tabs" className={count}>
        <Tabs.Tab value="a" className={count}>
          A
        </Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
      </Tabs.List>
    ),
  ],
  [
    "RadioGroup",
    (action, parts) => (
      <RadioGroup.Root name="plan" defaultValue="a" valueChangeAction={action}>
        {parts}
      </RadioGroup.Root>
    ),
    (count) => (
      <>
        <RadioGroup.Item value="a" aria-label="A" className={count} />
        <RadioGroup.Item value="b" aria-label="B" />
      </>
    ),
  ],
  [
    "Select",
    (action, parts) => (
      <Select.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
        {parts}
      </Select.Root>
    ),
    (count) => (
      <>
        <Select.Option value="a" className={count}>
          A
        </Select.Option>
        <Select.Option value="b">B</Select.Option>
      </>
    ),
  ],
  [
    "Accordion",
    (action, parts) => (
      <Accordion.Root defaultValue={[]} valueChangeAction={action}>
        {parts}
      </Accordion.Root>
    ),
    (count) => (
      <Accordion.Item value="a" className={count}>
        <Accordion.Trigger className={count}>A</Accordion.Trigger>
        <Accordion.Panel>Panel</Accordion.Panel>
      </Accordion.Item>
    ),
  ],
];

describe("context stability (#48)", () => {
  it.each(cases)(
    "%s: parts do not re-render when the Root re-renders with unchanged state",
    (_name, root, parts) => {
      const { partRenders, ownerRenders, rerenderOwner } = setup(root, parts);
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
