"use client";
import { startTransition, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import { sleep } from "./fake-api.js";

// Checkbox and radio items are state owners with useOptimistic: aria-checked flips at once,
// data-pending shows while the (fake) save runs, and the menu stays open so several options can
// be changed in a row. Controlled here, following "update on success": the setState after the
// await is wrapped in startTransition.
export function MenuViewOptions() {
  const [dense, setDense] = useState(false);
  const [archived, setArchived] = useState(true);
  const [sort, setSort] = useState("name");
  return (
    <div className="demo-stack">
      <Menu.Root>
        <Menu.Trigger className="demo-button">View</Menu.Trigger>
        <Menu.Popup className="demo-menu" experimental_focusgroup>
          <Menu.CheckboxItem
            checked={dense}
            checkedChangeAction={async (next) => {
              await sleep(600);
              startTransition(() => setDense(next));
            }}
          >
            Dense rows
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={archived}
            checkedChangeAction={async (next) => {
              await sleep(600);
              startTransition(() => setArchived(next));
            }}
          >
            Show archived
          </Menu.CheckboxItem>
          <Menu.Separator />
          <Menu.RadioGroup
            value={sort}
            valueChangeAction={async (next) => {
              await sleep(600);
              startTransition(() => setSort(next));
            }}
          >
            <Menu.GroupLabel className="demo-menu-label">Sort by</Menu.GroupLabel>
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="modified">Last modified</Menu.RadioItem>
            <Menu.RadioItem value="size">Size</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
      <p className="demo-readout">
        dense: {String(dense)}, show archived: {String(archived)}, sort: {sort}
      </p>
    </div>
  );
}
