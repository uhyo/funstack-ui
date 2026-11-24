// Probe for #154 (React 19.3.1, jsdom). Prints a trace; asserts nothing but what it states.
import { act, cleanup, render, screen } from "@testing-library/react";
import { startTransition, useActionState, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@funstack/ui/button";

afterEach(cleanup);

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (e: unknown) => void;
}
function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const lines: string[] = [];
const log = (s: string) => {
  lines.push(s);
};
const flush = (title: string) => {
  console.log(`\n=== ${title} ===\n${lines.join("\n")}`);
  lines.length = 0;
};
const click = async (name: string) => {
  await act(async () => {
    screen.getByRole("button", { name }).click();
  });
};
const settle = async (f: () => void) => {
  await act(async () => {
    f();
  });
};
const p = (name: string) =>
  screen.getByRole("button", { name }).hasAttribute("data-pending") ? "PENDING" : "-";

function Status({ names }: { names: Map<unknown, string> }) {
  const s = useFormStatus();
  return (
    <output data-testid="status">
      {s.pending ? `pending action=${names.get(s.action) ?? String(s.action)}` : "idle"}
    </output>
  );
}
const status = () => screen.getByTestId("status").textContent;

/** 1. Raw React: are overlapping form actions serialized? What does useFormStatus report? */
for (const order of ["a-first", "b-first"] as const) {
  it(`raw React, two submitters, resolve ${order}`, async () => {
    const da = deferred();
    const db = deferred();
    const a = async () => {
      log("  [a called]");
      await da.promise;
    };
    const b = async () => {
      log("  [b called]");
      await db.promise;
    };
    const names = new Map<unknown, string>([
      [a, "a"],
      [b, "b"],
    ]);
    render(
      <form action={() => {}}>
        <Status names={names} />
        <button formAction={a}>A</button>
        <button formAction={b}>B</button>
      </form>,
    );
    log(`initial: ${status()}`);
    await click("A");
    log(`click A: ${status()}`);
    await click("B");
    log(`click B: ${status()}`);
    const [first, second] = order === "a-first" ? [da, db] : [db, da];
    await settle(first.resolve);
    log(`resolve ${order === "a-first" ? "a" : "b"}: ${status()}`);
    await settle(second.resolve);
    log(`resolve ${order === "a-first" ? "b" : "a"}: ${status()}`);
    flush(`1. raw React useFormStatus, resolve ${order}`);
  });
}

/** 2. The current Button. */
for (const order of ["a-first", "b-first"] as const) {
  it(`current Button, resolve ${order}`, async () => {
    const da = deferred();
    const db = deferred();
    const a = () => da.promise;
    const b = () => db.promise;
    render(
      <form action={() => {}}>
        <Button formAction={a}>A</Button>
        <Button formAction={b}>B</Button>
      </form>,
    );
    const row = (step: string) => log(`${step.padEnd(12)} A=${p("A").padEnd(8)} B=${p("B")}`);
    await click("A");
    row("click A");
    await click("B");
    row("click B");
    const [first, second] = order === "a-first" ? [da, db] : [db, da];
    await settle(first.resolve);
    row(order === "a-first" ? "resolve a" : "resolve b");
    await settle(second.resolve);
    row(order === "a-first" ? "resolve b" : "resolve a");
    flush(`2. current Button data-pending, resolve ${order}`);
  });
}

/** 3. whilePending="ignore" on A: does a third click on A get through after B was clicked? */
it('current Button, whilePending="ignore": A, B, A again', async () => {
  let calls = 0;
  const da = deferred();
  const db = deferred();
  const a = () => {
    calls++;
    return da.promise;
  };
  const b = () => db.promise;
  render(
    <form action={() => {}}>
      <Button formAction={a} whilePending="ignore">
        A
      </Button>
      <Button formAction={b}>B</Button>
    </form>,
  );
  await click("A");
  log(`click A: a calls=${calls}, A=${p("A")}`);
  await click("B");
  log(`click B: a calls=${calls}, A=${p("A")}`);
  await click("A");
  log(`click A again (a's first run still in flight): a calls=${calls}, A=${p("A")}`);
  await settle(() => {
    da.resolve();
    db.resolve();
  });
  flush('3. current Button, whilePending="ignore" guard after another submitter');
});

/** 4. The form's own action (Enter / Form.Submit) after a Button formAction. */
it("current Button, then the form's own action", async () => {
  const da = deferred();
  const df = deferred();
  const a = () => da.promise;
  render(
    <form action={() => df.promise}>
      <Button formAction={a}>A</Button>
      <button type="submit">Publish</button>
    </form>,
  );
  await click("A");
  log(`click A:       A=${p("A")}`);
  await click("Publish");
  log(`click Publish: A=${p("A")}   (a still in flight)`);
  await settle(() => {
    da.resolve();
    df.resolve();
  });
  flush("4. current Button, form action submitted while A runs");
});

