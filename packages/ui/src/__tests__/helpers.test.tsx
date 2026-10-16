// The open-deferred registry (helpers.tsx `deferred`, settled by vitest.setup.ts after each
// test). The two tests are order-dependent on purpose: the first leaves an async action pending,
// as a test that fails before its `resolve()` would, and the second checks that its own
// transition is not entangled with that leftover.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "../switch/index.js";
import {
  createSuspender,
  deferred,
  expectNotPending,
  expectPending,
  setupUser,
} from "./helpers.js";

describe("open deferreds are settled after each test", () => {
  it("leaves an async action pending on an unresolved deferred", async () => {
    const d = deferred();
    // Also an unresolved suspender entry, which is a deferred too.
    createSuspender();
    render(<Switch aria-label="Leftover" checkedChangeAction={() => d.promise} />);
    await setupUser().click(screen.getByRole("switch"));
    expectPending(screen.getByRole("switch"));
  });

  it("a later test's sync action is not entangled with the leftover", async () => {
    render(<Switch aria-label="Fresh" checkedChangeAction={() => {}} />);
    await setupUser().click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toBeChecked();
    expectNotPending(screen.getByRole("switch"));
  });
});
