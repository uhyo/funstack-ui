// The jsdom test files that run isolated (#107), shared by vitest.config.ts and the guard in
// isolation.test.ts. The `jsdom` project runs every other file without isolation: the files of a
// worker share one module graph (React's included) and one window. A file goes here when it
// changes module-level state that vitest.setup.ts cannot put back:
// - `vi.mock("react")` (transition-type-spy.ts): the mock is hoisted per file, so in a shared
//   graph it would apply or not depending on which file loaded React first.
// - A streamed server render (`renderToReadableStream`): Fizz leaves its renderer mark on every
//   context it provided, and the client then logs "multiple renderers" for each of them in every
//   later file's rows.
export const isolatedTestFiles = ["src/**/*-transition-types.test.tsx", "src/csp/csp.test.tsx"];