/** 5. Baseline: two Buttons with `action` (no form). Does A stay pending while B runs? */
it("baseline: two Buttons with `action`, resolve a first", async () => {
  const da = deferred();
  const db = deferred();
  function App() {
    const [done, setDone] = useState("");
    return (
      <>
        <output data-testid="done">{done}</output>
        <Button
          action={async () => {
            await da.promise;
            // After an await the transition scope is gone: re-enter it (React docs).
            startTransition(() => setDone((d) => d + "a"));
          }}
        >
          A
        </Button>
        <Button
          action={async () => {
            await db.promise;
            // After an await the transition scope is gone: re-enter it (React docs).
            startTransition(() => setDone((d) => d + "b"));
          }}
        >
          B
        </Button>
      </>
    );
  }
  render(<App />);
  const row = (step: string) =>
    log(
      `${step.padEnd(12)} A=${p("A").padEnd(8)} B=${p("B").padEnd(8)} committed="${screen.getByTestId("done").textContent}"`,
    );
  await click("A");
  row("click A");
  await click("B");
  row("click B");
  await settle(da.resolve);
  row("resolve a");
  await settle(db.resolve);
  row("resolve b");
  flush("5. baseline: two `action` Buttons (React entangles async actions)");
});

/** 6. Same question for what the form actions commit: is a's result visible before b settles? */
it("raw React: a's state update is committed only when b settles too", async () => {
  const da = deferred();
  const db = deferred();
  function App() {
    const [done, setDone] = useState("");
    return (
      <form action={() => {}}>
        <output data-testid="done">{done}</output>
        <button
          formAction={async () => {
            await da.promise;
            // After an await the transition scope is gone: re-enter it (React docs).
            startTransition(() => setDone((d) => d + "a"));
          }}
        >
          A
        </button>
        <button
          formAction={async () => {
            await db.promise;
            // After an await the transition scope is gone: re-enter it (React docs).
            startTransition(() => setDone((d) => d + "b"));
          }}
        >
          B
        </button>
      </form>
    );
  }
  render(<App />);
  const row = (step: string) =>
    log(`${step.padEnd(12)} committed="${screen.getByTestId("done").textContent}"`);
  await click("A");
  await click("B");
  row("click A, B");
  await settle(da.resolve);
  row("resolve a");
  await settle(db.resolve);
  row("resolve b");
  flush("6. raw React: when a formAction's own state update commits");
});

/** 7. Rejections of overlapping form actions. */
for (const which of ["older (a)", "latest (b)"] as const) {
  it(`raw React: ${which} rejects`, async () => {
    const da = deferred();
    const db = deferred();
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => {
      errors.push(`window error: ${e.message}`);
      e.preventDefault();
    };
    window.addEventListener("error", onError);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Component } = await import("react");
    class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
      override state = { error: null as unknown };
      static getDerivedStateFromError(error: unknown) {
        return { error };
      }
      override render() {
        return this.state.error ? (
          <p data-testid="caught">{String(this.state.error)}</p>
        ) : (
          this.props.children
        );
      }
    }
    render(
      <Boundary>
        <form action={() => {}}>
          <button formAction={() => da.promise}>A</button>
          <button formAction={() => db.promise}>B</button>
        </form>
      </Boundary>,
    );
    await click("A");
    await click("B");
    if (which === "older (a)") {
      await settle(() => da.reject(new Error("a failed")));
      log(`a rejected: boundary=${screen.queryByTestId("caught")?.textContent ?? "none"}`);
      await settle(db.resolve);
    } else {
      await settle(() => db.reject(new Error("b failed")));
      log(`b rejected: boundary=${screen.queryByTestId("caught")?.textContent ?? "none"}`);
      await settle(da.resolve);
    }
    log(`both settled: boundary=${screen.queryByTestId("caught")?.textContent ?? "none"}`);
    log(`reported elsewhere: ${JSON.stringify(errors)}`);
    window.removeEventListener("error", onError);
    spy.mockRestore();
    flush(`7. raw React: ${which} rejects`);
  });
}

// ---------------------------------------------------------------------------------------------
// Candidate fixes, as stand-alone components (not library code).

/** Candidate L: latch. Once this submitter was named by the form status, it stays pending until
 * the form channel is idle. Derived state, no click handler involved. */
