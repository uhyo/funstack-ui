// #94 re-check: a Progress in the main payload, one in a named defer() chunk, one in an unnamed
// defer() chunk. Each Root's aria-labelledby must point at its own Label.
import { Suspense } from "react";
import { defer } from "@funstack/static/server";
import { Progress } from "@funstack/ui/progress";
function Bar({ label, value }: { label: string; value: number }) {
  return (<Progress.Root value={value}><Progress.Label>{label}</Progress.Label><Progress.Track><Progress.Indicator /></Progress.Track></Progress.Root>);
}
export default function App() {
  return (
    <main>
      <Bar label="Main upload" value={10} />
      <Suspense fallback={<p>loading</p>}>{defer(<Bar label="Named deferred upload" value={50} />, { name: "Deferred" })}</Suspense>
      <Suspense fallback={<p>loading</p>}>{defer(<Bar label="Unnamed deferred upload" value={90} />)}</Suspense>
    </main>
  );
}
