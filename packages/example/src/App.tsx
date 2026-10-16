import { AccordionDemo } from "./accordion-demo";
import { ToggleDemo } from "./toggle-demo";
import { TabsDemo } from "./tabs-demo";

export function App() {
  return (
    <main>
      <h1>FUNSTACK UI Playground</h1>
      <p>
        Each demo below exercises one component of <code>@funstack/ui</code>. Open the console to
        follow the fake backend calls.
      </p>
      <ToggleDemo />
      <AccordionDemo />
      <TabsDemo />
    </main>
  );
}
