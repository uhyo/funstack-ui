import { Tooltip } from "@funstack/ui/tooltip";
export default function App() {
  return (
    <main>
      <Tooltip.Root><Tooltip.Trigger>Save</Tooltip.Trigger><Tooltip.Popup>Saves</Tooltip.Popup></Tooltip.Root>
      <Tooltip.Root><Tooltip.Trigger experimental_interestFor>Native</Tooltip.Trigger><Tooltip.Popup experimental_hint>Hint</Tooltip.Popup></Tooltip.Root>
    </main>
  );
}