function LatchButton({
  formAction,
  children,
}: {
  formAction: (fd: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const s = useFormStatus();
  const [latched, setLatched] = useState(false);
  const named = s.pending && s.action === formAction;
  if (named && !latched) setLatched(true);
  if (!s.pending && latched) setLatched(false);
  const pending = s.pending && (named || latched);
  return (
    <button formAction={formAction} data-pending={pending ? "" : undefined}>
      {children}
    </button>
  );
}

/** Candidate T: the Button starts its own (empty) transition in the click that submits; React
 * entangles it with the form's async action. */
function TransitionButton({
  formAction,
  children,
}: {
  formAction: (fd: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      formAction={formAction}
      data-pending={pending ? "" : undefined}
      onClick={() => start(() => {})}
    >
      {children}
    </button>
  );
}

/** Candidate W: wrap the function, track the Button's own promise in its own transition. */
function WrapButton({
  formAction,
  children,
}: {
  formAction: (fd: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      formAction={(fd) => {
        const result = formAction(fd);
        start(async () => {
          await result;
        });
        return result;
      }}
      data-pending={pending ? "" : undefined}
    >
      {children}
    </button>
  );
}

const candidates = { L: LatchButton, T: TransitionButton, W: WrapButton } as const;

for (const [key, Candidate] of Object.entries(candidates)) {
  for (const order of ["a-first", "b-first"] as const) {
    it(`candidate ${key}, resolve ${order}`, async () => {
      const da = deferred();
      const db = deferred();
      const a = () => da.promise;
      const b = () => db.promise;
      render(
        <form action={() => {}}>
          <Candidate formAction={a}>A</Candidate>
          <Candidate formAction={b}>B</Candidate>
        </form>,
      );
      const row = (step: string) => log(`${step.padEnd(12)} A=${p("A").padEnd(8)} B=${p("B")}`);
      await click("A");
      row("click A");
      await click("B");
      row("click B");
      const [first, second] = order === "a-first" ? [da, db] : [db, da];
      await settle(first.resolve);
      row(order === "a-first" ? "resolve a" : "resolve b");
      await settle(second.resolve);
      row(order === "a-first" ? "resolve b" : "resolve a");
      flush(`8. candidate ${key}, resolve ${order}`);
    });
  }

  it(`candidate ${key}: a submission that validation cancels`, async () => {
    const db = deferred();
    const a = vi.fn(async () => {});
    const b = () => db.promise;
    const seen: string[] = [];
    render(
      <form action={() => {}}>
        <input name="title" required defaultValue="" />
        <Candidate formAction={a}>A</Candidate>
        <button formAction={b} formNoValidate>
          B
        </button>
      </form>,
    );
    const observer = new MutationObserver(() => seen.push(p("A")));
    observer.observe(screen.getByRole("button", { name: "A" }), { attributes: true });
    await click("A");
    await Promise.resolve();
    log(`click A (invalid form): a calls=${a.mock.calls.length}, A=${p("A")}, A flashed=${JSON.stringify(seen)}`);
    await click("B");
    log(`click B:                A=${p("A")}  (A never submitted)`);
    await settle(db.resolve);
    observer.disconnect();
    flush(`9. candidate ${key}: cancelled submission, then another submitter`);
  });
}

/** 10. useActionState dispatches as formAction: one queue each. */
it("raw React: two useActionState dispatches as formActions", async () => {
  const da = deferred();
  const db = deferred();
  const names = new Map<unknown, string>();
  function App() {
    const [, dispatchA] = useActionState(async () => {
      log("  [a reducer called]");
      await da.promise;
      return null;
    }, null);
    const [, dispatchB] = useActionState(async () => {
      log("  [b reducer called]");
      await db.promise;
      return null;
    }, null);
    names.set(dispatchA, "dispatchA");
    names.set(dispatchB, "dispatchB");
    return (
      <form action={() => {}}>
        <Status names={names} />
        <LatchButton formAction={dispatchA}>A</LatchButton>
        <LatchButton formAction={dispatchB}>B</LatchButton>
      </form>
    );
  }
  render(<App />);
  const row = (step: string) =>
    log(`${step.padEnd(12)} ${status()?.padEnd(28)} A=${p("A").padEnd(8)} B=${p("B")}`);
  await click("A");
  row("click A");
  await click("B");
  row("click B");
  await click("A");
  row("click A again");
  await settle(da.resolve);
  row("resolve a");
  await settle(db.resolve);
  row("resolve b");
  flush("10. useActionState dispatches (candidate L buttons)");
});

/** 11. Candidate L's blind spot: two submissions in one task (script), no render in between. */
it("candidate L: requestSubmit(A) and requestSubmit(B) in one task", async () => {
  const da = deferred();
  const db = deferred();
  render(
    <form action={() => {}}>
      <LatchButton formAction={() => da.promise}>A</LatchButton>
      <LatchButton formAction={() => db.promise}>B</LatchButton>
    </form>,
  );
  const a = screen.getByRole("button", { name: "A" }) as HTMLButtonElement;
  const b = screen.getByRole("button", { name: "B" }) as HTMLButtonElement;
  await act(async () => {
    a.form!.requestSubmit(a);
    b.form!.requestSubmit(b);
  });
  log(`both submitted in one task: A=${p("A")} B=${p("B")}`);
  await settle(() => {
    da.resolve();
    db.resolve();
  });
  flush("11. candidate L: two script submissions in one task");
});
