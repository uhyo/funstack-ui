"use client";
import { use, useState } from "react";
import { Accordion } from "@funstack/ui/accordion";
import { sleep } from "./fake-api.js";

const cache = new Map<string, Promise<string[]>>();
function loadReplies(thread: string): Promise<string[]> {
  let promise = cache.get(thread);
  if (promise === undefined) {
    promise = sleep(1200).then(() => [`First reply to ${thread}`, `Second reply to ${thread}`]);
    cache.set(thread, promise);
  }
  return promise;
}

function Replies({ thread }: { thread: string }) {
  const replies = use(loadReplies(thread));
  return (
    <ul>
      {replies.map((reply) => (
        <li key={reply}>{reply}</li>
      ))}
    </ul>
  );
}

const threads = ["Release planning", "Bug triage", "Design review"];

// Library mode (controlled, exclusive). The Panel's function child mounts <Replies> only once
// the item is open in committed state. Replies suspend for 1.2 s; because opening is a
// transition, the item stays closed with a spinner on its trigger until the data is ready, then
// opens with its content. No Suspense fallback is ever shown.
export function AccordionThreads() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Accordion.Root
        exclusive
        className="demo-accordion"
        value={open}
        valueChangeAction={(next) => {
          setOpen(next); // sync prefix: a Transition update
        }}
      >
        {threads.map((thread) => (
          <Accordion.Item key={thread} value={thread} className="demo-accordion-item">
            <Accordion.Trigger className="demo-accordion-trigger">
              {({ pending }) => (
                <>
                  <h4>{thread}</h4>
                  {pending && <span className="demo-spinner" aria-hidden />}
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Panel className="demo-accordion-panel">
              {({ open }) => open && <Replies thread={thread} />}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <output className="demo-readout">
        value: <code>{JSON.stringify(open)}</code>
      </output>
    </>
  );
}
