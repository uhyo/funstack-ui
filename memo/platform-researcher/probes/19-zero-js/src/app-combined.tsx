import { Accordion } from "@funstack/ui/accordion";
import { Tooltip } from "@funstack/ui/tooltip";
import { Switch } from "@funstack/ui/switch";
import { Progress } from "@funstack/ui/progress";
export default function App() {
  return (
    <main>
      <Accordion.Root exclusive><Accordion.Item value="one"><Accordion.Trigger>One</Accordion.Trigger><Accordion.Panel>A</Accordion.Panel></Accordion.Item></Accordion.Root>
      <Tooltip.Root><Tooltip.Trigger>Save</Tooltip.Trigger><Tooltip.Popup>Saves</Tooltip.Popup></Tooltip.Root>
      <label><Switch name="wifi" /> Wi-Fi</label>
      <Progress.Root value={40}><Progress.Track><Progress.Indicator /></Progress.Track></Progress.Root>
    </main>
  );
}
