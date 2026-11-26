import { Suspense, use, useState } from "react";
import { HoverCard } from "@funstack/ui/hover-card";
import type { HoverCardOpenChangeDetails } from "@funstack/ui/hover-card";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
import "./hover-card-demo.css";

const cache = new Map<string, Promise<string>>();
function fetchProfile(login: string, fail = false): Promise<string> {
  const key = `${login}:${String(fail)}`;
  let promise = cache.get(key);
  if (promise === undefined) {
    promise = sleep(1000).then(() => {
      if (fail) throw new Error(`Could not load @${login}.`);
      return `@${login} writes about engines and notes.`;
    });
    cache.set(key, promise);
  }
  return promise;
}

function Profile({ login, fail }: { login: string; fail?: boolean }) {
  return <span className="hc-bio">{use(fetchProfile(login, fail))}</span>;
}

function MentionsDemo() {
  return (
    <section>
      <h3>Mentions in running text (wait, then open)</h3>
      <p>
        Thanks{" "}
        <HoverCard.Root>
          <HoverCard.Trigger href="#ada" className="hc-link" onClick={(e) => e.preventDefault()}>
            @ada
          </HoverCard.Trigger>
          <HoverCard.Popup render={<span />} className="hc-card" align="start">
            <strong className="hc-name">Ada Lovelace</strong>
            <Profile login="ada" />
            <button type="button">Follow</button>
          </HoverCard.Popup>
        </HoverCard.Root>{" "}
        for the review. The first hover suspends for 1 s: the link is <code>data-pending</code> and
        the card appears complete. Leave before that and nothing appears.
      </p>
    </section>
  );
}

function SkeletonDemo() {
  const [fail, setFail] = useState(false);
  return (
    <section>
      <h3>Skeleton inside the Popup, Error Boundary inside the Popup</h3>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> fail
        the load
      </label>
      <div>
        <HoverCard.Root key={String(fail)}>
          <HoverCard.Trigger
            href="#babbage"
            className="hc-link"
            onClick={(e) => e.preventDefault()}
          >
            @babbage
          </HoverCard.Trigger>
          <HoverCard.Popup className="hc-card">
            <strong className="hc-name">Charles Babbage</strong>
            <DemoErrorBoundary>
              <Suspense fallback={<span className="hc-bio">Loading…</span>}>
                <Profile login="babbage" fail={fail} />
              </Suspense>
            </DemoErrorBoundary>
          </HoverCard.Popup>
        </HoverCard.Root>
      </div>
    </section>
  );
}

function LogDemo() {
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((l) => [...l.slice(-5), line]);
  const request = async (next: boolean, { reason }: HoverCardOpenChangeDetails) => {
    add(`openChangeAction(${next}, ${reason})`);
    await sleep(500);
  };
  const fact = (next: boolean, { reason, event }: HoverCardOpenChangeDetails) => {
    add(`onOpenChange(${next}, ${reason}) ← ${event?.type ?? "no event"}`);
  };
  return (
    <section>
      <h3>Requests and facts, both flags</h3>
      <p>
        <HoverCard.Root openChangeAction={request} onOpenChange={fact} delay={400}>
          <HoverCard.Trigger
            href="#repo"
            className="hc-link"
            experimental_interestFor
            onClick={(e) => e.preventDefault()}
          >
            funstack-ui
          </HoverCard.Trigger>
          <HoverCard.Popup render={<span />} className="hc-card" experimental_hint>
            <strong className="hc-name">uhyo/funstack-ui</strong>
            <span className="hc-bio">Async React-native headless UI.</span>
            <button type="button">Star</button>
          </HoverCard.Popup>
        </HoverCard.Root>
      </p>
      <ol className="hc-log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

export function HoverCardDemo() {
  return (
    <Demo title="HoverCard">
      <p>
        Hover a link or Tab to it: the card opens after the delay (600 ms by default), Tab enters
        it, Escape closes it. Every close is a fact.
      </p>
      <MentionsDemo />
      <SkeletonDemo />
      <LogDemo />
    </Demo>
  );
}
