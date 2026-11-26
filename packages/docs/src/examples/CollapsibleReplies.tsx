"use client";
import { use } from "react";
import { Collapsible } from "@funstack/ui/collapsible";
import { sleep } from "./fake-api.js";

let replies: Promise<string[]> | undefined;
function loadReplies(): Promise<string[]> {
  replies ??= sleep(1200).then(() => ["Looks good to me.", "Ship it!", "One nit, see inline."]);
  return replies;
}

function ReplyList() {
  return (
    <ul>
      {use(loadReplies()).map((reply) => (
        <li key={reply}>{reply}</li>
      ))}
    </ul>
  );
}

// Library mode without an action: `defaultOpen={false}` alone selects it. The Panel's function
// child mounts <ReplyList> only once the Collapsible is open in committed state. The replies
// suspend for 1.2 s; because opening is a transition, the <details> stays closed with a spinner
// on the trigger until the data is ready, then opens with its content. No Suspense fallback.
export function CollapsibleReplies() {
  return (
    <Collapsible.Root defaultOpen={false} className="demo-collapsible">
      <Collapsible.Trigger className="demo-collapsible-trigger">
        {({ open, pending }) => (
          <>
            {open ? "Hide replies" : "Show 3 replies"}
            {pending && <span className="demo-spinner" aria-hidden />}
          </>
        )}
      </Collapsible.Trigger>
      <Collapsible.Panel className="demo-collapsible-panel">
        {({ open }) => open && <ReplyList />}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
