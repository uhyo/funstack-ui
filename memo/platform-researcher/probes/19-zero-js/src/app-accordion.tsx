import { Accordion } from "@funstack/ui/accordion";
export default function App() {
  return (
    <main>
      <Accordion.Root exclusive>
        <Accordion.Item value="one" defaultOpen><Accordion.Trigger>One</Accordion.Trigger><Accordion.Panel>A</Accordion.Panel></Accordion.Item>
        <Accordion.Item value="two"><Accordion.Trigger>Two</Accordion.Trigger><Accordion.Panel>B</Accordion.Panel></Accordion.Item>
      </Accordion.Root>
    </main>
  );
}
