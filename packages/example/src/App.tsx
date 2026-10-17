import { AccordionDemo } from "./accordion-demo";
import { ToggleDemo } from "./toggle-demo";
import { TabsDemo } from "./tabs-demo";
import { TooltipDemo } from "./tooltip-demo";
import { SwitchCheckboxDemo } from "./switch-checkbox-demo";
import { DialogDemo } from "./dialog-demo";
import { PopoverDemo } from "./popover-demo";
import { MenuDemo } from "./menu-demo";
import { RadioGroupDemo } from "./radio-group-demo";
import { CheckboxGroupDemo } from "./checkbox-group-demo";
import { SelectDemo } from "./select-demo";

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
      <TooltipDemo />
      <SwitchCheckboxDemo />
      <DialogDemo />
      <PopoverDemo />
      <MenuDemo />
      <RadioGroupDemo />
      <CheckboxGroupDemo />
      <SelectDemo />
    </main>
  );
}
