// Observes the View Transition types the library adds: jsdom has no `startViewTransition`, so a
// test file wraps React's `addTransitionType` (conventions 5.3). The mock has to be declared in
// the test file itself (vi.mock is hoisted per file), and only in a file of its own named
// `*-transition-types.test.tsx`: those run isolated (isolated-files.ts, #107), since in the shared
// module graph of the `jsdom` project a mocked "react" would leak into other files.
//
//   vi.mock("react", async (importOriginal) => {
//     const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
//     return withTransitionTypeSpy(await importOriginal());
//   });
import { vi } from "vitest";

/** Called with every type `addTransitionType` receives, before React's own function runs. */
export const addTransitionTypeSpy = vi.fn<(type: string) => void>();

/** The `vi.mock("react")` module: React with `addTransitionType` reporting to the spy. */
export function withTransitionTypeSpy<R extends { addTransitionType: (type: string) => void }>(
  actual: R,
): R {
  return {
    ...actual,
    addTransitionType: (type: string) => {
      addTransitionTypeSpy(type);
      actual.addTransitionType(type);
    },
  };
}

/** The types recorded since the last `mockClear()`, in order. */
export function recordedTransitionTypes(): string[] {
  return addTransitionTypeSpy.mock.calls.map(([type]) => type);
}
