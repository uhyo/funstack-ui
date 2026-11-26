"use client";
import { Suspense, startTransition, use, useState } from "react";
import { HoverCard } from "@funstack/ui/hover-card";
import type { HoverCardOpenChangeDetails } from "@funstack/ui/hover-card";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { sleep } from "./fake-api.js";

const repos = ["funstack-ui", "funstack-router", "funstack-static"];

// The repository's summary, loaded in the content: the Popup has a Suspense boundary, so the
// card opens after the delay with a skeleton and the summary swaps in when it arrives.
const cache = new Map<string, Promise<string>>();
function loadSummary(repo: string): Promise<string> {
  let promise = cache.get(repo);
  if (promise === undefined) {
    promise = sleep(1200).then(() => `${repo}: ${repo.length * 7} stars, updated today.`);
    cache.set(repo, promise);
  }
  return promise;
}

function Summary({ repo }: { repo: string }) {
  return <p className="demo-card-bio">{use(loadSummary(repo))}</p>;
}

// Requests and facts side by side. `openChangeAction` hears the open (a 400 ms pretend analytics
// call: the link is pending meanwhile) and the cancel of an open that never appeared;
// `onOpenChange` hears every close of a shown card (lost interest, Escape, a press outside),
// synchronously. The readout is plain text, not a live region.
export function HoverCardRepos() {
  const [log, setLog] = useState("(none yet)");
  const request = async (open: boolean, { reason }: HoverCardOpenChangeDetails) => {
    const call = `openChangeAction(${open}, "${reason}")`;
    setLog(`${call}: running…`);
    await sleep(400);
    // After an await: wrap the update in startTransition (React limitation).
    startTransition(() => setLog(`${call}: settled`));
  };
  const fact = (open: boolean, { reason, event }: HoverCardOpenChangeDetails) => {
    setLog(`onOpenChange(${open}, "${reason}") after ${event?.type ?? "no event"}`);
  };
  return (
    <div className="demo-stack">
      <ul className="demo-repo-list">
        {repos.map((repo) => (
          <li key={repo}>
            <HoverCard.Root openChangeAction={request} onOpenChange={fact}>
              <HoverCard.Trigger
                href={`https://github.com/uhyo/${repo}`}
                className="demo-mention"
                onClick={(event) => event.preventDefault()}
              >
                {repo}
              </HoverCard.Trigger>
              <HoverCard.Popup className="demo-card">
                <strong className="demo-card-name">uhyo/{repo}</strong>
                <DemoErrorBoundary>
                  <Suspense fallback={<p className="demo-card-bio demo-skeleton">Loading…</p>}>
                    <Summary repo={repo} />
                  </Suspense>
                </DemoErrorBoundary>
                <span className="demo-card-row">
                  <button type="button" className="demo-button">
                    Star
                  </button>
                </span>
              </HoverCard.Popup>
            </HoverCard.Root>
          </li>
        ))}
      </ul>
      <p className="demo-readout">
        Last: <code>{log}</code>
      </p>
    </div>
  );
}
