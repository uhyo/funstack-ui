// Server-only: import this module from Server Components only. A "use client" module importing it
// would ship the source of every example to the browser.
const sources = import.meta.glob<string>("./*.{tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The raw source of an example file, so the code shown is the code running. */
export function exampleSource(file: string): string {
  const source = sources[`./${file}`];
  if (source === undefined) throw new Error(`No example file ${file}`);
  return source;
}
