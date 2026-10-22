"use client";
import { Button } from "@funstack/ui/button";
import { fakeSave } from "./fake-api.js";

// A Button whose pending look is CSS only: static children, a string className, and a spinner
// drawn by `.demo-btn-css-spinner[data-pending]::after` in button.css. In an app with Server
// Functions a Server Component renders this directly: `<Button action={sync} ...>`. This static
// site has none, so the fake action lives in this small client module.
export function ButtonCssPending() {
  return (
    <Button className="demo-btn demo-btn-css-spinner" action={() => fakeSave("the sync")}>
      Sync
    </Button>
  );
}
