import { startTransition, useRef, useState } from "react";
import { Toggle } from "@funstack/ui/toggle";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary";
import { fakeSave } from "./shared/fake-backend";
import { Spinner } from "./shared/Spinner";
import { Demo } from "./shared/Demo";
import "./toggle-demo.css";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <span className="star" aria-hidden>
      {filled ? "★" : "☆"}
    </span>
  );
}

function UncontrolledDemo() {
  return (
    <section>
      <h3>Uncontrolled, async action</h3>
      <p>
        Flips instantly, shows <code>data-pending</code> (spinner, progress cursor) for 800 ms, then
        keeps the value. Click again while pending: latest click wins.
      </p>
      <Toggle
        className="chip"
        defaultPressed={false}
        pressedChangeAction={(next) => fakeSave("uncontrolled", next)}
      >
        {({ pressed, pending }) => (
          <>
            {pending ? <Spinner /> : <StarIcon filled={pressed} />}
            Favorite
          </>
        )}
      </Toggle>
    </section>
  );
}

function ControlledDemo() {
  const [muted, setMuted] = useState(false);
  return (
    <section>
      <h3>Controlled, local state</h3>
      <p>
        The parent sets its state in the synchronous prefix of the action, so the update is a
        Transition and commits with the action.
      </p>
      <Toggle
        className="chip"
        pressed={muted}
        pressedChangeAction={(next) => {
          setMuted(next);
        }}
      >
        <span className="star" aria-hidden>
          {muted ? "\u{1F507}" : "\u{1F50A}"}
        </span>
        Mute
      </Toggle>
      <output className="readout">
        parent state: <code>{String(muted)}</code>
      </output>
    </section>
  );
}

function ControlledVetoDemo() {
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saves = useRef(0);
  return (
    <section>
      <h3>Controlled, update on success (veto)</h3>
      <p>
        The parent writes its state only after the save succeeds. Every second save fails and is
        caught inside the action, so the button snaps back and stays mounted with an inline error;
        the saves in between succeed and the parent adopts the value.
      </p>
      <Toggle
        className="chip"
        pressed={favorite}
        pressedChangeAction={async (next) => {
          setError(null);
          const fail = ++saves.current % 2 === 0;
          try {
            await fakeSave("veto", next, { fail });
            startTransition(() => setFavorite(next));
          } catch (e) {
            startTransition(() => setError(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        {({ pressed, pending }) => (
          <>
            {pending ? <Spinner /> : <StarIcon filled={pressed} />}
            Favorite
          </>
        )}
      </Toggle>
      <output className="readout">
        parent state: <code>{String(favorite)}</code>
        {error && <span className="inline-error"> {error}</span>}
      </output>
    </section>
  );
}

function RejectingDemo() {
  return (
    <section>
      <h3>Rejecting action inside an Error Boundary</h3>
      <p>
        The action rejects after 800 ms. The rejection reaches the boundary around the Toggle, which
        replaces it with its fallback; the optimistic flip is rolled back underneath.
      </p>
      <DemoErrorBoundary>
        <Toggle
          className="chip"
          pressedChangeAction={(next) => fakeSave("rejecting", next, { fail: true })}
        >
          {({ pressed, pending }) => (
            <>
              {pending ? <Spinner /> : <StarIcon filled={pressed} />}
              Favorite
            </>
          )}
        </Toggle>
      </DemoErrorBoundary>
    </section>
  );
}

function TransitionDemo() {
  return (
    <section>
      <h3>
        <code>transition</code> prop
      </h3>
      <p>
        The optimistic flip is a sync commit and does not start a view transition (it animates with
        the CSS <code>transition</code> on <code>[data-pressed]</code>). The commit that ends the
        action does: the spinner fades out through <code>::view-transition-old(.fsui-fade)</code>.
        Open DevTools to see the <code>fsui-toggle-press</code> / <code>-release</code> types on{" "}
        <code>&lt;html&gt;</code>.
      </p>
      <Toggle
        className="chip"
        transition="fsui-fade"
        pressedChangeAction={(next) => fakeSave("transition", next)}
      >
        {({ pressed, pending }) => (
          <>
            {pending ? <Spinner /> : <StarIcon filled={pressed} />}
            Favorite
          </>
        )}
      </Toggle>
    </section>
  );
}

function DisabledDemo() {
  return (
    <section>
      <h3>Disabled</h3>
      <Toggle className="chip" disabled defaultPressed>
        <StarIcon filled />
        Favorite
      </Toggle>
    </section>
  );
}

export function ToggleDemo() {
  return (
    <Demo title="Toggle">
      <UncontrolledDemo />
      <ControlledDemo />
      <ControlledVetoDemo />
      <RejectingDemo />
      <TransitionDemo />
      <DisabledDemo />
    </Demo>
  );
}
