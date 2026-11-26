// No "use client": this file is a Server Component. The Collapsible has none of `open`,
// `defaultOpen` and `openChangeAction`, so it runs in JS-free mode: the browser owns
// <details open>, and opening it works before hydration (and with JavaScript off).
import { Collapsible } from "@funstack/ui/collapsible";

export function CollapsibleSpoiler() {
  return (
    <Collapsible.Root className="demo-collapsible">
      <Collapsible.Trigger className="demo-collapsible-trigger">
        How does the story end?
      </Collapsible.Trigger>
      <Collapsible.Panel className="demo-collapsible-panel">
        <p>
          The zeppelin lands safely. Closed content stays in the page: search for the word zeppelin
          with your browser's find-in-page and it opens by itself.
        </p>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
