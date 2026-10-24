// The Viewport's pure queue model (design/components/toast.md 8, 12): the command reducer and
// the visible / queued split, without React.
import { describe, expect, it } from "vitest";
import type { ToastCommand } from "./toast.js";
import { applyCommands, makeEntry, partition, plainText, withFlags } from "./toast-queue.js";
import type { Entry } from "./toast-queue.js";

const entry = (id: string, flags: Partial<Parameters<typeof makeEntry>[1]> = {}): Entry =>
  makeEntry(
    { id, title: id },
    { promisePending: false, actionPending: false, ending: false, ...flags },
  );

const add = (id: string, pending = false, title = id): ToastCommand => ({
  kind: "add",
  id,
  options: { title },
  pending,
});
const ids = (entries: readonly Entry[]) => entries.map((e) => e.options.id);
const nothingRendered = () => false;
const allRendered = () => true;

describe("makeEntry / withFlags", () => {
  it("builds the public item from the options and flags", () => {
    const e = entry("a", { actionPending: true });
    expect(e.item).toMatchObject({ id: "a", title: "a", pending: true, ending: false });
    expect(withFlags(e, { actionPending: false }).item.pending).toBe(false);
    expect(withFlags(e, { ending: true }).item).toMatchObject({ pending: true, ending: true });
  });
});

describe("partition", () => {
  it("renders the first `limit` open entries plus every ending one, in order", () => {
    const entries = [entry("a"), entry("b", { ending: true }), entry("c"), entry("d")];
    const { visible, queued } = partition(entries, 2);
    expect(ids(visible)).toEqual(["a", "b", "c"]);
    expect(ids(queued)).toEqual(["d"]);
  });
});

describe("plainText", () => {
  it("reads strings, numbers and arrays of them; other nodes are empty", () => {
    expect(plainText(["Saved ", 3, " files"])).toBe("Saved 3 files");
    expect(plainText({ type: "b" })).toBe("");
    expect(plainText(undefined)).toBe("");
  });
});

describe("applyCommands", () => {
  it("adds in order and reports the add", () => {
    const result = applyCommands([], [add("a"), add("b", true)], nothingRendered);
    expect(ids(result.next)).toEqual(["a", "b"]);
    expect(result.next[1]!.item.pending).toBe(true);
    expect(result.added).toBe(true);
    expect(result.dismissed).toEqual([]);
  });

  it("an add with an open toast's id updates it in place", () => {
    const result = applyCommands([entry("a"), entry("b")], [add("a", true, "new")], allRendered);
    expect(ids(result.next)).toEqual(["a", "b"]);
    expect(result.next[0]!.options.title).toBe("new");
    expect(result.next[0]!.promisePending).toBe(true);
    expect(result.added).toBe(false);
  });

  it("an add with an ending toast's id replaces it at the end, with fresh bookkeeping", () => {
    const result = applyCommands(
      [entry("a", { ending: true }), entry("b")],
      [add("a")],
      allRendered,
    );
    expect(ids(result.next)).toEqual(["b", "a"]);
    expect(result.next[1]!.ending).toBe(false);
    expect(result.replaced).toEqual(["a"]);
    expect(result.forgotten).toEqual(["a"]);
    expect(result.added).toBe(true);
  });

  it("an update merges options; a settle replaces them and ends pending", () => {
    const start = [
      makeEntry(
        { id: "a", title: "x", description: "d" },
        {
          promisePending: true,
          actionPending: false,
          ending: false,
        },
      ),
    ];
    const merged = applyCommands(
      start,
      [{ kind: "update", id: "a", options: { title: "y" }, settle: false }],
      allRendered,
    );
    expect(merged.next[0]!.options).toMatchObject({ title: "y", description: "d" });
    expect(merged.next[0]!.promisePending).toBe(true);
    const settled = applyCommands(
      start,
      [{ kind: "update", id: "a", options: { title: "done" }, settle: true }],
      allRendered,
    );
    expect(settled.next[0]!.options).toEqual({ id: "a", title: "done" });
    expect(settled.next[0]!.promisePending).toBe(false);
  });

  it("reports an update of a missing toast, but not a settle; an ending toast ignores updates", () => {
    const result = applyCommands(
      [entry("e", { ending: true })],
      [
        { kind: "update", id: "x", options: {}, settle: false },
        { kind: "update", id: "y", options: {}, settle: true },
        { kind: "update", id: "e", options: { title: "z" }, settle: false },
      ],
      allRendered,
    );
    expect(result.missing).toEqual(["x"]);
    expect(result.next[0]!.options.title).toBe("e");
  });

  it("a dismissal turns a rendered toast ending and removes an unrendered one", () => {
    const result = applyCommands(
      [entry("a"), entry("b")],
      [{ kind: "dismiss", id: undefined }],
      (id) => id === "a",
    );
    expect(ids(result.next)).toEqual(["a"]);
    expect(result.next[0]!.ending).toBe(true);
    expect(ids(result.dismissed)).toEqual(["a", "b"]);
    expect(result.forgotten).toEqual(["b"]);
    expect([...result.leaving]).toEqual(["a", "b"]);
  });

  it("dismissals apply in order: a toast added later in the batch stays", () => {
    const result = applyCommands(
      [entry("a")],
      [{ kind: "dismiss", id: undefined }, add("b")],
      allRendered,
    );
    expect(result.next.map((e) => [e.options.id, e.ending])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(ids(result.dismissed)).toEqual(["a"]);
  });

  it("a dismissed toast re-added with its id in the same batch does not leave", () => {
    const result = applyCommands(
      [entry("a"), entry("b")],
      [{ kind: "dismiss", id: "a" }, add("a")],
      allRendered,
    );
    expect(ids(result.dismissed)).toEqual(["a"]);
    expect([...result.leaving]).toEqual([]);
    expect(result.next.filter((e) => !e.ending).map((e) => e.options.id)).toEqual(["b", "a"]);
  });

  it("leaves its input untouched", () => {
    const start = [entry("a")];
    applyCommands(start, [{ kind: "dismiss", id: "a" }, add("b")], allRendered);
    expect(ids(start)).toEqual(["a"]);
    expect(start[0]!.ending).toBe(false);
  });
});
