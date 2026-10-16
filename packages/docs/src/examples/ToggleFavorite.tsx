"use client";
import { Toggle } from "@funstack/ui/toggle";
import { fakeSave } from "./fake-api.js";

// Uncontrolled Toggle with an async action. The star flips at once (optimistic), the button
// carries data-pending for the 800 ms the save takes, and a second click while pending wins.
export function ToggleFavorite() {
  return (
    <Toggle className="demo-toggle" pressedChangeAction={(next) => fakeSave(`favorite=${next}`)}>
      {({ pressed, pending }) => (
        <>
          {pending ? (
            <span className="demo-spinner" aria-hidden />
          ) : (
            <span aria-hidden>{pressed ? "★" : "☆"}</span>
          )}
          Favorite
        </>
      )}
    </Toggle>
  );
}
