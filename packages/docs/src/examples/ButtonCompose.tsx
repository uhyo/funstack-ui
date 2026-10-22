"use client";
import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { Dialog } from "@funstack/ui/dialog";
import { Tooltip } from "@funstack/ui/tooltip";
import { fakeSave } from "./fake-api.js";

// A Trigger that renders a Button: one click runs the Button's action and opens the dialog. The
// action does not await its work (`void`), because React commits the open together with the
// transition the click started: an awaited action would hold the dialog closed until it settles.
// The Tooltip on the Archive Button keeps opening on hover and focus while the Button is pending.
export function ButtonCompose() {
  const [prefetches, setPrefetches] = useState(0);

  return (
    <div className="demo-row">
      <Dialog.Root defaultOpen={false}>
        <Dialog.Trigger
          render={
            <Button
              className="demo-btn"
              action={() => {
                void fakeSave("the profile").then(() =>
                  startTransition(() => setPrefetches((n) => n + 1)),
                );
              }}
            />
          }
        >
          Edit profile…
        </Dialog.Trigger>
        <Dialog.Popup className="demo-dialog">
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Profiles prefetched so far: {prefetches}.</Dialog.Description>
          <div className="demo-dialog-actions">
            <Dialog.Close className="demo-button">Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Button className="demo-btn" action={() => fakeSave("the archive", { ms: 3000 })} />
          }
        >
          Archive
        </Tooltip.Trigger>
        <Tooltip.Popup className="demo-tip">Moves the thread out of your inbox</Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );
}
